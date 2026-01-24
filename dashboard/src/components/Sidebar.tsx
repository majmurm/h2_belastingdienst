import { Users, Target, BarChart3, ArrowLeftRight, History, ChevronLeft, ChevronRight, Landmark, Info } from 'lucide-react';

interface SidebarProps {
  activeView: 'population' | 'strategy' | 'results' | 'compare' | 'history' | 'information';
  onViewChange: (view: 'population' | 'strategy' | 'results' | 'compare' | 'history' | 'information') => void;
  currentStep: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({ activeView, onViewChange, currentStep, isCollapsed, onToggleCollapse }: SidebarProps) {
  const mainMenuItems = [
    { id: 'population' as const, label: 'Population Selection', icon: Users, step: 1 },
    { id: 'strategy' as const, label: 'Strategy Selection', icon: Target, step: 2 },
    { id: 'results' as const, label: 'Results', icon: BarChart3, step: 3 },
    { id: 'compare' as const, label: 'Compare', icon: ArrowLeftRight, step: null },
    { id: 'history' as const, label: 'History', icon: History, step: null },
  ];

  return (
    <aside className={`bg-[#0C3358] border-r border-[#0a2844] flex flex-col transition-all duration-300 relative ${
      isCollapsed ? 'w-16' : 'w-64'
    }`}>
      <div className={`${isCollapsed ? 'px-3' : 'px-6'} py-8 transition-all duration-300`}>
        {!isCollapsed && (
          <div className="mb-12">
            <h1 className="text-white mb-1">Belastingdienst</h1>
            <p className="text-blue-200">Strategy Simulation Tool</p>
          </div>
        )}
        
        {isCollapsed && (
          <div className="mb-12 flex justify-center">
            <div className="w-10 h-10 flex items-center justify-center text-white">
              <Landmark className="w-7 h-7" />
            </div>
          </div>
        )}
      </div>

      <nav className={`flex-1 space-y-2 ${isCollapsed ? 'px-3' : 'px-6'} transition-all duration-300`}>
        {mainMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left relative group ${
                isActive 
                  ? 'bg-blue-500 text-white' 
                  : 'text-blue-100 hover:bg-[#0f4170]'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} />
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.step && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      isActive ? 'bg-blue-600 text-white' : 'bg-[#0f4170] text-blue-200'
                    }`}>
                      Step {item.step}
                    </span>
                  )}
                </>
              )}
              
              {/* Tooltip for collapsed state */}
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                  {item.label}
                  {item.step && ` (Step ${item.step})`}
                </div>
              )}
            </button>
          );
        })}
      </nav>
      
      {/* Information About Model - Above the divider */}
      <div className={`${isCollapsed ? 'px-3' : 'px-6'} py-4 border-t border-[#0a2844] transition-all duration-300`}>
        <button
          onClick={() => onViewChange('information')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-left relative group ${
            activeView === 'information'
              ? 'bg-blue-500 text-white' 
              : 'text-blue-100 hover:bg-[#0f4170]'
          }`}
          title={isCollapsed ? 'Information about the model' : undefined}
        >
          <Info className={`w-4 h-4 flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`} />
          {!isCollapsed && (
            <span className="flex-1">Information about the model</span>
          )}
          
          {/* Tooltip for collapsed state */}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
              Information about the model
            </div>
          )}
        </button>
      </div>

      {/* Toggle Button at Bottom */}
      <div className={`${isCollapsed ? 'px-3' : 'px-6'} py-4 border-t border-[#0a2844] transition-all duration-300`}>
        <button
          onClick={onToggleCollapse}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-blue-100 hover:bg-[#0f4170] hover:text-white group relative ${
            isCollapsed ? 'justify-center' : ''
          }`}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <>
              <ChevronRight className="w-4 h-4" />
              <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                Expand sidebar
              </div>
            </>
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}