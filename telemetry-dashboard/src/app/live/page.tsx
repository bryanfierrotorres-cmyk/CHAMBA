import { DispatchTerminal } from '@/components/DispatchTerminal';

export default function LivePage() {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Live Operations Map</h1>
        <p className="text-slate-400 mt-1">Monitoreo en tiempo real de técnicos y solicitudes.</p>
      </header>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-10"></div>
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex justify-between items-center backdrop-blur-sm z-10">
            <h2 className="font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Mapa Geográfico
            </h2>
            <div className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-md">Managua, NI</div>
          </div>
          <div className="flex-1 p-6 flex items-center justify-center bg-slate-800/20">
            <p className="text-slate-500 font-mono text-sm">[Componente Mapbox/Leaflet Aquí]</p>
          </div>
        </div>

        <div className="h-full">
          <DispatchTerminal />
        </div>
      </div>
    </div>
  );
}
