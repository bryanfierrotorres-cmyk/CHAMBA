import './polyfills/webGlobals';
import '@/setup/configureTextInputs';
import 'react-native-gesture-handler';

import React, { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
import { configurePushNotificationHandler, syncPushTokenForUser } from '@utils/pushNotifications';
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

function useWebRootStyles() {
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;

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

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

function AppBootstrap() {
  const { setSession, setHydrated, setLoading, fetchProfile, reset } = useAuthStore();
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useWebRootStyles();

  useEffect(() => {
    configurePushNotificationHandler();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    if (!isHydrated || !profile?.id) return;
    if (!session?.access_token) return;

    void syncPushTokenForUser(profile.id);
  }, [isHydrated, profile?.id, session?.access_token]);

  useEffect(() => {
    void Font.loadAsync({
      ...Ionicons.font,
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

    setLoading(false);
    setHydrated(true);

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
        if (session?.user) {
          await withTimeout(fetchProfile(session.user.id), 8000, undefined);
        }
      } catch (err) {
        console.warn('[App] bootstrap error:', err);
      } finally {
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

        if (event === 'TOKEN_REFRESHED' && session) {
          setSession(session);
          return;
        }

        if (session?.user) {
          setSession(session);
          const { profile: currentProfile } = useAuthStore.getState();
          if (!currentProfile || currentProfile.id !== session.user.id) {
            await fetchProfile(session.user.id);
          }
        }
      });
    };

    void bootstrap();

    return () => {
      cancelled = true;
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

import { ErrorProvider } from './context/ErrorContext';
import { ErrorBanner } from './components/shared/ErrorBanner';

export default function App() {
  const configError = getSupabaseConfigError();

  if (configError) {
    return <StartupErrorScreen message={configError} />;
  }

  return (
    <ErrorProvider>
      <ErrorBanner />
      <AppErrorBoundary>
        <AppBootstrap />
      </AppErrorBoundary>
    </ErrorProvider>
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