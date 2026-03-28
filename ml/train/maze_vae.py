"""Variational Autoencoder for maze topology generation.

Learns a latent space of maze structures from evolved/RL training data.
Difficulty is a controllable dimension — slide a parameter to make mazes harder.

Architecture:
- Encoder: maze grid (walls as binary channels) → latent vector (32-dim)
- Decoder: latent vector → maze grid (wall probabilities)
- Condition: difficulty score concatenated to latent space

Training data: evolved + RL-placed mazes with fitness scores.

Usage:
    python -m ml.train.maze_vae
    python -m ml.train.maze_vae --epochs 200 --generate 20
"""

import argparse
import json
import os
import time
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader

from ..simulate.maze import Maze, solve_bfs, TOP, RIGHT, BOTTOM, LEFT
from ..simulate.metrics import compute_all_metrics, difficulty_score
from ..simulate.player import simulate_difficulty


# fixed grid size for VAE (pad/crop to this)
GRID_SIZE = 12
WALL_CHANNELS = 4  # top, right, bottom, left per cell
LATENT_DIM = 32


class MazeDataset(Dataset):
    """Dataset of maze grids from JSON level files."""

    def __init__(self, json_paths, target_size=GRID_SIZE):
        self.mazes = []
        self.scores = []
        self.target_size = target_size

        for path in json_paths:
            with open(path) as f:
                levels = json.load(f)
            for level in levels:
                maze_data = level["maze"]
                cols, rows = maze_data["c"], maze_data["r"]

                # encode walls as 4-channel binary grid
                grid = np.zeros((4, target_size, target_size), dtype=np.float32)

                # build cell wall lookup
                walls = {}
                for entry in maze_data["d"]:
                    x, y, wall_bits = entry[0], entry[1], entry[2]
                    walls[(x, y)] = wall_bits

                for y in range(min(rows, target_size)):
                    for x in range(min(cols, target_size)):
                        wb = walls.get((x, y), 0)
                        grid[0, y, x] = float(bool(wb & 1))  # top
                        grid[1, y, x] = float(bool(wb & 2))  # right
                        grid[2, y, x] = float(bool(wb & 4))  # bottom
                        grid[3, y, x] = float(bool(wb & 8))  # left

                fitness = level.get("fitness", 0)
                # normalize fitness to 0-1 range (rough)
                norm_fitness = min(fitness / 600.0, 1.0)

                self.mazes.append(grid)
                self.scores.append(norm_fitness)

        self.mazes = np.array(self.mazes)
        self.scores = np.array(self.scores, dtype=np.float32)

    def __len__(self):
        return len(self.mazes)

    def __getitem__(self, idx):
        return (
            torch.from_numpy(self.mazes[idx]),
            torch.tensor(self.scores[idx]),
        )


class MazeEncoder(nn.Module):
    def __init__(self, grid_size=GRID_SIZE, latent_dim=LATENT_DIM):
        super().__init__()
        self.conv1 = nn.Conv2d(WALL_CHANNELS, 32, 3, padding=1)
        self.conv2 = nn.Conv2d(32, 64, 3, padding=1)
        self.conv3 = nn.Conv2d(64, 128, 3, padding=1)
        self.pool = nn.AdaptiveAvgPool2d(3)

        self.fc_flat = 128 * 3 * 3
        # +1 for condition (difficulty score)
        self.fc_mu = nn.Linear(self.fc_flat + 1, latent_dim)
        self.fc_logvar = nn.Linear(self.fc_flat + 1, latent_dim)

    def forward(self, x, condition):
        h = F.relu(self.conv1(x))
        h = F.relu(self.conv2(h))
        h = F.relu(self.conv3(h))
        h = self.pool(h)
        h = h.view(h.size(0), -1)
        h = torch.cat([h, condition.unsqueeze(1)], dim=1)
        return self.fc_mu(h), self.fc_logvar(h)


class MazeDecoder(nn.Module):
    def __init__(self, grid_size=GRID_SIZE, latent_dim=LATENT_DIM):
        super().__init__()
        self.grid_size = grid_size
        # +1 for condition
        self.fc = nn.Linear(latent_dim + 1, 128 * 3 * 3)
        self.deconv1 = nn.ConvTranspose2d(128, 64, 3, padding=1)
        self.deconv2 = nn.ConvTranspose2d(64, 32, 3, padding=1)
        self.deconv3 = nn.ConvTranspose2d(32, WALL_CHANNELS, 3, padding=1)
        self.upsample = nn.Upsample(size=grid_size, mode='bilinear', align_corners=False)

    def forward(self, z, condition):
        h = torch.cat([z, condition.unsqueeze(1)], dim=1)
        h = F.relu(self.fc(h))
        h = h.view(h.size(0), 128, 3, 3)
        h = self.upsample(h)
        h = F.relu(self.deconv1(h))
        h = F.relu(self.deconv2(h))
        h = torch.sigmoid(self.deconv3(h))
        return h


class MazeVAE(nn.Module):
    def __init__(self, grid_size=GRID_SIZE, latent_dim=LATENT_DIM):
        super().__init__()
        self.encoder = MazeEncoder(grid_size, latent_dim)
        self.decoder = MazeDecoder(grid_size, latent_dim)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + eps * std

    def forward(self, x, condition):
        mu, logvar = self.encoder(x, condition)
        z = self.reparameterize(mu, logvar)
        recon = self.decoder(z, condition)
        return recon, mu, logvar

    def generate(self, condition, num=1, device='cpu'):
        """Generate mazes at a target difficulty."""
        self.eval()
        with torch.no_grad():
            z = torch.randn(num, LATENT_DIM).to(device)
            c = torch.full((num,), condition, dtype=torch.float32).to(device)
            walls = self.decoder(z, c)
        return walls.cpu().numpy()


def vae_loss(recon, target, mu, logvar, beta=1.0):
    """Reconstruction + KL divergence loss."""
    recon_loss = F.binary_cross_entropy(recon, target, reduction='sum')
    kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return recon_loss + beta * kl_loss


def walls_to_maze(wall_probs, threshold=0.5):
    """Convert VAE output (4-channel probability grid) to a Maze object."""
    grid_size = wall_probs.shape[1]
    walls_np = np.full((grid_size, grid_size), 0, dtype=np.uint8)

    for y in range(grid_size):
        for x in range(grid_size):
            if wall_probs[0, y, x] > threshold:
                walls_np[y, x] |= TOP
            if wall_probs[1, y, x] > threshold:
                walls_np[y, x] |= RIGHT
            if wall_probs[2, y, x] > threshold:
                walls_np[y, x] |= BOTTOM
            if wall_probs[3, y, x] > threshold:
                walls_np[y, x] |= LEFT

    # enforce wall consistency (if cell A has right wall, cell B must have left wall)
    for y in range(grid_size):
        for x in range(grid_size):
            if x < grid_size - 1:
                has_right = bool(walls_np[y, x] & RIGHT)
                has_left = bool(walls_np[y, x + 1] & LEFT)
                if has_right != has_left:
                    # use the higher probability
                    if wall_probs[1, y, x] + wall_probs[3, y, x + 1] > 1.0:
                        walls_np[y, x] |= RIGHT
                        walls_np[y, x + 1] |= LEFT
                    else:
                        walls_np[y, x] &= np.uint8(~np.uint8(RIGHT))
                        walls_np[y, x + 1] &= np.uint8(~np.uint8(LEFT))
            if y < grid_size - 1:
                has_bottom = bool(walls_np[y, x] & BOTTOM)
                has_top = bool(walls_np[y + 1, x] & TOP)
                if has_bottom != has_top:
                    if wall_probs[2, y, x] + wall_probs[0, y + 1, x] > 1.0:
                        walls_np[y, x] |= BOTTOM
                        walls_np[y + 1, x] |= TOP
                    else:
                        walls_np[y, x] &= np.uint8(~np.uint8(BOTTOM))
                        walls_np[y + 1, x] &= np.uint8(~np.uint8(TOP))

    maze = Maze(cols=grid_size, rows=grid_size, walls=walls_np)

    # random start/end that are far apart
    rng = np.random.default_rng()
    best_start, best_end, best_dist = (0, 0), (grid_size-1, grid_size-1), 0
    for _ in range(20):
        sx, sy = int(rng.integers(grid_size)), int(rng.integers(grid_size))
        ex, ey = int(rng.integers(grid_size)), int(rng.integers(grid_size))
        d = abs(sx - ex) + abs(sy - ey)
        if d > best_dist:
            best_start, best_end, best_dist = (sx, sy), (ex, ey), d

    maze.start = best_start
    maze.end = best_end

    return maze


def train_vae(
    data_paths,
    epochs=100,
    batch_size=16,
    lr=1e-3,
    beta=0.5,
    device='cpu',
    verbose=True,
):
    """Train the VAE on maze data."""
    dataset = MazeDataset(data_paths)
    if verbose:
        print(f"Training data: {len(dataset)} mazes")

    # data augmentation: duplicate small dataset
    if len(dataset) < 100:
        orig_len = len(dataset)
        # add noisy copies
        noisy_mazes = dataset.mazes + np.random.uniform(0, 0.05, dataset.mazes.shape).astype(np.float32)
        noisy_mazes = np.clip(noisy_mazes, 0, 1)
        dataset.mazes = np.concatenate([dataset.mazes, noisy_mazes])
        dataset.scores = np.concatenate([dataset.scores, dataset.scores])
        if verbose:
            print(f"Augmented to {len(dataset)} samples (noise augmentation)")

    loader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = MazeVAE().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for epoch in range(epochs):
        model.train()
        total_loss = 0
        for batch_mazes, batch_scores in loader:
            batch_mazes = batch_mazes.to(device)
            batch_scores = batch_scores.to(device)

            recon, mu, logvar = model(batch_mazes, batch_scores)
            loss = vae_loss(recon, batch_mazes, mu, logvar, beta)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()

        if verbose and (epoch + 1) % 20 == 0:
            avg_loss = total_loss / len(dataset)
            print(f"  Epoch {epoch+1:3d}/{epochs} | Loss: {avg_loss:.2f}")

    return model


def generate_levels(model, num_levels=20, difficulty_range=(0.2, 1.0), device='cpu'):
    """Generate mazes at varying difficulties using the trained VAE."""
    model.eval()
    levels = []
    rng = np.random.default_rng(42)

    difficulties = np.linspace(difficulty_range[0], difficulty_range[1], num_levels)

    for i, diff in enumerate(difficulties):
        # generate multiple candidates, keep the best (solvable with highest actual difficulty)
        best_maze = None
        best_score = -1

        for attempt in range(10):
            wall_probs = model.generate(diff, num=1, device=device)
            maze = walls_to_maze(wall_probs[0], threshold=0.45 + diff * 0.1)

            solution = solve_bfs(maze)
            if not solution:
                continue

            metrics = compute_all_metrics(maze)
            score = difficulty_score(metrics)

            if score > best_score:
                best_maze = maze
                best_score = score

        if best_maze is None:
            continue

        # verify with simulated players
        sim = simulate_difficulty(best_maze, fog_radius=3.5 if diff > 0.5 else None, num_players=5, rng=rng)

        levels.append({
            "maze": best_maze,
            "difficulty_target": float(diff),
            "actual_score": float(best_score),
            "sim_deaths": float(sim["mean_deaths"]),
            "sim_completion": float(sim["completion_rate"]),
            "fog_radius": 3.5 if diff > 0.5 else None,
        })

        print(f"  Level {i+1}: target={diff:.2f}, score={best_score:.0f}, "
              f"deaths={sim['mean_deaths']:.1f}, completion={sim['completion_rate']:.0%}")

    return levels


def main():
    parser = argparse.ArgumentParser(description="Train maze VAE")
    parser.add_argument("--epochs", type=int, default=100)
    parser.add_argument("--generate", type=int, default=0)
    parser.add_argument("--output", type=str, default="levels/vae_generated.json")
    args = parser.parse_args()

    data_paths = []
    for p in ["levels/evolved_50.json", "levels/evolved_25.json", "levels/rl_placed_20.json"]:
        if os.path.exists(p):
            data_paths.append(p)

    if not data_paths:
        print("No training data found. Run evolution first.")
        return

    device = 'mps' if torch.backends.mps.is_available() else 'cpu'
    print(f"Device: {device}")

    model = train_vae(data_paths, epochs=args.epochs, device=device)

    # save model
    os.makedirs("ml/train/checkpoints", exist_ok=True)
    torch.save(model.state_dict(), "ml/train/checkpoints/maze_vae.pt")
    print("Model saved to ml/train/checkpoints/maze_vae.pt")

    if args.generate > 0:
        print(f"\nGenerating {args.generate} VAE levels...")
        levels = generate_levels(model, num_levels=args.generate, device=device)

        # export
        from ..export.to_json import export_levels
        from ..evolve.generator import Individual

        individuals = []
        for l in levels:
            metrics = compute_all_metrics(l["maze"], l["fog_radius"])
            metrics["sim_deaths"] = l["sim_deaths"]
            metrics["sim_completion"] = l["sim_completion"]
            ind = Individual(maze=l["maze"], fog_radius=l["fog_radius"],
                           fitness=l["actual_score"], metrics=metrics)
            individuals.append(ind)

        individuals.sort(key=lambda x: x.fitness)
        os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
        export_levels(individuals, args.output)

        print(f"\nAvg deaths: {np.mean([l['sim_deaths'] for l in levels]):.1f}")
        print(f"Avg completion: {np.mean([l['sim_completion'] for l in levels]):.0%}")


if __name__ == "__main__":
    main()
