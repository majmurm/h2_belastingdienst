import { AlertCircle } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export function ExplainabilityPanel() {
  const shapData = [
    { feature: 'Audit Type Effects', impact: 0.28, color: '#ef4444' },
    { feature: 'Audit Rate (Base)', impact: 0.22, color: '#f59e0b' },
    { feature: 'Email Nudges', impact: 0.16, color: '#3b82f6' },
    { feature: 'Warning Letters', impact: 0.12, color: '#8b5cf6' },
    { feature: 'Physical Letters', impact: 0.09, color: '#10b981' },
    { feature: 'Compliance Decay', impact: -0.07, color: '#64748b' },
    { feature: 'Calendar Timing', impact: 0.06, color: '#ec4899' },
  ];

  return (
    <div className="p-12 max-w-6xl">
      <div className="mb-8">
        <h2 className="text-slate-900 mb-3">Explainability & Reasoning</h2>
        <p className="text-slate-600">
          Insight into which mechanisms drive compliance outcomes in this model
        </p>
      </div>

      {/* SHAP Values */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
        <h3 className="text-slate-900 text-base font-medium mb-4">Feature Importance (SHAP-style)</h3>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={shapData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} label={{ value: 'Impact on Outcome', position: 'insideBottom', offset: -5 }} />
            <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={140} />
            <Tooltip />
            <Bar dataKey="impact">
              {shapData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <p className="text-slate-600 mt-4">
          The chart shows conceptual influence of each intervention component. Positive values increase compliance, negative values decrease it.
        </p>
      </div>

      {/* Feature Explanations */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-slate-900 text-base font-medium mb-4">Top Positive Factors</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-900">Audit Type Effects</span>
                <span className="text-red-600">+0.28</span>
              </div>
              <p className="text-slate-600">
                Stronger audit types (Deep book, Corporate income tax) produce larger one-shot compliance gains.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-900">Audit Rate (Base)</span>
                <span className="text-orange-600">+0.22</span>
              </div>
              <p className="text-slate-600">
                Higher base audit rates translate into a stronger audit campaign spike.
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-900">Email Nudges</span>
                <span className="text-blue-600">+0.16</span>
              </div>
              <p className="text-slate-600">
                Timed reminder emails improve propensity leading up to the deadline.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-6">
          <h3 className="text-slate-900 text-base font-medium mb-4">Negative Factors</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-slate-900">Compliance Decay</span>
                <span className="text-slate-600">-0.07</span>
              </div>
              <p className="text-slate-600">
                Without interventions, compliance drifts downward each week.
              </p>
            </div>
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-amber-900 mb-1">Recommendation</p>
              <p className="text-amber-800">
                If decay dominates, increase communication intensity or the audit campaign rate to stabilize outcomes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Causal Graph */}
      <div className="bg-white rounded-lg border border-slate-200 p-8 mb-8">
        <h3 className="text-slate-900 text-base font-medium mb-4">Causal Relationships (Simplified)</h3>
        
        <div className="relative h-96 flex items-center justify-center">
          <svg width="100%" height="100%" viewBox="0 0 800 400" className="overflow-visible">
            {/* Nodes */}
            <g>
              {/* Input nodes */}
              <circle cx="100" cy="100" r="50" fill="#ef4444" opacity="0.2" stroke="#ef4444" strokeWidth="2" />
              <text x="100" y="105" textAnchor="middle" fontSize="12" fill="#1e293b">Audit Types</text>
              
              <circle cx="100" cy="200" r="40" fill="#f59e0b" opacity="0.2" stroke="#f59e0b" strokeWidth="2" />
              <text x="100" y="205" textAnchor="middle" fontSize="12" fill="#1e293b">Audit Rate</text>
              
              <circle cx="100" cy="300" r="35" fill="#3b82f6" opacity="0.2" stroke="#3b82f6" strokeWidth="2" />
              <text x="100" y="305" textAnchor="middle" fontSize="12" fill="#1e293b">Email Nudges</text>

              <circle cx="300" cy="100" r="30" fill="#8b5cf6" opacity="0.2" stroke="#8b5cf6" strokeWidth="2" />
              <text x="300" y="105" textAnchor="middle" fontSize="12" fill="#1e293b">Warnings</text>

              <circle cx="300" cy="200" r="25" fill="#10b981" opacity="0.2" stroke="#10b981" strokeWidth="2" />
              <text x="300" y="205" textAnchor="middle" fontSize="12" fill="#1e293b">Letters</text>

              <circle cx="300" cy="300" r="20" fill="#64748b" opacity="0.2" stroke="#64748b" strokeWidth="2" />
              <text x="300" y="305" textAnchor="middle" fontSize="12" fill="#1e293b">Decay</text>

              {/* Intermediate node */}
              <rect x="500" y="150" width="100" height="100" rx="10" fill="#3b82f6" opacity="0.1" stroke="#3b82f6" strokeWidth="2" />
              <text x="550" y="195" textAnchor="middle" fontSize="14" fill="#1e293b">Strategy</text>
              <text x="550" y="215" textAnchor="middle" fontSize="14" fill="#1e293b">Effect</text>

              {/* Output node */}
              <circle cx="700" cy="200" r="50" fill="#10b981" opacity="0.3" stroke="#10b981" strokeWidth="3" />
              <text x="700" y="200" textAnchor="middle" fontSize="14" fill="#1e293b">Compliance</text>
              <text x="700" y="220" textAnchor="middle" fontSize="14" fill="#1e293b">Mean Δ</text>
            </g>

            {/* Edges */}
            <g>
              <line x1="150" y1="100" x2="500" y2="180" stroke="#ef4444" strokeWidth="4" opacity="0.6" />
              <line x1="140" y1="200" x2="500" y2="200" stroke="#f59e0b" strokeWidth="3.5" opacity="0.6" />
              <line x1="135" y1="300" x2="500" y2="220" stroke="#3b82f6" strokeWidth="3" opacity="0.6" />
              <line x1="330" y1="100" x2="500" y2="170" stroke="#8b5cf6" strokeWidth="2.5" opacity="0.5" />
              <line x1="325" y1="200" x2="500" y2="200" stroke="#10b981" strokeWidth="2" opacity="0.5" />
              <line x1="320" y1="300" x2="500" y2="230" stroke="#64748b" strokeWidth="2" opacity="0.4" strokeDasharray="5,5" />
              <line x1="600" y1="200" x2="650" y2="200" stroke="#10b981" strokeWidth="5" opacity="0.7" />
            </g>

            {/* Arrowheads */}
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
              </marker>
            </defs>
          </svg>
        </div>

        <p className="text-slate-600 mt-4">
          Visual representation of how audit intensity, communication, and decay drive compliance outcomes.
        </p>
      </div>

      {/* Transparency Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 flex gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-slate-900 mb-1">Model Transparency</p>
          <p className="text-slate-700">
            This panel provides a qualitative view of the model levers. Use it as a guide to understand which interventions drive compliance most strongly.
          </p>
        </div>
      </div>
    </div>
  );
}
