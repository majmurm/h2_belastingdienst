import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from collections import defaultdict

# Import your model (make sure the file is in the same directory)
from Model_behavioral_1 import SMEComplianceModel, report_tax_gap

# ============================================================================
# PAGE CONFIG
# ============================================================================
st.set_page_config(
    page_title="Belastingdienst - Strategy Simulation Tool",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ============================================================================
# CUSTOM CSS - Match Figma Design
# ============================================================================
st.markdown("""
<style>
    /* Import font */
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    
    /* Sidebar styling - darker navy blue */
    [data-testid="stSidebar"] {
        background-color: #1e3a5f;
    }
    
    [data-testid="stSidebar"] [data-testid="stMarkdownContainer"] p {
        color: #ffffff;
        font-family: 'Inter', sans-serif;
    }
    
    [data-testid="stSidebar"] h3 {
        color: #ffffff !important;
        font-family: 'Inter', sans-serif;
    }
    
    /* Main content background */
    .main {
        background-color: #f8fafc;
        font-family: 'Inter', sans-serif;
    }
    
    /* Custom card styling */
    .info-card {
        background-color: #e0f2fe;
        border: 1px solid #3b82f6;
        border-radius: 8px;
        padding: 20px;
        margin: 10px 0;
    }
    
    .metric-card {
        background-color: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        padding: 20px;
        margin: 10px 0;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    /* Step header */
    .step-header {
        color: #3b82f6;
        font-weight: 600;
        font-size: 0.9rem;
        margin-bottom: 5px;
    }
    
    /* Section title */
    .section-title {
        color: #1e293b;
        font-size: 1.5rem;
        font-weight: 600;
        margin-bottom: 10px;
    }
    
    /* Hide default button styling */
    div[data-testid="stButton"] button {
        all: unset;
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 14px 18px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: 'Inter', sans-serif;
        font-size: 16px;
        font-weight: 500;
        color: #cbd5e1;
        background-color: transparent;
        border: 2px solid transparent;
        box-sizing: border-box;
    }
    
    /* Hover state for navigation buttons */
    div[data-testid="stButton"] button:hover {
        border: 2px solid #475569;
        color: #ffffff;
    }
    
    /* Active navigation button (primary) */
    div[data-testid="stButton"] button[kind="primary"] {
        background-color: #3b82f6 !important;
        color: #ffffff !important;
        border: 2px solid #3b82f6 !important;
    }
    
    div[data-testid="stButton"] button[kind="primary"]:hover {
        background-color: #2563eb !important;
        border: 2px solid #2563eb !important;
    }
    
    /* Primary action button (non-navigation) */
    .stButton>button:not([data-testid]) {
        background-color: #3b82f6;
        color: white;
        border-radius: 8px;
        padding: 12px 24px;
        font-weight: 500;
        border: none;
    }
    
    .stButton>button:not([data-testid]):hover {
        background-color: #2563eb;
    }
    
    /* Checkbox styling */
    .stCheckbox {
        padding: 8px 0;
    }
    
    /* White text for sidebar title */
    .sidebar-title {
        color: #ffffff !important;
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0;
        font-family: 'Inter', sans-serif;
    }
    
    .sidebar-subtitle {
        color: #94a3b8;
        font-size: 1.1rem;
        margin-top: 5px;
        font-family: 'Inter', sans-serif;
        font-weight: 400;
    }
    
    /* Step badge styling */
    .step-badge {
        background-color: rgba(59, 130, 246, 0.2);
        color: #93c5fd;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        display: inline-block;
    }
    
    .step-badge-active {
        background-color: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        display: inline-block;
    }
    
    /* Navigation button content wrapper */
    .nav-button-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
    }
    
    .nav-button-left {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .nav-icon {
        font-size: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
    }
</style>
""", unsafe_allow_html=True)

# ============================================================================
# SESSION STATE INITIALIZATION
# ============================================================================
if 'current_step' not in st.session_state:
    st.session_state.current_step = 1

if 'model' not in st.session_state:
    st.session_state.model = None

if 'simulation_run' not in st.session_state:
    st.session_state.simulation_run = False

if 'population_distribution' not in st.session_state:
    st.session_state.population_distribution = "Real-life Distribution"

if 'selected_sectors' not in st.session_state:
    st.session_state.selected_sectors = []

if 'selected_sizes' not in st.session_state:
    st.session_state.selected_sizes = []

if 'population_percentage' not in st.session_state:
    st.session_state.population_percentage = 5

if 'history_data' not in st.session_state:
    st.session_state.history_data = []

# ============================================================================
# HELPER FUNCTION FOR NAVIGATION BUTTONS
# ============================================================================
def nav_button(icon, label, step_text, is_active, key):
    """Create a custom navigation button with icon and step badge"""
    badge_class = "step-badge-active" if is_active else "step-badge"
    
    button_html = f"""
    <div class="nav-button-content">
        <div class="nav-button-left">
            <span class="nav-icon">{icon}</span>
            <span>{label}</span>
        </div>
        <span class="{badge_class}">{step_text}</span>
    </div>
    """
    
    return button_html

# ============================================================================
# SIDEBAR NAVIGATION
# ============================================================================
with st.sidebar:
    st.markdown('<p class="sidebar-title">Belastingdienst</p>', unsafe_allow_html=True)
    st.markdown('<p class="sidebar-subtitle">Strategy Simulation Tool</p>', unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)
    
    # Add CSS to ensure left alignment and proper spacing
    st.markdown("""
    <style>
        /* Ensure all sidebar buttons are left-aligned */
        div[data-testid="stSidebar"] button {
            text-align: left !important;
            justify-content: flex-start !important;
        }
        
        div[data-testid="stSidebar"] button p {
            text-align: left !important;
        }
    </style>
    """, unsafe_allow_html=True)
    
    # Population Selection
    is_active_1 = st.session_state.current_step == 1
    if st.button("Population Selection          Step 1", 
                 key="nav_step1_click", use_container_width=True, 
                 type="primary" if is_active_1 else "secondary"):
        st.session_state.current_step = 1
        st.rerun()
    
    # Strategy Selection  
    is_active_2 = st.session_state.current_step == 2
    if st.button("Strategy Selection            Step 2", 
                 key="nav_step2_click", use_container_width=True,
                 type="primary" if is_active_2 else "secondary"):
        st.session_state.current_step = 2
        st.rerun()
    
    # Results
    is_active_3 = st.session_state.current_step == 3
    if st.button("Results                       Step 3", 
                 key="nav_step3_click", use_container_width=True,
                 type="primary" if is_active_3 else "secondary"):
        st.session_state.current_step = 3
        st.rerun()
    
    # Compare (no step number)
    is_active_4 = st.session_state.current_step == 4
    if st.button("Compare", key="nav_step4_click", use_container_width=True,
                 type="primary" if is_active_4 else "secondary"):
        st.session_state.current_step = 4
        st.rerun()
    
    # History (no step number)
    is_active_5 = st.session_state.current_step == 5
    if st.button("History", key="nav_step5_click", use_container_width=True,
                 type="primary" if is_active_5 else "secondary"):
        st.session_state.current_step = 5
        st.rerun()
    
    st.markdown("<br><br>", unsafe_allow_html=True)
    st.markdown("---")
    
    # Information about the model (as navigation button)
    is_active_6 = st.session_state.current_step == 6
    if st.button("Information about the model", key="nav_step6_click", use_container_width=True,
                 type="primary" if is_active_6 else "secondary"):
        st.session_state.current_step = 6
        st.rerun()
    
    st.markdown("---")
    
    st.markdown("Collapse")

# ============================================================================
# STEP 1: POPULATION SELECTION
# ============================================================================
if st.session_state.current_step == 1:
    st.markdown('<p class="step-header">Step 1</p>', unsafe_allow_html=True)
    st.markdown('<h1 class="section-title">Population Selection</h1>', unsafe_allow_html=True)
    st.markdown("Define the characteristics of the target enterprise population for the strategy simulation.")
    
    st.markdown("---")
    
    # Population Distribution
    st.markdown("### Population Distribution")
    
    col1, col2 = st.columns(2)
    
    with col1:
        if st.button("Real-life Distribution\n\nUse historical Dutch enterprise population data", 
                     use_container_width=True,
                     type="primary" if st.session_state.population_distribution == "Real-life Distribution" else "secondary",
                     key="dist_real"):
            st.session_state.population_distribution = "Real-life Distribution"
    
    with col2:
        if st.button("Manual Distribution\n\nCustomize enterprise characteristics manually", 
                     use_container_width=True,
                     type="primary" if st.session_state.population_distribution == "Manual Distribution" else "secondary",
                     key="dist_manual"):
            st.session_state.population_distribution = "Manual Distribution"
    
    st.markdown("---")
    
    # Business Sector Selection
    st.markdown("### Business Sector Selection")
    st.markdown("Select which business sectors to include in the simulation population.")
    
    sectors = [
        "All Sectors",
        "Retail & Trade",
        "Business Services",
        "Construction",
        "Healthcare",
        "Hospitality & Tourism",
        "Manufacturing",
        "Transport",
        "ICT & IT",
        "Other"
    ]
    
    col1, col2 = st.columns(2)
    
    for i, sector in enumerate(sectors):
        if i % 2 == 0:
            with col1:
                if st.checkbox(sector, key=f"sector_{i}"):
                    if sector not in st.session_state.selected_sectors:
                        st.session_state.selected_sectors.append(sector)
                else:
                    if sector in st.session_state.selected_sectors:
                        st.session_state.selected_sectors.remove(sector)
        else:
            with col2:
                if st.checkbox(sector, key=f"sector_{i}"):
                    if sector not in st.session_state.selected_sectors:
                        st.session_state.selected_sectors.append(sector)
                else:
                    if sector in st.session_state.selected_sectors:
                        st.session_state.selected_sectors.remove(sector)
    
    st.markdown("---")
    
    # Business Size Selection
    st.markdown("### Business Size Selection")
    st.markdown("Select which business sizes to include in the simulation population.")
    
    sizes = ["All Sizes", "Micro (2-9)", "Small (10-49)", "Medium (50-249)"]
    
    col1, col2 = st.columns(2)
    
    for i, size in enumerate(sizes):
        if i % 2 == 0:
            with col1:
                if st.checkbox(size, key=f"size_{i}"):
                    if size not in st.session_state.selected_sizes:
                        st.session_state.selected_sizes.append(size)
                else:
                    if size in st.session_state.selected_sizes:
                        st.session_state.selected_sizes.remove(size)
        else:
            with col2:
                if st.checkbox(size, key=f"size_{i}"):
                    if size not in st.session_state.selected_sizes:
                        st.session_state.selected_sizes.append(size)
                else:
                    if size in st.session_state.selected_sizes:
                        st.session_state.selected_sizes.remove(size)
    
    st.markdown("---")
    
    # Population Size
    st.markdown("### Population Size")
    
    st.markdown("#### Size Adjustment")
    
    percentage = st.slider(
        "Adjust the target population size based on selected sectors.",
        min_value=1,
        max_value=10,
        value=st.session_state.population_percentage,
        format="%d%%",
        key="pop_slider"
    )
    st.session_state.population_percentage = percentage
    
    # Calculate population
    base_population = 76500  # Real-life population from Figma
    calculated_population = int(base_population * (percentage / 100))
    
    st.markdown(f'<div class="metric-card">', unsafe_allow_html=True)
    col1, col2 = st.columns(2)
    with col1:
        st.markdown("**Calculated Population Size**")
    with col2:
        st.markdown(f"**{calculated_population:,} enterprises**")
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Agent Population Size Summary
    st.markdown("### Agent Population Size")
    
    st.markdown(f'<div class="info-card">', unsafe_allow_html=True)
    st.markdown(f"#### Real-life Population Size: **{base_population:,} enterprises**")
    st.markdown("Based on your selected sectors and business sizes from Dutch enterprise data.")
    st.markdown("*Source: CBS Statistics Netherlands*")
    st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown(f"#### Agent Population (% of real-life population): **{percentage}%**")
    
    # Slider visualization
    st.slider(
        "",
        min_value=1,
        max_value=10,
        value=percentage,
        disabled=True,
        label_visibility="collapsed"
    )
    
    st.markdown("Select between 1% and 10% of the real-life population for simulation. Larger populations increase accuracy but require more computational resources.")
    
    # Metrics cards
    col1, col2 = st.columns(2)
    
    with col1:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.markdown("**Agent Population Size**")
        agent_pop = int(calculated_population * 0.05)  # 5% default
        st.markdown(f"# {agent_pop:,}")
        st.markdown("*agents to simulate*")
        st.markdown('</div>', unsafe_allow_html=True)
    
    with col2:
        st.markdown('<div class="metric-card">', unsafe_allow_html=True)
        st.markdown("**Representation Ratio**")
        ratio = int(calculated_population / agent_pop) if agent_pop > 0 else 0
        st.markdown(f"# 1:{ratio}")
        st.markdown(f"*each agent represents ~{ratio} enterprises*")
        st.markdown('</div>', unsafe_allow_html=True)
    
    st.markdown("---")
    
    # Continue button
    col1, col2, col3 = st.columns([2, 1, 2])
    with col2:
        if st.button("Continue to Strategy Selection →", use_container_width=True, key="continue_step1"):
            st.session_state.current_step = 2
            st.rerun()

# ============================================================================
# STEP 2: STRATEGY SELECTION
# ============================================================================
elif st.session_state.current_step == 2:
    st.markdown('<p class="step-header">Step 2</p>', unsafe_allow_html=True)
    st.markdown('<h1 class="section-title">Strategy Selection</h1>', unsafe_allow_html=True)
    st.markdown("Configure audit strategy parameters and compliance model settings.")
    
    st.markdown("---")
    
    # Model Parameters
    st.markdown("### Model Parameters")
    
    col1, col2 = st.columns(2)
    
    with col1:
        C_target = st.slider("Target Compliance (C_target)", 0.0, 1.0, 0.924, 0.001)
        m_size = st.slider("Size Effect (m_size)", -0.5, 0.5, 0.1, 0.01)
        m_age = st.slider("Age Effect (m_age)", -0.5, 0.5, 0.1, 0.01)
        kappa = st.slider("Variance Parameter (kappa)", 1, 100, 50, 1)
    
    with col2:
        auditing_param = st.slider("Auditing Effect (b)", 0.0, 1.0, 0.9, 0.01)
        commun_param = st.slider("Communication Effect (d)", 0.0, 0.01, 0.0025, 0.0001)
        decay_factor = st.slider("Decay Factor", 0.0, 0.001, 0.0002, 0.00001)
        simulation_steps = st.slider("Simulation Steps (months)", 12, 120, 60, 12)
    
    st.markdown("---")
    
    # Audit Rates Configuration
    st.markdown("### Audit Rates by Segment")
    st.markdown("Configure audit rates for different business segments (size × age combinations).")
    
    # Create audit rates matrix
    sizes = ["Micro", "Small", "Medium"]
    ages = ["Young", "Mature", "Old"]
    
    audit_rates = {}
    
    st.markdown("#### Audit Rate Matrix (%)")
    
    # Create a table-like structure
    cols = st.columns([2] + [1]*3)
    cols[0].markdown("**Size / Age**")
    for i, age in enumerate(ages):
        cols[i+1].markdown(f"**{age}**")
    
    for size in sizes:
        cols = st.columns([2] + [1]*3)
        cols[0].markdown(f"**{size}**")
        for i, age in enumerate(ages):
            rate = cols[i+1].number_input(
                f"{size}_{age}",
                min_value=0.0,
                max_value=10.0,
                value=0.46,
                step=0.01,
                format="%.2f",
                label_visibility="collapsed",
                key=f"audit_{size}_{age}"
            )
            audit_rates[(size, age)] = rate / 100  # Convert to decimal
    
    st.markdown("---")
    
    # Run Simulation Button
    col1, col2, col3 = st.columns([1, 2, 1])
    with col2:
        if st.button("Run Simulation", use_container_width=True, type="primary", key="run_sim"):
            with st.spinner("Running simulation... This may take a moment."):
                # Calculate population size
                base_population = 76500
                calculated_population = int(base_population * (st.session_state.population_percentage / 100))
                N = int(calculated_population * 0.05)  # 5% for agent population
                
                # Initialize model
                model = SMEComplianceModel(
                    N=N,
                    size_shares={"Micro": 0.9683, "Small": 0.0248, "Medium": 0.0053},
                    age_shares={"Young": 0.57, "Mature": 0.04, "Old": 0.39},
                    C_target=C_target,
                    m_size=m_size,
                    m_age=m_age,
                    kappa=kappa,
                    audit_rates=audit_rates,
                    auditing_param=auditing_param,
                    commun_param=commun_param,
                    decay_factor=decay_factor,
                    seed=42
                )
                
                # Store initial state
                initial_propensities = {}
                for a in model.agents:
                    key = (a.size_cat, a.age_cat)
                    if key not in initial_propensities:
                        initial_propensities[key] = []
                    initial_propensities[key].append(a.propensity)
                
                # Run simulation
                history = []
                for step in range(simulation_steps):
                    model.step()
                    
                    # Collect metrics
                    total_prop = np.mean([a.propensity for a in model.agents])
                    history.append({
                        'step': step,
                        'mean_propensity': total_prop
                    })
                
                # Store results
                st.session_state.model = model
                st.session_state.simulation_run = True
                st.session_state.history_data.append({
                    'timestamp': pd.Timestamp.now(),
                    'parameters': {
                        'C_target': C_target,
                        'audit_param': auditing_param,
                        'steps': simulation_steps
                    },
                    'history': history,
                    'initial_propensities': initial_propensities
                })
                
                st.success("Simulation completed successfully!")
                
                # Auto-navigate to results
                st.session_state.current_step = 3
                st.rerun()

# ============================================================================
# STEP 3: RESULTS
# ============================================================================
elif st.session_state.current_step == 3:
    st.markdown('<p class="step-header">Step 3</p>', unsafe_allow_html=True)
    st.markdown('<h1 class="section-title">Simulation Results</h1>', unsafe_allow_html=True)
    
    if not st.session_state.simulation_run or st.session_state.model is None:
        st.warning("No simulation has been run yet. Please complete Step 2 first.")
        if st.button("Go to Strategy Selection", key="go_to_step2"):
            st.session_state.current_step = 2
            st.rerun()
    else:
        model = st.session_state.model
        
        # Key Metrics
        st.markdown("### Key Performance Indicators")
        
        col1, col2, col3, col4 = st.columns(4)
        
        # Calculate metrics
        mean_propensity = np.mean([a.propensity for a in model.agents])
        
        total_potential = sum(a.turnover * a.tax_rate for a in model.agents)
        total_actual = sum(a.turnover * a.tax_rate * a.propensity for a in model.agents)
        tax_gap = total_potential - total_actual
        gap_percentage = (tax_gap / total_potential) * 100 if total_potential > 0 else 0
        
        with col1:
            st.metric("Mean Compliance", f"{mean_propensity:.2%}", 
                     delta=None)
        
        with col2:
            st.metric("Tax Gap", f"€{tax_gap:,.0f}", 
                     delta=f"{gap_percentage:.1f}%", delta_color="inverse")
        
        with col3:
            strategic_agents = sum(1 for a in model.agents if a.agent_type == "Strategic")
            st.metric("Strategic Agents", f"{strategic_agents:,}", 
                     delta=f"{(strategic_agents/len(model.agents)*100):.1f}%")
        
        with col4:
            st.metric("Total Agents", f"{len(model.agents):,}")
        
        st.markdown("---")
        
        # Compliance Evolution
        st.markdown("### Compliance Propensity Over Time")
        
        if st.session_state.history_data:
            latest_run = st.session_state.history_data[-1]
            history_df = pd.DataFrame(latest_run['history'])
            
            fig = go.Figure()
            fig.add_trace(go.Scatter(
                x=history_df['step'],
                y=history_df['mean_propensity'],
                mode='lines',
                name='Mean Propensity',
                line=dict(color='#3b82f6', width=3)
            ))
            
            fig.update_layout(
                title="Average Compliance Propensity Evolution",
                xaxis_title="Simulation Step (months)",
                yaxis_title="Mean Propensity",
                hovermode='x unified',
                height=400
            )
            
            st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("---")
        
        # Propensity by Segment
        st.markdown("### Compliance by Business Segment")
        
        prop_by_group = defaultdict(list)
        for a in model.agents:
            prop_by_group[(a.size_cat, a.age_cat)].append(a.propensity)
        
        segment_data = []
        for (size, age), props in prop_by_group.items():
            segment_data.append({
                'Size': size,
                'Age': age,
                'Mean Propensity': np.mean(props),
                'Count': len(props)
            })
        
        segment_df = pd.DataFrame(segment_data)
        
        # Heatmap
        pivot_df = segment_df.pivot(index='Size', columns='Age', values='Mean Propensity')
        
        fig = go.Figure(data=go.Heatmap(
            z=pivot_df.values,
            x=pivot_df.columns,
            y=pivot_df.index,
            colorscale='RdYlGn',
            text=pivot_df.values,
            texttemplate='%{text:.2%}',
            textfont={"size": 14},
            colorbar=dict(title="Propensity")
        ))
        
        fig.update_layout(
            title="Mean Compliance Propensity by Segment",
            xaxis_title="Age Category",
            yaxis_title="Size Category",
            height=400
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("---")
        
        # Distribution Analysis
        col1, col2 = st.columns(2)
        
        with col1:
            st.markdown("### Propensity Distribution")
            propensities = [a.propensity for a in model.agents]
            
            fig = go.Figure(data=[go.Histogram(
                x=propensities,
                nbinsx=30,
                marker_color='#3b82f6'
            )])
            
            fig.update_layout(
                xaxis_title="Compliance Propensity",
                yaxis_title="Number of Agents",
                height=350
            )
            
            st.plotly_chart(fig, use_container_width=True)
        
        with col2:
            st.markdown("### Agent Type Distribution")
            
            agent_types = [a.agent_type for a in model.agents]
            type_counts = pd.Series(agent_types).value_counts()
            
            fig = go.Figure(data=[go.Pie(
                labels=type_counts.index,
                values=type_counts.values,
                hole=0.4,
                marker_colors=['#3b82f6', '#10b981']
            )])
            
            fig.update_layout(height=350)
            
            st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("---")
        
        # Detailed Table
        with st.expander("View Detailed Segment Statistics"):
            st.dataframe(
                segment_df.style.format({
                    'Mean Propensity': '{:.2%}',
                    'Count': '{:,.0f}'
                }),
                use_container_width=True
            )

# ============================================================================
# STEP 4: COMPARE
# ============================================================================
elif st.session_state.current_step == 4:
    st.markdown('<h1 class="section-title">Compare Scenarios</h1>', unsafe_allow_html=True)
    
    if len(st.session_state.history_data) < 2:
        st.info("Run multiple simulations to compare different scenarios. You need at least 2 simulation runs.")
        if st.button("Go to Strategy Selection to run more simulations", key="go_to_step2_compare"):
            st.session_state.current_step = 2
            st.rerun()
    else:
        st.markdown("### Compare Multiple Simulation Runs")
        
        # Plot all runs
        fig = go.Figure()
        
        for idx, run in enumerate(st.session_state.history_data):
            history_df = pd.DataFrame(run['history'])
            fig.add_trace(go.Scatter(
                x=history_df['step'],
                y=history_df['mean_propensity'],
                mode='lines',
                name=f"Run {idx+1} ({run['timestamp'].strftime('%H:%M:%S')})",
                line=dict(width=2)
            ))
        
        fig.update_layout(
            title="Compliance Propensity Comparison",
            xaxis_title="Simulation Step",
            yaxis_title="Mean Propensity",
            hovermode='x unified',
            height=500
        )
        
        st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("---")
        
        # Parameters comparison table
        st.markdown("### Scenario Parameters")
        
        comparison_data = []
        for idx, run in enumerate(st.session_state.history_data):
            params = run['parameters']
            final_prop = run['history'][-1]['mean_propensity']
            
            comparison_data.append({
                'Run': f"Run {idx+1}",
                'Time': run['timestamp'].strftime('%Y-%m-%d %H:%M:%S'),
                'C_target': params['C_target'],
                'Audit Param': params['audit_param'],
                'Steps': params['steps'],
                'Final Propensity': final_prop
            })
        
        comparison_df = pd.DataFrame(comparison_data)
        st.dataframe(
            comparison_df.style.format({
                'C_target': '{:.3f}',
                'Audit Param': '{:.3f}',
                'Final Propensity': '{:.2%}'
            }),
            use_container_width=True
        )

# ============================================================================
# STEP 5: HISTORY
# ============================================================================
elif st.session_state.current_step == 5:
    st.markdown('<h1 class="section-title">Simulation History</h1>', unsafe_allow_html=True)
    
    if not st.session_state.history_data:
        st.info("No simulations have been run yet.")
        if st.button("Go to Strategy Selection", key="go_to_step2_history"):
            st.session_state.current_step = 2
            st.rerun()
    else:
        st.markdown(f"### Total Simulations Run: {len(st.session_state.history_data)}")
        
        for idx, run in enumerate(reversed(st.session_state.history_data)):
            with st.expander(f"Run {len(st.session_state.history_data)-idx} - {run['timestamp'].strftime('%Y-%m-%d %H:%M:%S')}"):
                col1, col2, col3 = st.columns(3)
                
                params = run['parameters']
                final_prop = run['history'][-1]['mean_propensity']
                
                with col1:
                    st.metric("C_target", f"{params['C_target']:.3f}")
                with col2:
                    st.metric("Audit Param", f"{params['audit_param']:.3f}")
                with col3:
                    st.metric("Final Propensity", f"{final_prop:.2%}")
                
                # Mini chart
                history_df = pd.DataFrame(run['history'])
                fig = go.Figure()
                fig.add_trace(go.Scatter(
                    x=history_df['step'],
                    y=history_df['mean_propensity'],
                    mode='lines',
                    line=dict(color='#3b82f6', width=2)
                ))
                fig.update_layout(
                    xaxis_title="Step",
                    yaxis_title="Propensity",
                    height=250,
                    margin=dict(l=20, r=20, t=20, b=20)
                )
                st.plotly_chart(fig, use_container_width=True)
        
        st.markdown("---")
        if st.button("Clear History", type="secondary", key="clear_history"):
            st.session_state.history_data = []
            st.rerun()


# STEP 6: INFORMATION ABOUT THE MODEL
elif st.session_state.current_step == 6:
    st.markdown('<h1 class="section-title">Information about the Model</h1>', unsafe_allow_html=True)
    st.markdown("Understanding Agent-Based Modelling in the context of tax compliance simulation.")
    
    st.markdown("---")
    
    # Section 1
    st.markdown("### 1. What is Agent-Based Modelling (ABM)?")
    st.markdown("""
    Agent-Based Modelling is a simulation technique that focuses on the behavior of individual actors, referred to as agents, 
    rather than just looking at population averages. In this specific dashboard, the agents represent individual taxpayers 
    within the Netherlands.
    """)
    
    st.markdown("---")
    
    # Section 2
    st.markdown("### 2. How does it work?")
    st.markdown("""
    The model simulates a population where every agent makes their own decisions based on specific rules and behaviors (micro-level). 
    The dashboard allows you to introduce enforcement instruments, such as sending letters, making phone calls, or conducting 
    full audits. The system then calculates how these individual agents react to your interventions, aggregating these thousands 
    of small decisions to show the total tax compliance of the entire population (macro-level).
    """)
    
    st.markdown("---")
    
    # Section 3
    st.markdown("### 3. Why is it useful here?")
    st.markdown("""
    The Belastingdienst has limited resources and cannot audit everyone. This simulation provides a risk-free environment to 
    test scenarios. It allows experts to determine the most effective mix of instruments to maximize voluntary compliance 
    without having to test these strategies on real people first.
    """)
    
    st.markdown("---")
    
    # Section 4
    st.markdown("### 4. Why does it fit the problem?")
    st.markdown("""
    Taxpayers are not a uniform group and they react differently to interventions. For example, a fraudster might not be 
    impressed by a letter, whereas a citizen who finds tax laws complicated might benefit greatly from a helping phone call. 
    This model captures that complexity. It helps identify exactly which resources should be deployed for which types of 
    people to achieve the best results.
    """)