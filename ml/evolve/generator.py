"""Evolutionary maze generator.

Uses genetic algorithm to evolve mazes that maximize difficulty score.
Each maze is a chromosome. Mutation = add/remove walls, move traps/gates,
change start/end positions. Selection = difficulty score from simulated players.

Generates 1,000 levels ranked by difficulty in ~30 minutes on M4.
"""

import numpy as np
from dataclasses import dataclass
from ..simulate.maze import Maze, generate_maze, solve_bfs, add_loops, DIRECTION, TOP, RIGHT, BOTTOM, LEFT
from ..simulate.player import simulate_difficulty
from ..simulate.metrics import compute_all_metrics, difficulty_score


@dataclass
class Individual:
    maze: Maze
    fog_radius: float | None
    fitness: float = 0.0
    metrics: dict = None


def random_start_end(cols, rows, rng):
    """Random start and end positions, not always top-left / bottom-right.
    Guarantees they're at least half the grid apart."""
    while True:
        sx = rng.integers(cols)
        sy = rng.integers(rows)
        ex = rng.integers(cols)
        ey = rng.integers(rows)
        dist = abs(sx - ex) + abs(sy - ey)
        if dist >= (cols + rows) // 3:
            return (sx, sy), (ex, ey)


def create_individual(cols, rows, fog_radius, trap_count, gate_count, fake_exit_count, loop_pct, rng):
    """Create a random maze individual."""
    maze = generate_maze(cols, rows, rng)

    start, end = random_start_end(cols, rows, rng)
    maze.start = start
    maze.end = end

    # add loops
    maze = add_loops(maze, loop_pct, rng)

    # verify solvable
    solution = solve_bfs(maze)
    if not solution:
        # fallback: regenerate
        return create_individual(cols, rows, fog_radius, trap_count, gate_count, fake_exit_count, loop_pct, rng)

    solution_set = set(solution)

    # place traps on non-solution cells
    non_solution = [
        (x, y) for y in range(rows) for x in range(cols)
        if (x, y) not in solution_set
        and (x, y) != maze.start and (x, y) != maze.end
        and len(maze.neighbors(x, y)) > 0  # reachable
    ]
    rng.shuffle(non_solution)
    for i in range(min(trap_count, len(non_solution))):
        maze.traps.add(non_solution[i])

    # place gates on solution path
    gate_candidates = [
        (solution[i], solution[i - 1])
        for i in range(2, len(solution) - 2)
    ]
    rng.shuffle(gate_candidates)
    placed_gates = 0
    for (cx, cy), (px, py) in gate_candidates:
        if placed_gates >= gate_count:
            break
        dx, dy = cx - px, cy - py
        direction = None
        if dx == 1: direction = RIGHT
        elif dx == -1: direction = LEFT
        elif dy == 1: direction = BOTTOM
        elif dy == -1: direction = TOP
        if direction:
            maze.gates[(cx, cy)] = direction
            placed_gates += 1

    # place fake exits
    fake_candidates = [
        (x, y) for y in range(rows) for x in range(cols)
        if (x, y) not in solution_set
        and (x, y) not in maze.traps
        and (x, y) != maze.start and (x, y) != maze.end
    ]
    rng.shuffle(fake_candidates)
    for i in range(min(fake_exit_count, len(fake_candidates))):
        maze.fake_exits.add(fake_candidates[i])

    return Individual(maze=maze, fog_radius=fog_radius)


def mutate(individual, rng, mutation_rate=0.3):
    """Mutate a maze individual. Returns a new Individual."""
    maze = individual.maze.copy()

    if rng.random() < mutation_rate:
        # move start or end
        start, end = random_start_end(maze.cols, maze.rows, rng)
        if rng.random() < 0.5:
            maze.start = start
        else:
            maze.end = end

    if rng.random() < mutation_rate:
        # toggle a random interior wall
        x = rng.integers(maze.cols)
        y = rng.integers(maze.rows)
        direction = [TOP, RIGHT, BOTTOM, LEFT][rng.integers(4)]
        dx, dy = DIRECTION[direction]
        nx, ny = x + dx, y + dy
        if 0 <= nx < maze.cols and 0 <= ny < maze.rows:
            if maze.has_wall(x, y, direction):
                maze.remove_wall_between(x, y, nx, ny)
            else:
                maze.add_wall_between(x, y, nx, ny)

    if rng.random() < mutation_rate and maze.traps:
        # move a random trap
        old_trap = list(maze.traps)[rng.integers(len(maze.traps))]
        maze.traps.discard(old_trap)
        solution_set = set(solve_bfs(maze))
        candidates = [
            (x, y) for y in range(maze.rows) for x in range(maze.cols)
            if (x, y) not in solution_set and (x, y) not in maze.traps
            and (x, y) != maze.start and (x, y) != maze.end
        ]
        if candidates:
            new_pos = candidates[rng.integers(len(candidates))]
            maze.traps.add(new_pos)
        else:
            maze.traps.add(old_trap)  # put it back

    # verify still solvable
    solution = solve_bfs(maze)
    if not solution:
        return individual  # mutation broke it, return original

    return Individual(maze=maze, fog_radius=individual.fog_radius)


def crossover(parent_a, parent_b, rng):
    """Crossover two mazes by taking walls from one half and the other half from the other parent."""
    if parent_a.maze.cols != parent_b.maze.cols or parent_a.maze.rows != parent_b.maze.rows:
        return parent_a  # can't cross different sizes

    maze = parent_a.maze.copy()
    split_y = maze.rows // 2

    # take bottom half walls from parent_b
    maze.walls[split_y:, :] = parent_b.maze.walls[split_y:, :]

    # merge traps
    maze.traps = parent_a.maze.traps | parent_b.maze.traps

    # keep parent_a's start/end and gates
    solution = solve_bfs(maze)
    if not solution:
        return parent_a  # crossover broke solvability

    return Individual(maze=maze, fog_radius=parent_a.fog_radius)


def evaluate(individual, num_players=5, rng=None):
    """Evaluate an individual's fitness using simulated players + structural metrics."""
    if rng is None:
        rng = np.random.default_rng()

    metrics = compute_all_metrics(individual.maze, individual.fog_radius)
    individual.metrics = metrics

    if not metrics["solvable"]:
        individual.fitness = -1000
        return individual

    # simulate players
    sim_results = simulate_difficulty(
        individual.maze,
        fog_radius=individual.fog_radius,
        num_players=num_players,
        rng=rng,
    )

    # combine structural difficulty with simulated difficulty
    structural = difficulty_score(metrics)
    simulated = sim_results["mean_deaths"] * 3 + sim_results["mean_steps"] / individual.maze.size

    # penalize if nobody completes it (too hard = not fun)
    completion_penalty = 0
    if sim_results["completion_rate"] < 0.3:
        completion_penalty = 50  # too hard
    elif sim_results["completion_rate"] > 0.95:
        completion_penalty = -20  # too easy, bonus for difficulty

    individual.fitness = structural + simulated - completion_penalty
    individual.metrics["sim_deaths"] = sim_results["mean_deaths"]
    individual.metrics["sim_steps"] = sim_results["mean_steps"]
    individual.metrics["sim_completion"] = sim_results["completion_rate"]

    return individual


def evolve(
    cols,
    rows,
    fog_radius=None,
    trap_count=0,
    gate_count=0,
    fake_exit_count=0,
    loop_pct=0.1,
    population_size=30,
    generations=50,
    mutation_rate=0.3,
    elite_count=5,
    seed=42,
    verbose=True,
):
    """Run evolutionary search. Returns list of Individuals sorted by fitness."""
    rng = np.random.default_rng(seed)

    # initialize population
    if verbose:
        print(f"Evolving {cols}x{rows} maze | fog={fog_radius} traps={trap_count} gates={gate_count}")
        print(f"Population={population_size}, Generations={generations}")

    population = []
    for i in range(population_size):
        ind = create_individual(cols, rows, fog_radius, trap_count, gate_count, fake_exit_count, loop_pct, rng)
        ind = evaluate(ind, rng=rng)
        population.append(ind)

    population.sort(key=lambda x: x.fitness, reverse=True)

    for gen in range(generations):
        new_pop = []

        # elite preservation
        new_pop.extend(population[:elite_count])

        # breed rest of population
        while len(new_pop) < population_size:
            # tournament selection
            t1 = population[rng.integers(len(population))]
            t2 = population[rng.integers(len(population))]
            parent = t1 if t1.fitness > t2.fitness else t2

            # crossover sometimes
            if rng.random() < 0.3 and len(population) > 1:
                t3 = population[rng.integers(len(population))]
                t4 = population[rng.integers(len(population))]
                parent2 = t3 if t3.fitness > t4.fitness else t4
                child = crossover(parent, parent2, rng)
            else:
                child = parent

            # mutate
            child = mutate(child, rng, mutation_rate)
            child = evaluate(child, rng=rng)
            new_pop.append(child)

        population = new_pop
        population.sort(key=lambda x: x.fitness, reverse=True)

        if verbose and (gen + 1) % 10 == 0:
            best = population[0]
            print(f"  Gen {gen + 1:3d} | Best fitness: {best.fitness:.1f} | "
                  f"Deaths: {best.metrics.get('sim_deaths', 0):.1f} | "
                  f"Completion: {best.metrics.get('sim_completion', 0):.0%}")

    if verbose:
        print(f"Done. Best fitness: {population[0].fitness:.1f}")

    return population
