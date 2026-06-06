import './polyfills/webGlobals'; // Metro: webGlobals.web.ts en web, stub vacío en nativo
import '@/setup/configureTextInputs';
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from '@navigation/RootNavigator';
import { getSupabaseConfigError, supabase, onAuthStateChange } from '@services/supabase';
import { initializeStripe } from '@services/stripe';
import { useAuthStore } from '@store/authStore';
import { repairLocalAssignmentsStorage } from '@utils/localAssignments';
import { StartupErrorScreen } from '@components/StartupErrorScreen';
import { AppErrorBoundary } from '@components/AppErrorBoundary';
import { usePreciosCatalogProbe } from '@features/catalog/hooks/usePreciosCatalogProbe';

function PreciosCatalogProbeRunner() {
  usePreciosCatalogProbe();
  return null;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry:     2,
      staleTime: 30_000,
      gcTime:    5 * 60_000,
    },
  },
});

/** Viewport dinámico (100dvh + --chamba-vh) — solo web. */
function useWebRootStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

    // Import dinámico: el módulo de layout web no se evalúa en Android/iOS.
    const { WEB_MOBILE_CSS, installWebViewportListeners } =
      require('@constants/webMobileLayout') as typeof import('@constants/webMobileLayout');

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
  const { setSession, setHydrated, setLoading, fetchProfile, reset, loadFromStorage } = useAuthStore();

  useWebRootStyles();

  useEffect(() => {
    void Font.loadAsync({
      ...Ionicons.font,
      ...MaterialCommunityIcons.font,
    }).catch((err) => {
      console.warn('[App] icon fonts load:', err);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    initializeStripe().catch((err) =>
      console.warn('[App] Stripe init failed:', err),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription: { unsubscribe: () => void } | null = null;

    const hydrationFailsafe = setTimeout(() => {
      if (!cancelled && !useAuthStore.getState().isHydrated) {
        console.warn('[App] hydration timeout — continuing without session');
        setLoading(false);
        setHydrated(true);
      }
    }, 4500);

    const bootstrap = async () => {
      try {
        if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
          const blob = localStorage.getItem('CHAMBA_WORKER_ASSIGNMENTS');
          if (blob && blob.length > 150_000) {
            await repairLocalAssignmentsStorage();
          }
        }

        const { data: { session } } = await withTimeout(
          supabase.auth.getSession(),
          8000,
          { data: { session: null }, error: null },
        );
        if (cancelled) return;

        setSession(session);
        if (!session?.user) {
          await loadFromStorage();
        } else if (session?.user) {
          const { fetchProfileByPhone } = await import('@utils/profileSync');
          const metaPhone = session.user.phone?.replace(/\D/g, '').slice(-8);
          const byPhone = metaPhone ? await fetchProfileByPhone(metaPhone) : null;
          if (byPhone) {
            let restored = byPhone;
            if (restored.role === 'worker') {
              const { applyPilotProfile } = await import('@utils/pilotAccess');
              const { ensureProfileInDb } = await import('@utils/profileSync');
              restored = applyPilotProfile(restored);
              await ensureProfileInDb(restored);
            }
            useAuthStore.getState().setProfile(restored);
          } else {
            await withTimeout(fetchProfile(session.user.id), 8000, undefined);
            const p = useAuthStore.getState().profile;
            if (p?.role === 'worker') {
              const { applyPilotProfile } = await import('@utils/pilotAccess');
              const { ensureProfileInDb } = await import('@utils/profileSync');
              await ensureProfileInDb(applyPilotProfile({ ...p, id: session.user.id }));
            }
          }
          useAuthStore.getState().setPhoneAuth(false);
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
        if (event === 'SIGNED_OUT') {
          reset();
          return;
        }

        const { isPhoneAuth, isHydrated } = useAuthStore.getState();
        if (isPhoneAuth) return;

        if (session?.user) {
          setSession(session);
          await fetchProfile(session.user.id);
          if (!isHydrated) setHydrated(true);
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
          {__DEV__ ? <PreciosCatalogProbeRunner /> : null}
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
    ...(Platform.OS === 'web'
      ? {
          minHeight: '100dvh' as unknown as number,
          height: '100dvh' as unknown as number,
          overflow: 'hidden' as const,
        }
      : {}),
  },
});