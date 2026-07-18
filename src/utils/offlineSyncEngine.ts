import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@services/supabase';

const OFFLINE_QUEUE_KEY = '@offline_mutation_queue';

export interface OfflineMutation {
  id: string;
  action: 'create_job' | 'accept_job' | 'cancel_job';
  payload: any;
  retries: number;
  status: 'PENDING' | 'FAILED';
  timestamp: number;
}

export const getOfflineQueue = async (): Promise<OfflineMutation[]> => {
  try {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveOfflineQueue = async (queue: OfflineMutation[]) => {
  await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
};

export const enqueueOfflineMutation = async (action: OfflineMutation['action'], payload: any) => {
  const queue = await getOfflineQueue();
  const newMutation: OfflineMutation = {
    id: Math.random().toString(36).substring(7),
    action,
    payload,
    retries: 0,
    status: 'PENDING',
    timestamp: Date.now(),
  };
  await saveOfflineQueue([...queue, newMutation]);
  return newMutation;
};

export const processOfflineQueue = async (onHardFailure?: (msg: string) => void) => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  let queue = await getOfflineQueue();
  if (queue.length === 0) return;

  let hasFailures = false;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (item.status === 'FAILED') {
      hasFailures = true;
      continue;
    }

    try {
      if (item.action === 'accept_job') {
        const { error } = await supabase.rpc('accept_job', {
          p_job_id: item.payload.jobId,
          p_worker_id: item.payload.workerId,
        });
        if (error) throw error;
      } else if (item.action === 'create_job') {
        const { error } = await supabase.rpc('create_express_service', item.payload);
        if (error) throw error;
      } else if (item.action === 'cancel_job') {
        const { error } = await supabase.rpc('cancel_client_job', item.payload);
        if (error) throw error;
      }

      // Log success
      void supabase.from('analytics_events').insert({
        event_type: 'offline_mutation_synced',
        metadata: { action: item.action, retries: item.retries }
      });

      // Remove from queue
      queue = queue.filter(q => q.id !== item.id);
      i--;
    } catch (err: any) {
      item.retries += 1;
      if (item.retries >= 3) {
        item.status = 'FAILED';
        hasFailures = true;
        if (onHardFailure) {
          onHardFailure(`⚠️ Error crítico al procesar ${item.action}. Reintente manualmente.`);
        }
      }
    }
  }

  await saveOfflineQueue(queue);

  const hasPending = queue.some(q => q.status === 'PENDING');
  if (hasPending && !hasFailures) {
    // Backoff
    setTimeout(() => {
      void processOfflineQueue(onHardFailure);
    }, 5000);
  }
};
