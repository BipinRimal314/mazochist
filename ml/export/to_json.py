"""Export evolved mazes to JSON format compatible with the JS game engine."""

import json
from ..simulate.maze import Maze, TOP, RIGHT, BOTTOM, LEFT, WALL_NAMES


def maze_to_dict(maze: Maze, fog_radius=None, death_mode="progress", era="learning"):
    """Convert a Maze to the compact JSON format used by serialize.js."""
    data = []
    for y in range(maze.rows):
        for x in range(maze.cols):
            wall_bits = 0
            if maze.has_wall(x, y, TOP): wall_bits |= 1
            if maze.has_wall(x, y, RIGHT): wall_bits |= 2
            if maze.has_wall(x, y, BOTTOM): wall_bits |= 4
            if maze.has_wall(x, y, LEFT): wall_bits |= 8

            modifier = maze.modifiers.get((x, y))
            is_trap = 1 if (x, y) in maze.traps else 0
            gate_dir = None
            if (x, y) in maze.gates:
                gate_bit = maze.gates[(x, y)]
                gate_dir = WALL_NAMES.get(gate_bit)

            is_fake = (x, y) in maze.fake_exits
            if is_fake:
                modifier = "fakeExit"

            if wall_bits == 0 and not modifier and not is_trap and not gate_dir:
                continue

            entry = [x, y, wall_bits, modifier, is_trap, gate_dir]
            data.append(entry)

    return {
        "c": maze.cols,
        "r": maze.rows,
        "s": list(maze.start),
        "e": list(maze.end),
        "w": "",
        "d": data,
    }


def export_levels(individuals, output_path, words=None):
    """Export a list of evolved Individuals to a JSON file for the game."""
    levels = []
    for i, ind in enumerate(individuals):
        word = words[i] if words and i < len(words) else f"LEVEL {i + 1}"
        level = {
            "index": i,
            "name": word,
            "description": f"Evolved. Fitness: {ind.fitness:.0f}. Deaths: {ind.metrics.get('sim_deaths', 0):.0f} avg.",
            "maze": maze_to_dict(ind.maze, ind.fog_radius),
            "fog_radius": ind.fog_radius,
            "death_mode": "progress" if ind.fog_radius is None else ("cumulative" if ind.fog_radius and ind.fog_radius < 3 else "full"),
            "era": "learning" if ind.fog_radius is None else ("sadistic" if ind.fog_radius < 3 else "punishing"),
            "fitness": ind.fitness,
            "metrics": {k: float(v) if isinstance(v, (int, float)) else v for k, v in (ind.metrics or {}).items()},
        }
        levels.append(level)

    with open(output_path, "w") as f:
        json.dump(levels, f, separators=(",", ":"))

    print(f"Exported {len(levels)} levels to {output_path}")
