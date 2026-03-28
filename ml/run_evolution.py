#!/usr/bin/env python3
"""Run evolutionary maze generation across all difficulty eras.

Generates 100 evolved levels (10 per difficulty tier, 10 tiers).
Each tier runs an independent evolutionary search with increasing parameters.

Usage:
    python -m ml.run_evolution
    python -m ml.run_evolution --tiers 3 --per-tier 5  # quick test
"""

import argparse
import time
from ml.evolve.generator import evolve
from ml.export.to_json import export_levels


# 10 difficulty tiers with escalating parameters
TIERS = [
    {"cols": 8,  "rows": 8,  "fog": None, "traps": 0,  "gates": 0, "fakes": 0,  "loops": 0.05, "gens": 30},
    {"cols": 10, "rows": 10, "fog": None, "traps": 0,  "gates": 0, "fakes": 2,  "loops": 0.08, "gens": 30},
    {"cols": 10, "rows": 10, "fog": None, "traps": 2,  "gates": 0, "fakes": 2,  "loops": 0.10, "gens": 40},
    {"cols": 12, "rows": 12, "fog": 5.0,  "traps": 2,  "gates": 1, "fakes": 2,  "loops": 0.10, "gens": 40},
    {"cols": 12, "rows": 12, "fog": 4.0,  "traps": 3,  "gates": 1, "fakes": 3,  "loops": 0.10, "gens": 50},
    {"cols": 14, "rows": 14, "fog": 4.0,  "traps": 4,  "gates": 2, "fakes": 3,  "loops": 0.12, "gens": 50},
    {"cols": 14, "rows": 14, "fog": 3.0,  "traps": 5,  "gates": 2, "fakes": 4,  "loops": 0.12, "gens": 60},
    {"cols": 16, "rows": 16, "fog": 3.0,  "traps": 6,  "gates": 3, "fakes": 4,  "loops": 0.15, "gens": 60},
    {"cols": 18, "rows": 18, "fog": 2.5,  "traps": 8,  "gates": 3, "fakes": 5,  "loops": 0.15, "gens": 70},
    {"cols": 20, "rows": 20, "fog": 2.5,  "traps": 10, "gates": 4, "fakes": 6,  "loops": 0.15, "gens": 80},
]


def main():
    parser = argparse.ArgumentParser(description="Evolve maze levels")
    parser.add_argument("--tiers", type=int, default=10, help="Number of difficulty tiers (1-10)")
    parser.add_argument("--per-tier", type=int, default=10, help="Levels per tier")
    parser.add_argument("--pop-size", type=int, default=30, help="Population size for evolution")
    parser.add_argument("--output", type=str, default="levels/evolved.json", help="Output file")
    args = parser.parse_args()

    tiers = min(args.tiers, len(TIERS))
    all_individuals = []
    start = time.time()

    for tier_idx in range(tiers):
        tier = TIERS[tier_idx]
        print(f"\n{'='*60}")
        print(f"TIER {tier_idx + 1}/{tiers}")
        print(f"{'='*60}")

        population = evolve(
            cols=tier["cols"],
            rows=tier["rows"],
            fog_radius=tier["fog"],
            trap_count=tier["traps"],
            gate_count=tier["gates"],
            fake_exit_count=tier["fakes"],
            loop_pct=tier["loops"],
            population_size=args.pop_size,
            generations=tier["gens"],
            seed=tier_idx * 1000 + 42,
        )

        # take top N from this tier
        best = sorted(population, key=lambda x: x.fitness, reverse=True)[:args.per_tier]
        all_individuals.extend(best)

        elapsed = time.time() - start
        print(f"  Tier {tier_idx + 1} done. {len(best)} levels. Total time: {elapsed:.0f}s")

    # sort all by fitness for final ordering
    all_individuals.sort(key=lambda x: x.fitness)

    # export
    import os
    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    export_levels(all_individuals, args.output)

    total = time.time() - start
    print(f"\nTotal: {len(all_individuals)} levels evolved in {total:.0f}s ({total/60:.1f}m)")


if __name__ == "__main__":
    main()
