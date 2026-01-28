"""
Adapter used by the dashboard API server.

This script imports the current model from the repository root
(`model.py`, `agents.py`, and configuration choices from
`report_results.py` where relevant) and exposes the same JSON contract
expected by the frontend.
"""

from __future__ import annotations

import argparse
import json
import sys
import io
import base64
import matplotlib
# Use 'Agg' backend to prevent GUI windows from trying to open on the server
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.colors import Normalize
from matplotlib.cm import ScalarMappable
import networkx as nx
from PIL import Image
from collections import defaultdict
from pathlib import Path
from typing import Any, Dict, Iterable, Mapping, Tuple

import numpy as np

# Ensure repository root is importable when run from dashboard/.
REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from model import SMEComplianceModel  # noqa: E402


GroupTuple = Tuple[str, str]


def _normalize_audit_rates(audit_rates: Mapping[Any, Any]) -> Dict[GroupTuple, float]:
    """Normalize audit rate keys into (size, age) tuples."""
    normalized: Dict[GroupTuple, float] = {}
    for key, value in audit_rates.items():
        if isinstance(key, (tuple, list)) and len(key) == 2:
            normalized[(str(key[0]), str(key[1]))] = float(value)
        elif isinstance(key, str) and "-" in key:
            size, age = key.split("-", 1)
            normalized[(size, age)] = float(value)
    return normalized


def generate_network_gif(model: SMEComplianceModel, snapshots: list) -> str | None:
    """
    Generates a Base64 encoded GIF of the network evolution.
    Uses the fixed-scale logic to ensure colors don't shift.
    """
    print(f"[PYTHON] DEBUG: Generating Network GIF... Frames={len(snapshots)}", file=sys.stderr)

    try:
        # 1. Determine Global Fixed Scale
        all_props = [p for snap in snapshots for p in snap["colors"]]
        vmin = min(0.5, min(all_props)) if all_props else 0.0
        vmax = 1.0
        
        norm = Normalize(vmin=vmin, vmax=vmax)
        cmap = plt.cm.viridis
        
        G = model.grid.G
        # Calculate layout once
        pos = nx.spring_layout(G, k=0.15, iterations=30, seed=42)

        frames = []

        # 2. Generate each frame in memory
        for data in snapshots:
            # Create a fresh figure for each frame
            fig = plt.figure(figsize=(20, 12), dpi=80) # Lower DPI for faster generation
            ax = fig.add_subplot(111)
            
            # Map values to RGBA colors using the fixed norm
            # We convert the list to a numpy array for the colormap function
            colors_array = np.array(data["colors"])
            rgba_colors = cmap(norm(colors_array))
            
            # Draw network
            nx.draw_networkx_nodes(
                G, pos,
                node_size=40,
                node_color=rgba_colors,
                ax=ax,
                edgecolors='gray',
                linewidths=0.5
            )
            nx.draw_networkx_edges(G, pos, alpha=0.1, ax=ax, width=0.5)
            
            # Title
            ax.set_title(f"Week {data['step']}", fontsize=14, fontweight='bold')
            ax.axis('off')
            
            # Add Colorbar (Optional for small GIF, but good for clarity)
            # We create a scalar mappable just for the colorbar
            sm = ScalarMappable(cmap=cmap, norm=norm)
            sm.set_array([])
            cbar = plt.colorbar(sm, ax=ax, fraction=0.046, pad=0.04)
            cbar.set_label(f"Compliance", rotation=270, labelpad=10, fontsize=8)
            
            # Save frame to memory buffer
            buf = io.BytesIO()
            plt.savefig(buf, format='png', bbox_inches='tight', pad_inches=0.1)
            plt.close(fig)
            buf.seek(0)
            
            # Open as PIL Image and append
            frames.append(Image.open(buf))

        if not frames:
            return None

        # 3. Save frames as GIF to memory
        gif_buf = io.BytesIO()
        frames[0].save(
            gif_buf,
            format='GIF',
            save_all=True,
            append_images=frames[1:],
            duration=1000, # 1 second per frame
            loop=0
        )
        gif_buf.seek(0)
        
        # 4. Encode to Base64
        encoded = base64.b64encode(gif_buf.read()).decode('utf-8')
        print("[PYTHON] DEBUG: GIF generation SUCCESSFUL", file=sys.stderr)
        return encoded

    except Exception as e:
        print(f"[PYTHON] DEBUG: GIF generation FAILED: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return None


def compute_tax_gap(model: SMEComplianceModel) -> Dict[str, Any]:
    """Compute tax gap totals and breakdowns."""
    total_potential = 0.0
    total_actual = 0.0

    gap_by_size: Dict[str, Dict[str, float]] = defaultdict(
        lambda: {"potential": 0.0, "actual": 0.0}
    )
    gap_by_group: Dict[GroupTuple, Dict[str, float]] = defaultdict(
        lambda: {"potential": 0.0, "actual": 0.0}
    )

    for agent in model.agents:
        potential = float(agent.turnover) * float(agent.tax_rate)
        actual = potential * float(agent.propensity)

        total_potential += potential
        total_actual += actual

        gap_by_size[agent.size_cat]["potential"] += potential
        gap_by_size[agent.size_cat]["actual"] += actual

        key = (agent.size_cat, agent.age_cat)
        gap_by_group[key]["potential"] += potential
        gap_by_group[key]["actual"] += actual

    total_gap = total_potential - total_actual
    gap_pct = (total_gap / total_potential * 100.0) if total_potential > 0 else 0.0

    def finalize(entry: Mapping[str, float]) -> Dict[str, float]:
        potential = float(entry["potential"])
        actual = float(entry["actual"])
        gap = potential - actual
        entry_gap_pct = (gap / potential * 100.0) if potential > 0 else 0.0
        return {
            "potential": potential,
            "actual": actual,
            "gap": gap,
            "gap_pct": entry_gap_pct,
        }

    by_size_out = {size: finalize(vals) for size, vals in gap_by_size.items()}
    by_group_out = {
        f"{size}-{age}": finalize(vals) for (size, age), vals in gap_by_group.items()
    }

    return {
        "total_potential": total_potential,
        "total_actual": total_actual,
        "total_gap": total_gap,
        "gap_pct": gap_pct,
        "by_size": by_size_out,
        "by_group": by_group_out,
    }


def collect_step_metrics(model: SMEComplianceModel) -> Dict[str, Any]:
    """Collect per-step metrics."""
    by_group_values: Dict[GroupTuple, list[float]] = defaultdict(list)
    all_propensities: list[float] = []
    high_compliance_count = 0

    for agent in model.agents:
        by_group_values[(agent.size_cat, agent.age_cat)].append(float(agent.propensity))
        all_propensities.append(float(agent.propensity))
        if float(agent.propensity) >= 0.8:
            high_compliance_count += 1

    mean_by_group = {
        f"{size}-{age}": float(np.mean(vals))
        for (size, age), vals in by_group_values.items()
    }

    overall_mean = float(np.mean(all_propensities)) if all_propensities else 0.0
    high_compliance_pct = (
        (high_compliance_count / model.N * 100.0) if model.N > 0 else 0.0
    )

    return {
        "overall_mean": overall_mean,
        "mean_by_group": mean_by_group,
        "overall_audited_pct": float(model.total_audited_this_step) * 100.0,
        "high_compliance_pct": high_compliance_pct,
        "tax_gap": compute_tax_gap(model),
        "total_cost": float(model.total_compliance_costs),
    }

def capture_state(model_instance, G_nodes):
    """Helper to capture colors for GIF."""
    current_colors = []
    if len(model_instance.agents) == len(G_nodes):
        for i in range(len(G_nodes)):
            current_colors.append(model_instance.agents[i].propensity)
    else:
        current_colors = [0.5] * len(G_nodes)
    return current_colors


def default_config() -> Dict[str, Any]:
    return {
        "N": 1000,
        "size_shares": {"Micro": 0.9662, "Small": 0.0279, "Medium": 0.0059},
        "age_shares": {"Young": 0.57, "Mature": 0.04, "Old": 0.39},
        "C_target": 0.693,
        "m_size": 0.05,
        "m_age": 0.05,
        "kappa": 339,
        "audit_rates": {
            "Micro-Young": 0.02,
            "Micro-Mature": 0.02,
            "Micro-Old": 0.02,
            "Small-Young": 0.02,
            "Small-Mature": 0.02,
            "Small-Old": 0.02,
            "Medium-Young": 0.02,
            "Medium-Mature": 0.02,
            "Medium-Old": 0.02,
        },
        "audit_types": {
            "Light": {"effect": 0.45, "cost": 500.0},
            "Standard": {"effect": 0.90, "cost": 775.0},
            "Deep": {"effect": 1.80, "cost": 1550.0},
        },
        "channel_effects": {
            "physical_letter": 0.003,
            "email": 0.008,
            "warning_letter": 0.020,
        },
        "intervention_costs": {
            "email": 0.05,
            "physical_letter": 0.85,
            "warning_letter": 20.96,
        },
        "decay_factor": 0.00005,
        "seed": 42,
        "steps": 260,
        "tax_deadline_week": 12,
        "audit_delay_weeks": 8,
        "warning_visit_week": 35,
    }


def run_simulation(config: Mapping[str, Any]) -> Dict[str, Any]:
    audit_rates = _normalize_audit_rates(config.get("audit_rates", {}))

    model = SMEComplianceModel(
        N=int(config["N"]),
        size_shares=dict(config["size_shares"]),
        age_shares=dict(config["age_shares"]),
        C_target=float(config["C_target"]),
        m_size=float(config["m_size"]),
        m_age=float(config["m_age"]),
        kappa=float(config["kappa"]),
        audit_rates=audit_rates,
        audit_types=dict(config["audit_types"]),
        channel_effects=dict(config["channel_effects"]),
        intervention_costs=dict(config["intervention_costs"]),
        decay_factor=float(config["decay_factor"]),
        seed=int(config["seed"]),
    )

    model.tax_deadline_week = int(config["tax_deadline_week"])
    model.audit_delay_weeks = int(config["audit_delay_weeks"])

    steps: list[Dict[str, Any]] = []
    
    # --- ANIMATION SETUP ---
    gif_snapshots = []
    # Capture G nodes once for the helper
    G_nodes = list(model.grid.G.nodes())
    
    # Snapshot config
    T = int(config["steps"])
    FRAMES_WANTED = 10
    snapshot_interval = max(1, int(T / FRAMES_WANTED))
    
    # Capture Step 0
    initial_metrics = collect_step_metrics(model)
    steps.append({"step": 0, **initial_metrics})
    gif_snapshots.append({"step": 0, "colors": capture_state(model, G_nodes)})

    # Run Simulation
    for _ in range(T):
        model.step()
        steps.append({"step": int(model.step_count), **collect_step_metrics(model)})
        
        # Capture frame for GIF
        if int(model.step_count) % snapshot_interval == 0:
            gif_snapshots.append({"step": int(model.step_count), "colors": capture_state(model, G_nodes)})

    # Ensure last frame is captured
    if gif_snapshots[-1]["step"] != T:
        gif_snapshots.append({"step": T, "colors": capture_state(model, G_nodes)})

    initial_gap = float(initial_metrics["tax_gap"]["total_gap"])
    final_gap = float(steps[-1]["tax_gap"]["total_gap"])
    reduction = initial_gap - final_gap
    total_cost = float(steps[-1]["total_cost"])
    net_benefit = reduction - total_cost
    roi_ratio = (reduction / total_cost) if total_cost > 0 else 0.0
    
    # Generate GIF
    network_gif = generate_network_gif(model, gif_snapshots)

    return {
        "config": {
            **dict(config),
            "audit_rates": {f"{size}-{age}": rate for (size, age), rate in audit_rates.items()},
        },
        "initial": {
            "overall_mean": initial_metrics["overall_mean"],
            "mean_by_group": initial_metrics["mean_by_group"],
            "tax_gap": initial_metrics["tax_gap"],
        },
        "steps": steps,
        "final": {
            **steps[-1],
            "network_gif": network_gif # Send GIF instead of static plot
        },
        "summary": {
            "tax_gap_reduction": reduction,
            "total_cost": total_cost,
            "net_benefit": net_benefit,
            "roi_ratio": roi_ratio,
        },
    }


def main(argv: Iterable[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--config", type=str)
    args = parser.parse_args(list(argv) if argv is not None else None)

    if not args.json:
        parser.error("This adapter is intended to be run with --json.")

    config = default_config()
    if args.config:
        with open(args.config, "r", encoding="utf-8") as handle:
            incoming = json.load(handle)
        config.update(incoming)

    results = run_simulation(config)
    print(json.dumps(results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())