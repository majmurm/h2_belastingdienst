"""
authors: Marco Maier, Despoina Delipalla, Marit van den Helder

Main file to run model and show results.
"""

import matplotlib.pyplot as plt
import matplotlib.animation as animation
from matplotlib.colors import Normalize
import numpy as np
from model import SMEAgent, SMEComplianceModel
from collections import Counter, defaultdict
import networkx as nx


def report_tax_gap(model, step_label):
    """Calculates and prints the difference between Potential and Actual Tax Revenue."""
    total_potential = 0.0
    total_actual = 0.0
    gap_by_size = defaultdict(lambda: {"potential": 0.0, "actual": 0.0})

    for a in model.agents:
        potential = a.turnover * a.tax_rate
        # Expected (on-time) payment under the incidence–intensity mapping
        unpaid = model.expected_unpaid_tax(a)
        actual = potential - unpaid
        
        total_potential += potential
        total_actual += actual

        gap_by_size[a.size_cat]["potential"] += potential
        gap_by_size[a.size_cat]["actual"] += actual

    total_gap = total_potential - total_actual
        
    #     tax_obligation = a.turnover * a.tax_rate
    #     actual_taxes_paid = tax_obligation* a.propensity * (1/6)
        
    #     total_tax_obligation += tax_obligation
    #     total_actual_taxes_paid += actual_taxes_paid

    #     gap_by_size[a.size_cat]["potential"] += tax_obligation
    #     gap_by_size[a.size_cat]["actual"] += actual_taxes_paid

    # total_gap = total_tax_obligation - actual_taxes_paid

    print(f"\n--- {step_label} TAX GAP ANALYSIS ---")
    print(f"Total Potential:  {total_potential:,.2f}")
    print(f"Total Collected:  {total_actual:,.2f}")
    print(f"TOTAL GAP:        {total_gap:,.2f}")
    print(f"Gap Percentage:   {(total_gap/total_potential)*100:.2f}%")

    return total_gap


# Helper to capture current propensity colors
def capture_state(model_instance):
    current_colors = []
    # Robustly map agents to nodes
    if len(model_instance.agents) == len(G.nodes()):
        for i in range(len(G.nodes())):
            current_colors.append(model_instance.agents[i].propensity)
    else:
        current_colors = [0.5] * len(G.nodes())
    return current_colors


# Number of Agents
N = 10000

# Demographics
size_shares = {"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053}
age_shares = {"Young": 0.57, "Mature": 0.04, "Old": 0.39}

# Compliance Targets (based on the mean of the Jaarreportage)
C_target = 0.693
# C_target = 0.924 # alternative for individuals

# # Audit Rates (Base Yearly Rates according to Jaarreportage) 8200 audits / 2,400,000 SMEs
# audit_rates = {
#     ("Micro", "Young"): 0.0046,
#     ("Micro", "Mature"): 0.0046,
#     ("Micro", "Old"): 0.0046,
#     ("Small", "Young"): 0.0046,
#     ("Small", "Mature"): 0.0046,
#     ("Small", "Old"): 0.0046,
#     ("Medium", "Young"): 0.0046,
#     ("Medium", "Mature"): 0.0046,
#     ("Medium", "Old"): 0.0046,
# }

audit_rates = {
    ("Micro", "Young"): 0.02,
    ("Micro", "Mature"): 0.02,
    ("Micro", "Old"): 0.02,
    ("Small", "Young"): 0.02,
    ("Small", "Mature"): 0.02,
    ("Small", "Old"): 0.02,
    ("Medium", "Young"): 0.02,
    ("Medium", "Mature"): 0.02,
    ("Medium", "Old"): 0.02,
}

# Distinct effects for different channels
# Original 'commun_param' was 0.008. We scale around that.
channel_effects = {
    "physical_letter": 0.003,  # Lowest effect
    "email": 0.008,  # Slightly higher (standard)
    "warning_letter": 0.020,  # At least double email
}

# Define 3 types of audits with different effects and costs
audit_types = {
    "Light": {"effect": 0.45, "cost": 2340},  # IH profit return check
    "Standard": {"effect": 0.45, "cost": 2340},  # corporate income tax return check
    "Deep": {
        "effect": 0.9,
        "cost": 4680,
    },  # book audit High cost for detailed audit 1 FTE hr = EUR20.11 --> 78hr per book audit (2024) --> EUR1,569 per audit
    # official source Belastingdienst: Scale 8, step 5 EUR3643 --> 1 FTE hr = EUR 21.07
    # according to Cees sources: EUR 60
}


# Define Costs (in EUR)
intervention_costs = {
    "email": 0.39,  # Minimal system cost (14.4 FTE hours * EUR60 + EUR3000 one-off system provider cost + EUR8 cost for 10k emails = EUR3872 --> EUR3872 / 10k agents = EUR0.39 per agent per eMail)
    "physical_letter": 0.65,  # Print + Postage (32*1.2 (overhead) FTE * EUR60 + EUR400 one-off system provider cost + EUR3000 cost for 10k letters = EUR6504 --> EUR6504 / 10k agents = EUR0.65 per agent per letter  )
    "warning_letter": 196.84,  # Letter (EUR16.84 + ~3hr FTE for hand delivery (60EUR) = 196.84) personalized letter: 14.4 FTE hours * EUR60 + EUR600 one-off system provider cost + EUR2.20 *100 agents = EUR1684 --> EUR1684 / 100 agents = EUR16.84 per agent per letter )
}

# 3. DEFINE THE SCHEDULE
    # Format: { Weeks_Before_Deadline: ["list", "of", "channels"] }
    # Users can choose any week (1-8).
    # NOTE: Any channel scheduled for week 1 is automatically treated as "Urgent" (2x effect).
communication_schedule = {
    8: ["physical_letter", "email"],    
    6: ["email"],
    2: ["physical_letter"],
    1: ["email"]                  # Automatically becomes urgent (2x effect), because it is one week before the deadline
}


# Model Initialization
print(f"Initializing Model with {N} agents...")
model = SMEComplianceModel(
    N=N,
    size_shares=size_shares,
    age_shares=age_shares,
    C_target=C_target,
    m_size=0.05,
    m_age=0.05,
    kappa=339,
    audit_rates=audit_rates,
    audit_types=audit_types,
    channel_effects=channel_effects,
    intervention_costs=intervention_costs,
    tax_gap_target_rate=0.05,
    noncompliance_target_rate=0.30,
    calibrate_baseline=True,
    # underpayment_mean_if_noncompliant=None  # leave None to calibrate to the 5% target given the liability-weighted noncompliance
    communication_schedule=communication_schedule,
    decay_factor=0.0005,
    seed=42,
)

#print("Total number of agents:", len(model.agents))

# 1. Capture Initial State
initial_means = {}
prop_by_group = defaultdict(list)

for a in model.agents:
    prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

print("\nInitial mean propensity per group:")
for (size, age), vals in sorted(prop_by_group.items()):
    mean_val = np.mean(vals)
    initial_means[(size, age)] = mean_val
    print(f"{size:7s} | {age:7s} | {mean_val:.4f}")

initial_total_mean = np.mean([a.propensity for a in model.agents])
print("\nInitial mean propensity (total):", initial_total_mean)

print("Initial non-compliance ratio (unweighted):", model.compute_noncompliance_ratio())
print("Initial tax gap rate (gross, expected):", model.compute_tax_gap_rate())
print("Calibrated mean underpayment | noncompliant:", model.underpayment_mean_if_noncompliant)


initial_gap = report_tax_gap(model, "INITIAL (Step 0)")


# # Pre-calculate graph layout so nodes don't jump around in the animation
# print("Calculating network layout...")
# G = model.grid.G
# # Seed identical to model seed
# pos = nx.spring_layout(G, k=0.05, iterations=30, seed=42)
# # Storage for animation frames
# snapshots = []
# # Capture Initial State (Week 0)
# snapshots.append({"step": 0, "colors": capture_state(model)})


# 2. Run Simulation
T = 208  # time steps in weeks

# # Calculate interval to get x FRAMES_WANTED frames + end state for GIF
# FRAMES_WANTED = 26
# snapshot_interval = max(1, int(T / FRAMES_WANTED))

for t in range(1, 1 + T):
    model.step()


# # Capture state based on dynamic interval
#     if t % snapshot_interval == 0:
#         print(f"  ...Snapshotting week {t}")
#         snapshots.append({"step": t, "colors": capture_state(model)})

# # Ensure we always capture the very last step if missed
# if snapshots[-1]["step"] != T:
#     snapshots.append({"step": T, "colors": capture_state(model)})


# 3. Final Reporting
print(f"\nMean propensity per group after {T} steps (with Change):")
print(f"{'Size':<7} | {'Age':<7} | {'Final':<8} | {'Change':<8}")
print("-" * 38)

prop_by_group.clear()
for a in model.agents:
    prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)

for (size, age), vals in sorted(prop_by_group.items()):
    final_mean = np.mean(vals)
    init_mean = initial_means.get((size, age), 0.0)
    change = final_mean - init_mean
    print(f"{size:7s} | {age:7s} | {final_mean:.4f}   | {change:+.4f}")

final_total_mean = np.mean([a.propensity for a in model.agents])
total_change = final_total_mean - initial_total_mean

print(f"\nFinal mean propensity (total): {final_total_mean:.4f}")
print("Final non-compliance ratio (unweighted):", model.compute_noncompliance_ratio())
print("Final tax gap rate (gross, expected):", model.compute_tax_gap_rate())
print(f"Total Change in Propensity:    {total_change:+.4f}")

# 5. FINAL TAX GAP
final_gap = report_tax_gap(model, f"FINAL (Step {T})")


# 6. SUMMARY & ROI CALCULATION
reduction = initial_gap - final_gap
total_cost = model.total_compliance_costs
net_benefit = reduction - total_cost
roi_ratio = reduction / total_cost

print("\n" + "=" * 40)
print(f"Tax Gap Reduction:   € {reduction:,.2f}")
print(f"Total Intervention Cost: € {total_cost:,.2f}")
print("-" * 40)
print(f"Improvement:       {(reduction/initial_gap)*100:.2f}%")
print(f"Net Benefit:         € {net_benefit:,.2f}")
print(
    f"ROI Ratio (Return per €1 spent on interventions): € {roi_ratio:.2f}"
)  # ROI per USD spent by IRS: 2 - 12USD
print("=" * 40)


# 4. Visualization
df = model.datacollector.get_model_vars_dataframe()

fig, ax1 = plt.subplots(figsize=(14, 8), dpi=300)

# Plot Propensity on left axis
color = "tab:blue"
ax1.set_xlabel("Time (Weeks)")
ax1.set_ylabel("Mean Compliance Propensity", color=color, fontsize=12)
ax1.set_ylim(0.60, 1.00)  # Feel free to adjust

# Plot individual groups with thinner lines
for col in sorted(df.columns):
    if " - " in col:  # This selects "Micro - Young", "Small - Old", etc.
        # Style based on Advisor status
        if "NoAdvisor" in col:
            linestyle = ":"
            alpha = 0.6
            width = 1.5
        else:
            linestyle = "-"
            alpha = 0.8
            width = 1.5

        ax1.plot(
            df.index,
            df[col],
            label=col,
            linewidth=width,
            linestyle=linestyle,
            alpha=alpha,
        )

# Add the Global Mean as a thicker, distinct line
ax1.plot(
    df.index, df["Mean Propensity"], color="black", linewidth=2.5, label="Global Mean"
)

# Plot Audit % on right axis
ax2 = ax1.twinx()
color_audit = "tab:red"
ax2.set_ylabel("% Population Audited", color=color, fontsize=12)
# ax2.plot(df.index, df["% Audited"], color=color, linestyle='--', linewidth=2, label="% Audited")
ax2.fill_between(
    df.index, df["% Audited"], color=color_audit, alpha=0.3, label="% Audited"
)
ax2.tick_params(axis="y", labelcolor=color)
ax2.set_ylim(0, 0.15)  # Scale this so spikes don't overlap the blue line too much

# Combined Legend
lines1, labels1 = ax1.get_legend_handles_labels()
lines2, labels2 = ax2.get_legend_handles_labels()
# Place legend outside to the right so it doesn't cover the graph
ax1.legend(
    lines1 + lines2, labels1 + labels2, loc="upper left", bbox_to_anchor=(1.1, 1)
)

plt.title(
    "SME Tax Compliance: 5-Year Simulation\nStrategy: Pulsed Audits + Behavioral Nudges"
)
fig.tight_layout()
plt.grid(True, linestyle=":", alpha=0.6)
# plt.show()



# # 7. NETWORK ANIMATION (GIF) - FIXED VERSION
# print(f"\nGenerating Animation with {len(snapshots)} frames...")

# # Determine Color Scale
# all_props = [p for snap in snapshots for p in snap["colors"]]
# vmin = min(0.5, min(all_props)) if all_props else 0.0
# vmax = 1.0

# # Create a fixed normalization
# norm = Normalize(vmin=vmin, vmax=vmax)
# cmap = plt.cm.viridis

# # Pre-compute RGBA colors for all snapshots
# for snap in snapshots:
#     rgba = cmap(norm(snap["colors"]))
#     if hasattr(rgba, 'shape') and len(rgba.shape) == 2:
#         rgba[:, 3] = 0.9
#     snap["rgba_colors"] = rgba

# # Save each frame as a separate image
# import os
# os.makedirs("temp_frames", exist_ok=True)

# for frame_idx, data in enumerate(snapshots):
#     # Create a fresh figure for each frame
#     fig = plt.figure(figsize=(14, 12), dpi=150)
#     gs = fig.add_gridspec(1, 2, width_ratios=[20, 1], wspace=0.05)
#     ax = fig.add_subplot(gs[0])
#     cax = fig.add_subplot(gs[1])
    
#     # Draw network
#     nx.draw_networkx_nodes(
#         G, pos,
#         node_size=20,
#         node_color=data["rgba_colors"],
#         ax=ax,
#         edgecolors='gray',
#         linewidths=0.5
#     )
#     nx.draw_networkx_edges(G, pos, alpha=0.1, ax=ax, width=0.5)
    
#     # Title
#     ax.set_title(f"Week {data['step']}", fontsize=14, fontweight='bold')
#     ax.axis('off')
    
#     # Colorbar (same for every frame)
#     from matplotlib.cm import ScalarMappable
#     sm = ScalarMappable(cmap=cmap, norm=norm)
#     sm.set_array([])
#     cbar = fig.colorbar(sm, cax=cax)
#     cbar.set_label(f"Compliance\nPropensity", rotation=270, labelpad=20, fontsize=10)
#     cbar.set_ticks([vmin, 0.7, 0.8, 0.9, vmax])
#     cbar.set_ticklabels([f'{vmin:.1f}', '0.7', '0.8', '0.9', f'{vmax:.1f}'])
    
#     # Save frame
#     plt.savefig(f"temp_frames/frame_{frame_idx:03d}.png", dpi=100, bbox_inches='tight')
#     plt.close(fig)
#     print(f"  Saved frame {frame_idx+1}/{len(snapshots)}")

# # Combine frames into GIF using PIL
# from PIL import Image

# frames = []
# for frame_idx in range(len(snapshots)):
#     img = Image.open(f"temp_frames/frame_{frame_idx:03d}.png")
#     frames.append(img)

# # Save as GIF
# filename = "network_evolution.gif"
# frames[0].save(
#     filename,
#     save_all=True,
#     append_images=frames[1:],
#     duration=500,  # ms per frame
#     loop=0
# )

# # Clean up temp frames
# import shutil
# shutil.rmtree("temp_frames")

# print(f"Success! Saved {filename}")
