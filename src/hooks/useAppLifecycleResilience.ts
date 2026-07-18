import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { useError } from '@context/ErrorContext';
import { processOfflineQueue } from '@utils/offlineSyncEngine';

export function useAppLifecycleResilience(navigationRef: any) {
  const lastSync = useRef(0);
  const { profile } = useAuthStore();
  const { setError } = useError();
  const wasOffline = useRef(false);

  useEffect(() => {
    // 1. Detección de Red y Banner
    const unsubscribeNet = NetInfo.addEventListener(state => {
      if (state.isConnected === false) {
        if (!wasOffline.current) {
          wasOffline.current = true;
          setError('⚠️ Sin conexión. Intentando reconectar...');
          
          if (profile?.id) {
            void supabase.from('analytics_events').insert({
              user_id: profile.id,
              event_type: 'offline_detected',
              metadata: { role: profile.role }
            });
          }
        }
      } else if (state.isConnected === true && wasOffline.current) {
        wasOffline.current = false;
        setError(null);
        
        // Procesar cola offline con callback para error fatal
        void processOfflineQueue((msg) => setError(msg));

        if (profile?.id) {
          void supabase.from('analytics_events').insert({
            user_id: profile.id,
            event_type: 'offline_recovered',
            metadata: { role: profile.role }
          });
        }
      }
    });

    return () => {
      unsubscribeNet();
    };
  }, [profile?.id, profile?.role, setError]);

  useEffect(() => {
    // 2. Rehidratación con Throttle
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        const now = Date.now();
        if (now - lastSync.current < 15000) {
          return; // Ignore si pasaron menos de 15s (TTL)
        }
        lastSync.current = now;

        if (!profile?.id) return;

        try {
          // Consultar si hay un trabajo en curso
          const { data, error } = await supabase
            .from('jobs')
            .select('id, status, assigned_worker_id, created_by')
            .in('status', ['assigned', 'taken', 'in_progress'])
            .or(`assigned_worker_id.eq.${profile.id},created_by.eq.${profile.id}`)
            .limit(1);

          if (error) throw error;

          if (data && data.length > 0) {
            const activeJob = data[0];
            
            // Log analytics
            void supabase.from('analytics_events').insert({
              user_id: profile.id,
              event_type: 'active_job_rehydrated',
              metadata: { job_id: activeJob.id, role: profile.role }
            });

            // Enrutar al trabajo activo de forma forzada
            if (navigationRef?.current) {
              if (profile.role === 'worker') {
                navigationRef.current.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'App',
                      state: {
                        routes: [
                          {
                            name: 'Trabajos',
                            state: {
                              routes: [
                                { name: 'MyJobs' }, // Back stack
                                { name: 'JobActive', params: { jobId: activeJob.id } }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                });
              } else if (profile.role === 'client') {
                navigationRef.current.reset({
                  index: 0,
                  routes: [
                    {
                      name: 'App',
                      state: {
                        routes: [
                          {
                            name: 'Mis Pedidos',
                            state: {
                              routes: [
                                { name: 'ClientOrders' }, // Back stack
                                { name: 'JobActive', params: { jobId: activeJob.id } }
                              ]
                            }
                          }
                        ]
                      }
                    }
                  ]
                });
              }
            }
          }
        } catch (err) {
          console.warn('[Resilience] Error al rehidratar:', err);
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [profile?.id, profile?.role, navigationRef]);
}
