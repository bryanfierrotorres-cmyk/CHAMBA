import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore }    from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { registerForPushNotifications } from '@services/notifications';
import { AuthNavigator }   from './AuthNavigator';
import { WorkerNavigator } from './WorkerNavigator';
import { AdminNavigator }  from './AdminNavigator';
import { ClientNavigator } from './ClientNavigator';
import { SplashScreen }    from '@features/auth/screens/SplashScreen';
import type { RootStackParamList } from '@/types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { profile, isHydrated } = useAuthStore();
  const { loadProfile, loadStats }       = useProfileStore();
  const [splashDone, setSplashDone]      = useState(false);

  // Preload extended worker profile when a worker logs in
  useEffect(() => {
    if (profile?.id && profile.role === 'worker') {
      loadProfile(profile.id);
      loadStats(profile.id);
      registerForPushNotifications(profile.id).catch((err) => {
        console.warn('[RootNavigator] push registration failed:', err);
      });
    }
  }, [profile?.id, profile?.role]);

  // ── Splash: esperar animación + sesión restaurada ──────────────
  if (!splashDone || !isHydrated) {
    return (
      <SplashScreen
        authReady={isHydrated}
        onFinish={() => setSplashDone(true)}
      />
    );
  }

  // Phone-auth users have no Supabase session — profile alone is enough.
  const isAuthenticated = !!profile;

  // ── Pick the right navigator based on role ───────────────────
  //
  //  Unauthenticated  → AuthNavigator   (Login / Register / RoleSelection)
  //  role === 'admin' → AdminNavigator  (Dashboard / Publicar / Trabajadores / Perfil)
  //  role === 'worker'→ WorkerNavigator (Feed / Mis Chambas / Perfil)
  //  role === 'client'→ ClientNavigator (Servicios / Mis Pedidos / Perfil)
  //
  // Each navigator is mounted in exclusion; switching role in Supabase causes
  // Zustand to update `profile`, which triggers a re-render of this component
  // and cleanly unmounts the old navigator tree, mounting the new one.

  const AppNavigator = !isAuthenticated
    ? null
    : profile.role === 'admin'
      ? AdminNavigator
      : profile.role === 'client'
        ? ClientNavigator
        : WorkerNavigator; // default: worker (also covers unknown future roles)

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, animation: 'fade' }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <Stack.Screen
            name="App"
            component={AppNavigator!}
            // Key forces full remount when the role changes, ensuring
            // no cross-role screen leaks in the navigation state.
            key={profile.role}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};
