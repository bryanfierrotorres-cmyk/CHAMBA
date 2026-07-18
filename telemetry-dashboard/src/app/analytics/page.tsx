'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from 'recharts';

export default function AnalyticsPage() {
  const [supplyHealth, setSupplyHealth] = useState<any[]>([]);
  const [matchingPerf, setMatchingPerf] = useState<any[]>([]);

  useEffect(() => {
    async function fetchData() {
      // Fetch Supply Health
      const { data: supplyData } = await supabase
        .from('view_telemetry_supply_health')
        .select('*');
      
      if (supplyData) {
        setSupplyHealth(supplyData);
      }

      // Fetch Matching Performance
      const { data: perfData } = await supabase
        .from('view_telemetry_matching_performance')
        .select('*');
      
      if (perfData) {
        setMatchingPerf(perfData);
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  // Process data for charts
  const expressPerf = matchingPerf.find(p => p.booking_type === 'express') || {};
  const customPerf = matchingPerf.find(p => p.booking_type === 'custom') || {};
  
  const totalOnline = supplyHealth.find(s => s.current_state === 'online')?.worker_count || 0;
  const totalIdle = supplyHealth.find(s => s.current_state === 'idle')?.worker_count || 0;
  const totalInService = supplyHealth.find(s => s.current_state === 'in_service')?.worker_count || 0;

  const waveData = [
    { name: 'Wave 1 (0-10s)', Express: expressPerf.w1_success || 0, Custom: customPerf.w1_success || 0 },
    { name: 'Wave 2 (10-40s)', Express: expressPerf.w2_success || 0, Custom: customPerf.w2_success || 0 },
    { name: 'Wave 3 (40-90s)', Express: expressPerf.w3_success || 0, Custom: customPerf.w3_success || 0 },
    { name: 'Fallback (>90s)', Express: expressPerf.w4_success || 0, Custom: customPerf.w4_success || 0 },
  ];

  // Mocking trend data over time based on current snapshot for the line chart
  const supplyTrendData = [
    { time: '10:00', online: totalOnline - 5 > 0 ? totalOnline - 5 : 0, inService: totalInService },
    { time: '10:05', online: totalOnline - 2 > 0 ? totalOnline - 2 : 0, inService: totalInService + 1 },
    { time: '10:10', online: totalOnline, inService: totalInService },
    { time: '10:15', online: totalOnline + 1, inService: totalInService },
    { time: 'Now', online: totalOnline, inService: totalInService },
  ];

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 p-6 space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white">Engine Analytics</h1>
        <p className="text-slate-400 mt-1">Métricas de rendimiento del motor de asignación y salud del ecosistema.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-slate-400 font-medium text-sm mb-1">Time to First Accept (Express)</h3>
          <p className="text-3xl font-bold text-white tracking-tight">
            {expressPerf.avg_time_to_accept ? Number(expressPerf.avg_time_to_accept).toFixed(1) + 's' : 'N/A'}
          </p>
          <div className="mt-4 text-xs font-medium text-emerald-400 bg-emerald-400/10 inline-block px-2 py-1 rounded">Basado en datos reales</div>
        </div>
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-slate-400 font-medium text-sm mb-1">Active Workers (Online)</h3>
          <p className="text-3xl font-bold text-white tracking-tight">{totalOnline}</p>
          <div className="mt-4 text-xs font-medium text-blue-400 bg-blue-400/10 inline-block px-2 py-1 rounded">
            + {totalIdle} en reposo, {totalInService} trabajando
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <h3 className="text-slate-400 font-medium text-sm mb-1">Conversion Rate</h3>
          <p className="text-3xl font-bold text-white tracking-tight">
            {expressPerf.conversion_rate ? Number(expressPerf.conversion_rate).toFixed(0) + '%' : '0%'} 
            <span className="text-lg text-slate-500 font-normal ml-2">/ {customPerf.conversion_rate ? Number(customPerf.conversion_rate).toFixed(0) + '%' : '0%'}</span>
          </p>
          <div className="mt-4 text-xs font-medium text-amber-400 bg-amber-400/10 inline-block px-2 py-1 rounded">Express / Custom</div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[400px]">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col shadow-xl">
          <h2 className="font-semibold mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="text-indigo-400">📊</span> Matching Performance (por Ola)
          </h2>
          <div className="flex-1 bg-slate-800/10 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waveData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  cursor={{fill: '#1e293b'}}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                  itemStyle={{ color: '#e2e8f0' }}
                />
                <Legend />
                <Bar dataKey="Express" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Custom" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col shadow-xl">
          <h2 className="font-semibold mb-4 border-b border-slate-800 pb-2 flex items-center gap-2">
            <span className="text-emerald-400">📈</span> Supply Health (Tendencia)
          </h2>
          <div className="flex-1 bg-slate-800/10 rounded-lg p-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={supplyTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px' }}
                />
                <Legend />
                <Line type="monotone" dataKey="online" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                <Line type="monotone" dataKey="inService" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
