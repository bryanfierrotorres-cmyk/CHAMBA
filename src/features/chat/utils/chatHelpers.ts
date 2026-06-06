import type { JobStatus } from '@/types';

/** Chat disponible solo tras aprobación mutua (cliente eligió técnico). */
export const isJobChatWritable = (status?: JobStatus | null): boolean =>
  status === 'taken' || status === 'in_progress';

/** Lectura del historial tras finalizar. */
export const isJobChatReadable = (status?: JobStatus | null): boolean =>
  isJobChatWritable(status) || status === 'completed';

export const showJobChatEntry = (status?: JobStatus | null): boolean =>
  isJobChatReadable(status);

export interface ChatListItem {
  type: 'date' | 'message';
  id: string;
  dateLabel?: string;
  message?: import('@/types').ServiceMessage;
}

export const formatChatTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-NI', { hour: '2-digit', minute: '2-digit', hour12: false });
};

export const formatChatDateLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
  const diffDays = Math.round(
    (startOfDay(now).getTime() - startOfDay(d).getTime()) / 86_400_000,
  );

  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  return d.toLocaleDateString('es-NI', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
};

export const groupMessagesForList = (
  messages: import('@/types').ServiceMessage[],
): ChatListItem[] => {
  const items: ChatListItem[] = [];
  let lastDate = '';

  for (const msg of messages) {
    const dateLabel = formatChatDateLabel(msg.creado_al);
    if (dateLabel !== lastDate) {
      lastDate = dateLabel;
      items.push({ type: 'date', id: `date-${msg.creado_al.slice(0, 10)}`, dateLabel });
    }
    items.push({ type: 'message', id: msg.id, message: msg });
  }

  return items;
};
