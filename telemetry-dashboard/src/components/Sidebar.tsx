import Link from 'next/link';

export function Sidebar() {
  return (
    <div className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center font-bold text-white">
            C
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Torre de Control</h1>
            <p className="text-xs text-slate-400">CHAMBA Telemetry</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        <Link 
          href="/live" 
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors group"
        >
          <span className="w-2 h-2 rounded-full bg-green-500 group-hover:animate-pulse"></span>
          <span className="font-medium">Live Map & Feed</span>
        </Link>
        <Link 
          href="/analytics" 
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          <span className="text-slate-500">📊</span>
          <span className="font-medium">Analytics</span>
        </Link>
        <Link 
          href="/experiments" 
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
        >
          <span className="text-slate-500">🧪</span>
          <span className="font-medium">A/B Experiments</span>
        </Link>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-800 text-xs">
          <p className="text-slate-400 mb-1">System Status</p>
          <div className="flex items-center justify-between">
            <span className="text-white">Motor Híbrido</span>
            <span className="text-emerald-400">Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
