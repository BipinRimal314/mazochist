"""Gymnasium environment for RL obstacle placement.

The agent receives a base maze (walls already generated) and places obstacles
one at a time. After all placements, simulated players attempt the maze.
Reward = simulated player suffering (deaths + steps) minus penalty for
unsolvable mazes.

Observation: flattened grid (walls + existing obstacles per cell) + placement budget
Action: cell index to place next obstacle + obstacle type
"""

import gymnasium as gym
import numpy as np
from gymnasium import spaces

from ..simulate.maze import Maze, generate_maze, solve_bfs, add_loops, TOP, RIGHT, BOTTOM, LEFT
from ..simulate.player import simulate_difficulty
from ..simulate.metrics import compute_all_metrics, difficulty_score


# obstacle types the agent can place
OBSTACLE_TYPES = [
    'trap', 'fake_exit',
    'gate_right', 'gate_down', 'gate_left', 'gate_up',
    'mimic', 'memory_wipe', 'liar_wall',
]
NUM_OBSTACLE_TYPES = len(OBSTACLE_TYPES)


class MazeObstaclePlacementEnv(gym.Env):
    """RL environment for learning obstacle placement on pre-generated mazes.

    Episode:
    1. A fresh maze is generated (walls, start, end).
    2. Agent places obstacles one at a time (budget per episode).
    3. After all placements (or agent chooses "done"), simulated players attempt the maze.
    4. Reward based on suffering caused.

    Observation space:
        - Per-cell features (flattened): 4 wall bits + has_trap + has_gate + has_fake_exit + is_on_solution + distance_to_exit_normalized
        - Global features: placements_remaining, fog_radius_normalized, grid_size

    Action space:
        MultiDiscrete([grid_size, NUM_OBSTACLE_TYPES + 1])
        - First dim: which cell (flattened index)
        - Second dim: which obstacle type (0-5) or 6 = done placing
    """

    metadata = {"render_modes": []}

    def __init__(
        self,
        grid_size=10,
        max_placements=8,
        fog_radius=None,
        loop_pct=0.1,
        num_sim_players=5,
    ):
        super().__init__()

        self.grid_size = grid_size
        self.max_placements = max_placements
        self.fog_radius = fog_radius
        self.loop_pct = loop_pct
        self.num_sim_players = num_sim_players

        self.num_cells = grid_size * grid_size
        # per-cell features: 4 walls + trap + gate + fake_exit + on_solution + dist_to_exit + mimic + memory_wipe + liar = 12
        self.cell_features = 12
        # global features: placements_remaining, fog, grid_size = 3
        self.global_features = 3

        obs_size = self.num_cells * self.cell_features + self.global_features
        self.observation_space = spaces.Box(
            low=0.0, high=1.0, shape=(obs_size,), dtype=np.float32
        )

        # action: [cell_index, obstacle_type_or_done]
        self.action_space = spaces.MultiDiscrete([self.num_cells, NUM_OBSTACLE_TYPES + 1])

        self.maze = None
        self.solution = None
        self.solution_set = None
        self.placements_left = 0
        self.rng = np.random.default_rng()

    def _generate_base_maze(self):
        """Generate a fresh maze with walls but no obstacles."""
        maze = generate_maze(self.grid_size, self.grid_size, self.rng)

        # random start/end positions
        while True:
            sx = int(self.rng.integers(self.grid_size))
            sy = int(self.rng.integers(self.grid_size))
            ex = int(self.rng.integers(self.grid_size))
            ey = int(self.rng.integers(self.grid_size))
            dist = abs(sx - ex) + abs(sy - ey)
            if dist >= self.grid_size // 2:
                break

        maze.start = (sx, sy)
        maze.end = (ex, ey)
        maze = add_loops(maze, self.loop_pct, self.rng)

        return maze

    def _get_obs(self):
        """Build observation vector from current maze state."""
        cell_obs = np.zeros((self.num_cells, self.cell_features), dtype=np.float32)

        max_dist = self.grid_size * 2  # max Manhattan distance

        for y in range(self.grid_size):
            for x in range(self.grid_size):
                idx = y * self.grid_size + x
                # wall bits normalized to 0/1
                cell_obs[idx, 0] = float(self.maze.has_wall(x, y, TOP))
                cell_obs[idx, 1] = float(self.maze.has_wall(x, y, RIGHT))
                cell_obs[idx, 2] = float(self.maze.has_wall(x, y, BOTTOM))
                cell_obs[idx, 3] = float(self.maze.has_wall(x, y, LEFT))
                # obstacle presence
                cell_obs[idx, 4] = 1.0 if (x, y) in self.maze.traps else 0.0
                cell_obs[idx, 5] = 1.0 if (x, y) in self.maze.gates else 0.0
                cell_obs[idx, 6] = 1.0 if (x, y) in self.maze.fake_exits else 0.0
                # on solution path
                cell_obs[idx, 7] = 1.0 if (x, y) in self.solution_set else 0.0
                # normalized distance to exit
                dist = abs(x - self.maze.end[0]) + abs(y - self.maze.end[1])
                cell_obs[idx, 8] = dist / max_dist
                # new obstacles
                mod = self.maze.modifiers.get((x, y))
                cell_obs[idx, 9] = 1.0 if mod == 'mimic' else 0.0
                cell_obs[idx, 10] = 1.0 if mod == 'memory_wipe' else 0.0
                cell_obs[idx, 11] = 1.0 if (isinstance(mod, tuple) and mod[0] == 'liar_wall') else 0.0

        global_obs = np.array([
            self.placements_left / self.max_placements,
            (self.fog_radius or 0) / self.grid_size,
            self.grid_size / 20.0,
        ], dtype=np.float32)

        return np.concatenate([cell_obs.flatten(), global_obs])

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        if seed is not None:
            self.rng = np.random.default_rng(seed)

        self.maze = self._generate_base_maze()
        self.solution = solve_bfs(self.maze)

        # regenerate if unsolvable (shouldn't happen but safety)
        attempts = 0
        while not self.solution and attempts < 10:
            self.maze = self._generate_base_maze()
            self.solution = solve_bfs(self.maze)
            attempts += 1

        self.solution_set = set(self.solution) if self.solution else set()
        self.placements_left = self.max_placements

        return self._get_obs(), {}

    def step(self, action):
        cell_idx = int(action[0])
        obstacle_type_idx = int(action[1])

        x = cell_idx % self.grid_size
        y = cell_idx // self.grid_size

        terminated = False
        reward = 0.0

        # "done" action or no placements left
        if obstacle_type_idx >= NUM_OBSTACLE_TYPES or self.placements_left <= 0:
            terminated = True
        else:
            # validate placement
            valid = True
            if (x, y) == self.maze.start or (x, y) == self.maze.end:
                valid = False
                reward -= 1.0  # penalty for invalid placement
            elif (x, y) in self.maze.traps or (x, y) in self.maze.gates or (x, y) in self.maze.fake_exits:
                valid = False
                reward -= 0.5  # cell already has obstacle

            if valid:
                obstacle = OBSTACLE_TYPES[obstacle_type_idx]
                if obstacle == 'trap':
                    # traps should NOT be on solution path
                    if (x, y) in self.solution_set:
                        reward -= 2.0  # big penalty — makes maze unsolvable
                    else:
                        self.maze.traps.add((x, y))
                        # small reward for placing near solution (seductive)
                        min_dist = min(abs(x - sx) + abs(y - sy) for sx, sy in self.solution)
                        if min_dist <= 2:
                            reward += 0.5  # good placement
                elif obstacle == 'fake_exit':
                    if (x, y) not in self.solution_set:
                        self.maze.fake_exits.add((x, y))
                        reward += 0.3
                elif obstacle.startswith('gate_'):
                    direction_map = {'gate_right': RIGHT, 'gate_left': LEFT, 'gate_down': BOTTOM, 'gate_up': TOP}
                    direction = direction_map[obstacle]
                    if (x, y) in self.solution_set:
                        self.maze.gates[(x, y)] = direction
                        reward += 0.4
                    else:
                        reward -= 0.3  # gates off solution are less useful
                elif obstacle == 'mimic':
                    if (x, y) not in self.solution_set:
                        self.maze.modifiers[(x, y)] = 'mimic'
                        # closer to exit = more deceptive
                        dist_to_end = abs(x - self.maze.end[0]) + abs(y - self.maze.end[1])
                        max_dist = self.grid_size * 2
                        reward += 0.6 * (1 - dist_to_end / max_dist)
                    else:
                        reward -= 1.0  # mimic on solution = unfair
                elif obstacle == 'memory_wipe':
                    if (x, y) in self.solution_set:
                        self.maze.modifiers[(x, y)] = 'memory_wipe'
                        reward += 0.8  # devastating on solution path
                    else:
                        reward += 0.2
                elif obstacle == 'liar_wall':
                    # create a random liar wall configuration
                    liar = {}
                    for d_name, d_bit in [('top', TOP), ('right', RIGHT), ('bottom', BOTTOM), ('left', LEFT)]:
                        has_wall = bool(self.maze.walls[y, x] & d_bit)
                        if np.random.random() < 0.4:
                            liar[d_name] = not has_wall  # flip the visual
                    if liar:
                        self.maze.modifiers[(x, y)] = ('liar_wall', liar)
                        if (x, y) in self.solution_set:
                            reward += 0.7  # liar on solution = very confusing
                        else:
                            reward += 0.3

                self.placements_left -= 1

            # check still solvable after placement
            new_solution = solve_bfs(self.maze)
            if not new_solution:
                # undo last placement and penalize
                reward -= 5.0
                self.maze.traps.discard((x, y))
                self.maze.fake_exits.discard((x, y))
                self.maze.gates.pop((x, y), None)
                self.maze.modifiers.pop((x, y), None)
            else:
                self.solution = new_solution
                self.solution_set = set(new_solution)

            if self.placements_left <= 0:
                terminated = True

        # final evaluation when episode ends
        if terminated:
            if self.solution:
                sim = simulate_difficulty(
                    self.maze,
                    fog_radius=self.fog_radius,
                    num_players=self.num_sim_players,
                    rng=self.rng,
                )
                metrics = compute_all_metrics(self.maze, self.fog_radius)

                # reward = suffering caused
                death_reward = sim["mean_deaths"] * 3.0
                step_reward = sim["mean_steps"] / self.maze.size * 2.0
                exploration_reward = sim["mean_backtracks"] * 0.5
                structural_reward = difficulty_score(metrics) * 0.1

                # penalty if too hard (nobody finishes)
                completion_penalty = 0
                if sim["completion_rate"] < 0.4:
                    completion_penalty = 20.0
                elif sim["completion_rate"] < 0.6:
                    completion_penalty = 5.0

                reward += death_reward + step_reward + exploration_reward + structural_reward - completion_penalty
            else:
                reward -= 50.0  # unsolvable maze = terrible

        truncated = False
        return self._get_obs(), float(reward), terminated, truncated, {}
