"""Simulated player for maze difficulty estimation.

Not a perfect solver. Models human-like behavior:
- Limited visibility (fog of war simulation)
- Imperfect memory (forgets explored areas over time)
- Bias toward the exit (prefers paths that look closer to goal)
- Explores tempting wrong paths before correct ones
- Gets killed by traps and must restart
- Tracks deaths, time steps, and backtracking
"""

import numpy as np
from collections import defaultdict
from .maze import Maze, solve_bfs, DIRECTION


class SimulatedPlayer:
    def __init__(
        self,
        maze: Maze,
        fog_radius: float | None = None,
        memory_decay: float = 0.95,     # per-step retention of visited cells
        mistake_prob: float = 0.1,       # chance of picking a suboptimal direction
        exit_bias: float = 0.7,          # preference for cells closer to exit
        rng=None,
    ):
        self.maze = maze
        self.fog_radius = fog_radius
        self.memory_decay = memory_decay
        self.mistake_prob = mistake_prob
        self.exit_bias = exit_bias
        self.rng = rng or np.random.default_rng()

        # state
        self.x, self.y = maze.start
        self.deaths = 0
        self.steps = 0
        self.max_steps = maze.size * 50  # prevent infinite loops
        self.visited_count = defaultdict(int)  # (x,y) -> visit count
        self.memory = {}  # (x,y) -> confidence (0-1) that we remember this cell
        self.known_traps = set()  # traps we've died on and memorized
        self.fake_exits_collected = set()
        self.path_history = []
        self.backtrack_count = 0

    def distance_to_exit(self, x, y):
        return abs(x - self.maze.end[0]) + abs(y - self.maze.end[1])

    def visible_cells(self):
        """Cells the player can currently see (within fog radius)."""
        if self.fog_radius is None:
            return set((x, y) for y in range(self.maze.rows) for x in range(self.maze.cols))

        visible = set()
        for y in range(self.maze.rows):
            for x in range(self.maze.cols):
                dist = ((x - self.x) ** 2 + (y - self.y) ** 2) ** 0.5
                if dist <= self.fog_radius + 0.5:
                    visible.add((x, y))
        return visible

    def decay_memory(self):
        """Reduce confidence in remembered cells each step."""
        to_remove = []
        for pos, confidence in self.memory.items():
            new_conf = confidence * self.memory_decay
            if new_conf < 0.05:
                to_remove.append(pos)
            else:
                self.memory[pos] = new_conf

        for pos in to_remove:
            del self.memory[pos]

    def remember_visible(self):
        """Add currently visible cells to memory at full confidence."""
        for pos in self.visible_cells():
            self.memory[pos] = 1.0

    def choose_move(self):
        """Pick the next cell to move to. Models human decision-making."""
        neighbors = self.maze.neighbors(self.x, self.y)
        if not neighbors:
            return None

        # filter out known traps
        safe = [(nx, ny, d) for nx, ny, d in neighbors if (nx, ny) not in self.known_traps]
        if not safe:
            safe = neighbors  # if all neighbors are known traps, pick one anyway

        # score each option
        scores = []
        for nx, ny, d in safe:
            score = 0.0

            # prefer cells closer to exit
            current_dist = self.distance_to_exit(self.x, self.y)
            new_dist = self.distance_to_exit(nx, ny)
            if new_dist < current_dist:
                score += self.exit_bias * 2
            elif new_dist > current_dist:
                score -= self.exit_bias

            # prefer unvisited cells (exploration drive)
            if self.visited_count[(nx, ny)] == 0:
                score += 1.5
            else:
                score -= 0.3 * self.visited_count[(nx, ny)]

            # prefer cells we haven't memorized (curiosity)
            if (nx, ny) not in self.memory:
                score += 0.5

            scores.append(score)

        # convert to probabilities with temperature
        scores = np.array(scores)
        # random mistake: sometimes pick randomly
        if self.rng.random() < self.mistake_prob:
            idx = self.rng.integers(len(safe))
        else:
            # softmax with temperature
            exp_scores = np.exp(scores - np.max(scores))
            probs = exp_scores / exp_scores.sum()
            idx = self.rng.choice(len(safe), p=probs)

        return safe[idx][:2]

    def step(self):
        """Take one step. Returns True if game is over (won or max steps)."""
        self.steps += 1
        self.decay_memory()
        self.remember_visible()

        # check if we're on a trap
        if (self.x, self.y) in self.maze.traps and (self.x, self.y) not in self.known_traps:
            self.known_traps.add((self.x, self.y))
            self.deaths += 1
            self.x, self.y = self.maze.start
            return False

        # check if we're on a fake exit
        if (self.x, self.y) in self.maze.fake_exits and (self.x, self.y) not in self.fake_exits_collected:
            self.fake_exits_collected.add((self.x, self.y))
            self.deaths += 1
            self.x, self.y = self.maze.start
            return False

        # check win
        all_fakes_collected = len(self.fake_exits_collected) >= len(self.maze.fake_exits)
        if (self.x, self.y) == self.maze.end and all_fakes_collected:
            return True

        # max steps = give up
        if self.steps >= self.max_steps:
            return True

        # choose next move
        move = self.choose_move()
        if move is None:
            return True  # stuck

        nx, ny = move

        # track backtracking
        if self.path_history and (nx, ny) == self.path_history[-1]:
            self.backtrack_count += 1

        self.path_history.append((self.x, self.y))
        self.visited_count[(nx, ny)] += 1
        self.x, self.y = nx, ny

        return False

    def play(self):
        """Play the maze to completion. Returns result dict."""
        while not self.step():
            pass

        completed = (self.x, self.y) == self.maze.end
        unique_cells_visited = len(self.visited_count)

        return {
            "completed": completed,
            "deaths": self.deaths,
            "steps": self.steps,
            "backtrack_count": self.backtrack_count,
            "unique_cells_visited": unique_cells_visited,
            "exploration_ratio": unique_cells_visited / self.maze.size,
            "trap_deaths": len(self.known_traps),
        }


def simulate_difficulty(maze, fog_radius=None, num_players=10, rng=None):
    """Run multiple simulated players and aggregate difficulty metrics."""
    if rng is None:
        rng = np.random.default_rng()

    results = []
    for i in range(num_players):
        player_rng = np.random.default_rng(rng.integers(2**32))
        player = SimulatedPlayer(
            maze,
            fog_radius=fog_radius,
            memory_decay=0.90 + player_rng.random() * 0.08,  # vary between players
            mistake_prob=0.05 + player_rng.random() * 0.15,
            exit_bias=0.5 + player_rng.random() * 0.4,
            rng=player_rng,
        )
        results.append(player.play())

    deaths = [r["deaths"] for r in results]
    steps = [r["steps"] for r in results]
    backtracks = [r["backtrack_count"] for r in results]
    completion_rate = sum(1 for r in results if r["completed"]) / num_players

    return {
        "mean_deaths": np.mean(deaths),
        "median_deaths": np.median(deaths),
        "max_deaths": np.max(deaths),
        "mean_steps": np.mean(steps),
        "completion_rate": completion_rate,
        "mean_backtracks": np.mean(backtracks),
        "difficulty_score": np.mean(deaths) * 2 + np.mean(steps) / maze.size + (1 - completion_rate) * 50,
    }
