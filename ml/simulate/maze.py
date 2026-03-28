"""Maze data structure and generation for ML pipeline.

Grid-based maze where each cell has 4 walls (top, right, bottom, left).
Mirrors the JS engine but optimized for batch operations with NumPy.
"""

import numpy as np
from dataclasses import dataclass, field


# Wall bitmask constants
TOP = 1
RIGHT = 2
BOTTOM = 4
LEFT = 8
ALL_WALLS = TOP | RIGHT | BOTTOM | LEFT

OPPOSITE = {TOP: BOTTOM, BOTTOM: TOP, LEFT: RIGHT, RIGHT: LEFT}
DIRECTION = {
    TOP: (0, -1),
    RIGHT: (1, 0),
    BOTTOM: (0, 1),
    LEFT: (-1, 0),
}
WALL_NAMES = {TOP: "top", RIGHT: "right", BOTTOM: "bottom", LEFT: "left"}


@dataclass
class Maze:
    cols: int
    rows: int
    walls: np.ndarray  # shape (rows, cols), dtype uint8, bitmask per cell
    start: tuple[int, int] = (0, 0)
    end: tuple[int, int] = (0, 0)
    traps: set = field(default_factory=set)       # set of (x, y)
    gates: dict = field(default_factory=dict)      # {(x, y): direction_bit}
    fake_exits: set = field(default_factory=set)   # set of (x, y)
    modifiers: dict = field(default_factory=dict)  # {(x, y): modifier_type}

    @property
    def size(self):
        return self.cols * self.rows

    def has_wall(self, x, y, direction):
        if x < 0 or x >= self.cols or y < 0 or y >= self.rows:
            return True
        return bool(self.walls[y, x] & direction)

    def set_wall(self, x, y, direction, value=True):
        if value:
            self.walls[y, x] |= direction
        else:
            self.walls[y, x] &= np.uint8(~np.uint8(direction))

    def remove_wall_between(self, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        if dx == 1:
            self.set_wall(x1, y1, RIGHT, False)
            self.set_wall(x2, y2, LEFT, False)
        elif dx == -1:
            self.set_wall(x1, y1, LEFT, False)
            self.set_wall(x2, y2, RIGHT, False)
        elif dy == 1:
            self.set_wall(x1, y1, BOTTOM, False)
            self.set_wall(x2, y2, TOP, False)
        elif dy == -1:
            self.set_wall(x1, y1, TOP, False)
            self.set_wall(x2, y2, BOTTOM, False)

    def add_wall_between(self, x1, y1, x2, y2):
        dx, dy = x2 - x1, y2 - y1
        if dx == 1:
            self.set_wall(x1, y1, RIGHT, True)
            self.set_wall(x2, y2, LEFT, True)
        elif dx == -1:
            self.set_wall(x1, y1, LEFT, True)
            self.set_wall(x2, y2, RIGHT, True)
        elif dy == 1:
            self.set_wall(x1, y1, BOTTOM, True)
            self.set_wall(x2, y2, TOP, True)
        elif dy == -1:
            self.set_wall(x1, y1, TOP, True)
            self.set_wall(x2, y2, BOTTOM, True)

    def neighbors(self, x, y, respect_walls=True):
        """Get reachable neighbors. If respect_walls=False, returns all adjacent cells."""
        result = []
        for direction, (dx, dy) in DIRECTION.items():
            nx, ny = x + dx, y + dy
            if nx < 0 or nx >= self.cols or ny < 0 or ny >= self.rows:
                continue
            if respect_walls and self.has_wall(x, y, direction):
                continue
            result.append((nx, ny, direction))
        return result

    def copy(self):
        return Maze(
            cols=self.cols,
            rows=self.rows,
            walls=self.walls.copy(),
            start=self.start,
            end=self.end,
            traps=set(self.traps),
            gates=dict(self.gates),
            fake_exits=set(self.fake_exits),
            modifiers=dict(self.modifiers),
        )


def generate_maze(cols, rows, rng=None):
    """Recursive backtracker — generates a perfect maze (exactly one path between any two cells)."""
    if rng is None:
        rng = np.random.default_rng()

    maze = Maze(
        cols=cols,
        rows=rows,
        walls=np.full((rows, cols), ALL_WALLS, dtype=np.uint8),
    )

    visited = np.zeros((rows, cols), dtype=bool)
    stack = [(0, 0)]
    visited[0, 0] = True

    while stack:
        x, y = stack[-1]
        unvisited = []
        for direction, (dx, dy) in DIRECTION.items():
            nx, ny = x + dx, y + dy
            if 0 <= nx < cols and 0 <= ny < rows and not visited[ny, nx]:
                unvisited.append((nx, ny, direction))

        if not unvisited:
            stack.pop()
            continue

        nx, ny, direction = unvisited[rng.integers(len(unvisited))]
        maze.set_wall(x, y, direction, False)
        maze.set_wall(nx, ny, OPPOSITE[direction], False)
        visited[ny, nx] = True
        stack.append((nx, ny))

    # default start/end
    maze.start = (0, 0)
    maze.end = (cols - 1, rows - 1)

    return maze


def solve_bfs(maze, start=None, end=None):
    """BFS solver. Returns path as list of (x, y) or empty list if unsolvable."""
    if start is None:
        start = maze.start
    if end is None:
        end = maze.end

    from collections import deque

    queue = deque([(start, [start])])
    visited = {start}

    while queue:
        (x, y), path = queue.popleft()
        if (x, y) == end:
            return path

        for nx, ny, _ in maze.neighbors(x, y):
            if (nx, ny) not in visited and (nx, ny) not in maze.traps:
                visited.add((nx, ny))
                queue.append(((nx, ny), path + [(nx, ny)]))

    return []


def add_loops(maze, percentage, rng=None):
    """Remove random interior walls to create alternate routes (loops)."""
    if rng is None:
        rng = np.random.default_rng()

    interior_walls = []
    for y in range(maze.rows):
        for x in range(maze.cols):
            if x < maze.cols - 1 and maze.has_wall(x, y, RIGHT):
                interior_walls.append((x, y, x + 1, y))
            if y < maze.rows - 1 and maze.has_wall(x, y, BOTTOM):
                interior_walls.append((x, y, x, y + 1))

    rng.shuffle(interior_walls)
    to_remove = int(len(interior_walls) * percentage)

    for i in range(to_remove):
        x1, y1, x2, y2 = interior_walls[i]
        maze.remove_wall_between(x1, y1, x2, y2)

    return maze
