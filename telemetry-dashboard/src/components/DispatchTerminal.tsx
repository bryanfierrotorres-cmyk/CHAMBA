'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type LogEvent = {
  id: string;
  timestamp: string;
  message: string;
};

export function DispatchTerminal() {
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Escuchar tabla jobs para interceptar nuevas solicitudes o cambios
    const channel = supabase.channel('telemetry-jobs-feed')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          const now = new Date();
          const timeString = now.toLocaleTimeString('es-NI', { hour12: false }) + '.' + now.getMilliseconds().toString().padStart(3, '0');
          
          let actionMsg = '';
          if (payload.eventType === 'INSERT') {
            actionMsg = `[BROADCAST] Nuevo Job #${payload.new.id.split('-')[0]} en Wave 1 (${payload.new.booking_type || 'custom'})`;
          } else if (payload.eventType === 'UPDATE') {
            if (payload.new.status === 'taken') {
              actionMsg = `[ATOMIC_LOCK] Job #${payload.new.id.split('-')[0]} tomado por ${payload.new.assigned_worker_id?.split('-')[0]}`;
            } else {
              actionMsg = `[STATE_CHANGE] Job #${payload.new.id.split('-')[0]} ➜ ${payload.new.status}`;
            }
          } else {
            actionMsg = `[DELETE] Job #${payload.old.id.split('-')[0]}`;
          }

          setLogs((prev) => [...prev, {
            id: Math.random().toString(),
            timestamp: timeString,
            message: actionMsg
          }].slice(-50)); // Mantener solo los últimos 50 eventos
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-xl h-full">
      <div className="p-4 border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <h2 className="font-semibold flex items-center gap-2 text-emerald-400">
          <span className="font-mono text-xs border border-emerald-400/30 bg-emerald-400/10 px-1 rounded">~</span> 
          Real-Time Dispatch Feed
        </h2>
      </div>
      <div 
        ref={scrollRef}
        className="flex-1 p-4 bg-black font-mono text-xs overflow-y-auto space-y-1"
      >
        <div className="text-emerald-500/80 mb-2">Conectando a Supabase Realtime... [OK]</div>
        <div className="text-emerald-500/80 mb-4">Escuchando eventos del Motor de Asignación en Managua...</div>
        
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3">
            <span className="text-emerald-600 shrink-0">[{log.timestamp}]</span>
            <span className="text-emerald-400">{log.message}</span>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-emerald-400/50 mt-4 animate-pulse">Esperando actividad en la base de datos...</div>
        )}
      </div>
    </div>
  );
}
