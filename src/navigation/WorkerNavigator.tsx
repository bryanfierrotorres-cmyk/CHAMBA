import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { WhatsAppBubble } from '@components/WhatsAppBubble';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeScreen }                from '@features/jobs/screens/HomeScreen';
import { RadarInboxScreen }          from '@features/jobs/screens/RadarInboxScreen';
import { JobDetailScreen }           from '@features/jobs/screens/JobDetailScreen';
import { JobActiveScreen }           from '@features/jobs/screens/JobActiveScreen';
import { JobChatScreen }             from '@features/chat/screens/JobChatScreen';
import { MyJobsScreen }              from '@features/jobs/screens/MyJobsScreen';
import { WalletScreen }              from '@features/jobs/screens/WalletScreen';
import { ProfileScreen }             from '@features/workers/screens/ProfileScreen';
import { WorkerOnboardingScreen }    from '@features/workers/screens/WorkerOnboardingScreen';
import { WorkerTabBar }              from '@components/worker/WorkerTabBar';
import { useAuthStore }              from '@store/authStore';
import { WORKER_COLORS as COLORS, M3, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/workerTheme';
import { CARD_ELEVATION } from '@constants/stitchStyles';
import { WorkerThemeProvider } from '@constants/workerThemeContext';
import { webAppShellStyle, webTabScenePadding } from '@constants/webMobileLayout';
import { useAuthSessionWarmup } from '@/hooks/useAuthSessionWarmup';
import { useWorkerAssignmentsRealtime } from '@features/jobs/hooks/useWorkerAssignmentsRealtime';
import type { WorkerTabParamList, JobStackParamList, ProfileStackParamList } from '@/types';

const Tab   = createBottomTabNavigator<WorkerTabParamList>();
const Stack = createNativeStackNavigator<JobStackParamList>();
const ProfileStackNav = createNativeStackNavigator<ProfileStackParamList>();

// ─── Jobs stack (Feed → Detail) ───────────────────────────────────

const JobsStack: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <Stack.Screen name="JobList"    component={HomeScreen} />
    <Stack.Screen name="JobDetail"  component={JobDetailScreen} />
    <Stack.Screen name="JobMap"     component={JobDetailScreen} />
    <Stack.Screen name="JobActive"  component={JobActiveScreen} />
    <Stack.Screen name="JobChat"    component={JobChatScreen} />
  </Stack.Navigator>
);

const ProfileStack: React.FC = () => (
  <ProfileStackNav.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
    <ProfileStackNav.Screen name="ProfileMain" component={ProfileScreen} />
    <ProfileStackNav.Screen name="Onboarding"  component={WorkerOnboardingScreen} />
  </ProfileStackNav.Navigator>
);

// ─── Pending approval waiting screen ─────────────────────────────

const PendingApprovalScreen: React.FC = () => {
  const profile = useAuthStore((s) => s.profile);
  const { signOut } = useAuthStore();
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg.primary, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: COLORS.brand[50], alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <Ionicons name="time-outline" size={44} color={COLORS.brand[500]} />
      </View>
      <Text style={{ color: COLORS.text.primary, fontSize: 22, fontWeight: '900', textAlign: 'center', marginBottom: 12 }}>
        Revisando tus documentos
      </Text>
      <Text style={{ color: COLORS.text.secondary, fontSize: 15, textAlign: 'center', lineHeight: 22 }}>
        Tus documentos están siendo revisados por administración.{'\n\n'}
        Te notificaremos pronto para empezar a chambear ⚡
      </Text>
      <View style={{ marginTop: 28, backgroundColor: COLORS.brand[50], borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.brand[100], width: '100%' }}>
        <Text style={{ color: COLORS.text.secondary, fontSize: 13, textAlign: 'center' }}>
          ⏱ Tiempo estimado de revisión:{'\n'}
          <Text style={{ fontWeight: '800', color: COLORS.brand[600] }}>24 – 48 horas hábiles</Text>
        </Text>
      </View>
      <Text style={{ color: COLORS.text.muted, fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        Hola, {profile?.full_name?.split(' ')[0] ?? 'técnico'} 👋{'\n'}
        Tu solicitud fue recibida con éxito.
      </Text>
      <View style={{ marginTop: 32 }}>
        <Text
          onPress={signOut}
          style={{ color: COLORS.brand[400], fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' }}
        >
          Cerrar sesión
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────

// ─── Worker Tab Navigator ─────────────────────────────────────────

export const WorkerNavigator: React.FC = () => {
  const insets       = useSafeAreaInsets();
  const profile      = useAuthStore((s) => s.profile);

  const needsOnboarding =
    profile?.role === 'worker' &&
    !profile.is_approved &&
    profile.worker_status !== 'pending_approval' &&
    (profile.cedula_url == null || profile.record_policia_url == null);

  const isPendingApproval =
    !needsOnboarding &&
    profile?.role === 'worker' &&
    !profile.is_approved;

  useAuthSessionWarmup();
  useWorkerAssignmentsRealtime();

  return (
    <WorkerThemeProvider>
      {needsOnboarding && <WorkerOnboardingScreen />}
      {!needsOnboarding && isPendingApproval && <PendingApprovalScreen />}
      {!needsOnboarding && !isPendingApproval && (
        <View style={webAppShellStyle}>
          <Tab.Navigator
            initialRouteName="JobFeed"
            tabBar={(props) => <WorkerTabBar {...props} />}
            screenOptions={{ headerShown: false }}
            sceneContainerStyle={Platform.OS === 'web' ? { paddingBottom: webTabScenePadding(insets.bottom) } : undefined}
          >
            <Tab.Screen name="Home"    component={RadarInboxScreen} />
            <Tab.Screen name="MyJobs"  component={MyJobsScreen} />
            <Tab.Screen name="JobFeed" component={JobsStack} />
            <Tab.Screen name="Wallet"  component={WalletScreen} />
            <Tab.Screen name="Profile" component={ProfileStack} />
          </Tab.Navigator>
          <WhatsAppBubble bottom={insets.bottom + 100} />
        </View>
      )}
    </WorkerThemeProvider>
  );
};
