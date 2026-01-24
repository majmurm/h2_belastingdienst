export function InformationPanel() {
  return (
    <div className="p-12 max-w-5xl mx-auto">
      <div className="mb-8">
        <h2 className="text-slate-900 mb-3">Information about the Model</h2>
        <p className="text-slate-600">
          Understanding the SME tax compliance simulation, interventions, and calendar.
        </p>
      </div>

      <div className="space-y-8">
        {/* Section 1 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            1. What is Agent-Based Modelling (ABM)?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Agent-Based Modelling is a simulation technique that focuses on the behavior of individual actors, referred to as agents, rather than just looking at population averages. In this dashboard, agents represent SMEs with size and age characteristics that influence compliance.
          </p>
        </div>

        {/* Section 2 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            2. How does the population get initialized?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            The model generates agents by size and age shares. Each agent receives a baseline compliance propensity drawn from a beta distribution. The target mean is controlled by C_target and the size/age gradients (m_size, m_age), while kappa controls dispersion.
          </p>
        </div>

        {/* Section 3 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            3. What drives behavior over time?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Each week, compliance can increase from audits and communications or decay naturally. Audits occur during a yearly campaign week and can be Light, Standard, or Deep with different effects and costs. Communications include physical letters, emails, and targeted warning letters, each with distinct effects and costs.
          </p>
        </div>

        {/* Section 4 */}
        <div className="bg-white rounded-lg border border-slate-200 p-8">
          <h3 className="text-slate-900 text-md font-medium mb-4">
            4. What do the outputs mean?
          </h3>
          <p className="text-slate-700 leading-relaxed">
            Results report mean compliance propensities by size and age group, audit coverage per step, tax gap (potential vs actual collections), total intervention costs, and ROI. These metrics help compare enforcement strategies and identify high-impact segments.
          </p>
        </div>
      </div>
    </div>
  );
}
