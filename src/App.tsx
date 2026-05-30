import './polyfills/webGlobals';
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from '@navigation/RootNavigator';
import { getSupabaseConfigError, supabase, onAuthStateChange } from '@services/supabase';
import { useAuthStore } from '@store/authStore';
import { repairLocalAssignmentsStorage } from '@utils/localAssignments';
import { StartupErrorScreen } from '@components/StartupErrorScreen';
import { AppErrorBoundary } from '@components/AppErrorBoundary';
import { WEB_MOBILE_CSS, installWebViewportListeners, webMinViewportStyle } from '@constants/webMobileLayout';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:     2,
      staleTime: 30_000,
      gcTime:    5 * 60_000,
    },
  },
});

/** Viewport dinámico (100dvh + --chamba-vh) para Safari/Chrome móvil. */
function useWebRootStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    const style = document.createElement('style');
    style.setAttribute('data-chamba-root', 'true');
    style.textContent = WEB_MOBILE_CSS;
    document.head.appendChild(style);

    const removeViewportListeners = installWebViewportListeners();
    return () => {
      style.remove();
      removeViewportListeners();
    };
  }, []);
}

/** Evita bloqueo infinito en splash si Supabase/AsyncStorage tarda o no responde (web). */
function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function AppBootstrap() {
  const { setSession, setHydrated, setLoading, fetchProfile, loadFromStorage, reset } = useAuthStore();

  useWebRootStyles();

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const hydrationFailsafe = setTimeout(() => {
      if (!cancelled && !useAuthStore.getState().isHydrated) {
        console.warn('[App] hydration timeout — continuing without session');
        setLoading(false);
        setHydrated(true);
      }
    }, 6000);

    const bootstrap = async () => {
      try {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          const blob = localStorage.getItem('CHAMBA_WORKER_ASSIGNMENTS');
          if (blob && blob.length > 150_000) {
            await repairLocalAssignmentsStorage();
          }
        }

        const foundPilot = await withTimeout(loadFromStorage(), 3000, false);
        if (cancelled) return;

        if (!foundPilot) {
          const { data: { session } } = await withTimeout(
            supabase.auth.getSession(),
            8000,
            { data: { session: null }, error: null },
          );
          if (cancelled) return;

          setSession(session);
          if (session?.user) {
            await withTimeout(fetchProfile(session.user.id), 8000, undefined);
          }
        }
      } catch (err) {
        console.warn('[App] bootstrap error:', err);
      } finally {
        clearTimeout(hydrationFailsafe);
        if (!cancelled) {
          setLoading(false);
          setHydrated(true);
        }
      }

      if (cancelled) return;

      subscription = onAuthStateChange(async (event, session) => {
        const { isPhoneAuth, isHydrated } = useAuthStore.getState();
        if (isPhoneAuth) return;

        if (session?.user) {
          setSession(session);
          await fetchProfile(session.user.id);
          if (!isHydrated) setHydrated(true);
          return;
        }

        if (event === 'SIGNED_OUT') {
          reset();
        }
      });
    };

    bootstrap();

    return () => {
      cancelled = true;
      clearTimeout(hydrationFailsafe);
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor="transparent" translucent />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const configError = getSupabaseConfigError();

  if (configError) {
    return <StartupErrorScreen message={configError} />;
  }

  return (
    <AppErrorBoundary>
      <AppBootstrap />
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...webMinViewportStyle,
    ...(Platform.OS === 'web' ? { height: '100dvh' as unknown as number, overflow: 'hidden' as const } : {}),
  },
});
