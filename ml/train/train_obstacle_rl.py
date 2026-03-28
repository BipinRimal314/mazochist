"""Train RL agent for obstacle placement using PPO.

The agent learns to place traps, fake exits, and one-way gates
on pre-generated mazes to maximize simulated player suffering.

Usage:
    python -m ml.train.train_obstacle_rl
    python -m ml.train.train_obstacle_rl --timesteps 50000 --grid-size 12 --fog 4.0
"""

import argparse
import os
import time
import numpy as np

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, DummyVecEnv
from stable_baselines3.common.callbacks import BaseCallback

from .maze_env import MazeObstaclePlacementEnv


class SufferingCallback(BaseCallback):
    """Log training progress."""

    def __init__(self, verbose=1):
        super().__init__(verbose)
        self.episode_rewards = []

    def _on_step(self):
        if self.locals.get("dones") is not None:
            for i, done in enumerate(self.locals["dones"]):
                if done:
                    info = self.locals["infos"][i]
                    ep_reward = self.locals.get("rewards", [0])[i]
                    self.episode_rewards.append(ep_reward)

        if len(self.episode_rewards) > 0 and self.num_timesteps % 1000 == 0:
            recent = self.episode_rewards[-20:]
            avg = np.mean(recent)
            if self.verbose:
                print(f"  Step {self.num_timesteps:6d} | Avg reward (last 20): {avg:.1f}")

        return True


def make_env(grid_size, max_placements, fog_radius, loop_pct, seed):
    """Create a closure that returns a new env instance."""
    def _init():
        env = MazeObstaclePlacementEnv(
            grid_size=grid_size,
            max_placements=max_placements,
            fog_radius=fog_radius,
            loop_pct=loop_pct,
            num_sim_players=3,  # fewer players during training for speed
        )
        env.reset(seed=seed)
        return env
    return _init


def train(
    grid_size=10,
    max_placements=6,
    fog_radius=None,
    loop_pct=0.1,
    total_timesteps=20000,
    num_envs=4,
    seed=42,
    output_dir="ml/train/checkpoints",
    verbose=True,
):
    """Train PPO agent on maze obstacle placement."""
    os.makedirs(output_dir, exist_ok=True)

    if verbose:
        print(f"Training obstacle placement agent")
        print(f"  Grid: {grid_size}x{grid_size}, Fog: {fog_radius}, Placements: {max_placements}")
        print(f"  Timesteps: {total_timesteps}, Envs: {num_envs}")
        print()

    # create vectorized environments
    env_fns = [make_env(grid_size, max_placements, fog_radius, loop_pct, seed + i) for i in range(num_envs)]
    vec_env = DummyVecEnv(env_fns)

    # PPO with tuned hyperparameters for this task
    model = PPO(
        "MlpPolicy",
        vec_env,
        learning_rate=3e-4,
        n_steps=256,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,
        gae_lambda=0.95,
        clip_range=0.2,
        ent_coef=0.05,  # higher entropy for exploration
        verbose=0,
        seed=seed,
        policy_kwargs={
            "net_arch": [256, 256],  # two hidden layers
        },
    )

    callback = SufferingCallback(verbose=verbose)

    start = time.time()
    model.learn(total_timesteps=total_timesteps, callback=callback)
    elapsed = time.time() - start

    # save model
    model_path = os.path.join(output_dir, f"obstacle_ppo_{grid_size}x{grid_size}")
    model.save(model_path)

    if verbose:
        print(f"\nTraining complete in {elapsed:.0f}s ({elapsed/60:.1f}m)")
        print(f"Model saved to {model_path}")

    vec_env.close()
    return model, model_path


def generate_with_model(model_path, grid_size=10, fog_radius=None, loop_pct=0.1, num_levels=10, seed=42):
    """Use a trained model to generate levels."""
    from ..simulate.maze import generate_maze, solve_bfs, add_loops
    from ..simulate.player import simulate_difficulty

    model = PPO.load(model_path)
    rng = np.random.default_rng(seed)
    levels = []

    for i in range(num_levels):
        env = MazeObstaclePlacementEnv(
            grid_size=grid_size,
            max_placements=8,
            fog_radius=fog_radius,
            loop_pct=loop_pct,
            num_sim_players=5,
        )
        obs, _ = env.reset(seed=int(rng.integers(2**31)))

        # let the agent place obstacles
        done = False
        while not done:
            action, _ = model.predict(obs, deterministic=False)
            obs, reward, done, truncated, info = env.step(action)

        # evaluate the final maze
        sim = simulate_difficulty(env.maze, fog_radius=fog_radius, num_players=10, rng=rng)

        levels.append({
            "maze": env.maze,
            "fog_radius": fog_radius,
            "reward": reward,
            "sim_deaths": sim["mean_deaths"],
            "sim_completion": sim["completion_rate"],
            "difficulty": sim["difficulty_score"],
        })

        print(f"  Level {i+1}: deaths={sim['mean_deaths']:.1f}, "
              f"completion={sim['completion_rate']:.0%}, reward={reward:.1f}")

    return levels


def main():
    parser = argparse.ArgumentParser(description="Train RL obstacle placement agent")
    parser.add_argument("--grid-size", type=int, default=10)
    parser.add_argument("--placements", type=int, default=6)
    parser.add_argument("--fog", type=float, default=None)
    parser.add_argument("--timesteps", type=int, default=20000)
    parser.add_argument("--envs", type=int, default=4)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--generate", type=int, default=0, help="Generate N levels with trained model after training")
    args = parser.parse_args()

    model, model_path = train(
        grid_size=args.grid_size,
        max_placements=args.placements,
        fog_radius=args.fog,
        total_timesteps=args.timesteps,
        num_envs=args.envs,
        seed=args.seed,
    )

    if args.generate > 0:
        print(f"\nGenerating {args.generate} levels with trained model...")
        levels = generate_with_model(
            model_path,
            grid_size=args.grid_size,
            fog_radius=args.fog,
            num_levels=args.generate,
        )
        print(f"\nAvg deaths: {np.mean([l['sim_deaths'] for l in levels]):.1f}")
        print(f"Avg completion: {np.mean([l['sim_completion'] for l in levels]):.0%}")


if __name__ == "__main__":
    main()
