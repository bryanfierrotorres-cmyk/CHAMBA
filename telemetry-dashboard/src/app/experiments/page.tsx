export default function ExperimentsPage() {
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Control A/B (Experiments)</h1>
        <p className="text-slate-400 mt-1">Comparativa en tiempo real de estrategias de asignación.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
        {/* Grupo A */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
          <div className="p-6 border-b border-slate-800 bg-slate-800/30">
            <h2 className="text-2xl font-bold text-white mb-1">Grupo A</h2>
            <p className="text-sm text-blue-400 font-mono">ESTRATEGIA: WAVES + DELAY</p>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tasa de Conversión</p>
              <p className="text-4xl font-bold text-white">62.4%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tasa de Cancelación</p>
              <p className="text-3xl font-semibold text-slate-200">14.1%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tiempo Promedio de Aceptación</p>
              <p className="text-3xl font-semibold text-slate-200">18.5s</p>
            </div>
          </div>
        </div>

        {/* Grupo B */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500"></div>
          <div className="p-6 border-b border-slate-800 bg-slate-800/30">
            <h2 className="text-2xl font-bold text-white mb-1">Grupo B</h2>
            <p className="text-sm text-amber-400 font-mono">ESTRATEGIA: INSTANT BROADCAST</p>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-6">
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tasa de Conversión</p>
              <p className="text-4xl font-bold text-white">58.9%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tasa de Cancelación</p>
              <p className="text-3xl font-semibold text-slate-200">22.4%</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Tiempo Promedio de Aceptación</p>
              <p className="text-3xl font-semibold text-slate-200">4.2s</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-300 mb-2">Conclusión del Test</h3>
        <p className="text-sm text-slate-400 leading-relaxed">
          El Grupo A experimenta tiempos de aceptación ligeramente más altos debido a los micro-delays de las olas, sin embargo, la tasa de cancelación es significativamente menor al dar tiempo a los clientes para evaluar postulantes (en el flujo Custom) o asignar al técnico con mejor performance (flujo Express).
        </p>
      </div>
    </div>
  );
}
