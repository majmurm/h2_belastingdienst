import { ReactNode } from 'react';

interface TooltipProps {
  children: ReactNode;
  content: string;
}

export function Tooltip({ children, content }: TooltipProps) {
  return (
    <div className="relative group inline-block" style={{ zIndex: 9999 }}>
      {children}
      {/* Changed positioning:
         - left-full: Moves it to the right of the container
         - top-1/2 -translate-y-1/2: Centers it vertically
         - ml-2: Adds small spacing
      */}
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-slate-900 text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap pointer-events-none" style={{ zIndex: 10000 }}>
        {content}
        
        {/* Changed Arrow:
           - right-full: Puts it on the left edge of the tooltip
           - border-r-slate-900: Makes it point LEFT
        */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 -mr-1 border-4 border-transparent border-r-slate-900"></div>
      </div>
    </div>
  );
}