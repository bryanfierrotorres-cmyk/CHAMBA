import React, { useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { useProfileStore } from '@store/profileStore';
import { useTecnicoInicio } from '@features/jobs/hooks/useTecnicoInicio';
import { InicioHeader } from '@features/jobs/inicio/InicioHeader';
import { KpiGrid } from '@features/jobs/inicio/KpiGrid';
import { ZoneActivityCard, BestHourCard } from '@features/jobs/inicio/ZoneAndBestHour';
import { PromoBanner } from '@features/jobs/inicio/PromoBanner';
import { QuickActions, type QuickActionKey } from '@features/jobs/inicio/QuickActions';
import { RequestCard } from '@features/jobs/inicio/RequestCard';
import { WeeklyProgress } from '@features/jobs/inicio/WeeklyProgress';
import { INICIO } from '@features/jobs/inicio/inicioTheme';
import { RADIUS_OPTIONS_KM } from '@utils/workerSearchRadius';
import type { WorkerTabParamList } from '@/types';

const WEEKLY_JOBS_GOAL = 10;
const WEEKLY_EARN_GOAL = 5000;

const nextRadiusOption = (current: number): number =>
  RADIUS_OPTIONS_KM.find((k) => k > current) ?? current;

type Nav = BottomTabNavigationProp<WorkerTabParamList, 'Home'>;

export const RadarInboxScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  const profile = useAuthStore((s) => s.profile);
  const setAvailability = useProfileStore((s) => s.setAvailability);
  const isTogglingAvail = useProfileStore((s) => s.isTogglingAvail);

  const { data, isLoading, radiusKm, ratingAvg, fullName, avatarUrl, isOnline } = useTecnicoInicio();

  const handleToggleOnline = useCallback((next: boolean) => {
    if (!profile?.id) return;
    void setAvailability(profile.id, next ? 'available' : 'offline');
  }, [profile?.id, setAvailability]);

  const goRadar = useCallback(() => navigation.navigate('JobFeed'), [navigation]);

  const handleAction = useCallback((key: QuickActionKey) => {
    switch (key) {
      case 'radar': navigation.navigate('JobFeed'); break;
      case 'agenda': navigation.navigate('MyJobs'); break;
      case 'wallet': navigation.navigate('Wallet'); break;
      case 'stats': navigation.navigate('Wallet'); break;
      case 'profile': navigation.navigate('Profile'); break;
    }
  }, [navigation]);

  const openDetail = useCallback((jobId: string) => {
    navigation.navigate('JobFeed', { screen: 'JobDetail', params: { jobId } });
  }, [navigation]);

  const stats = data?.stats;
  const recent = data?.recentRequests ?? [];

  return (
    <View style={styles.root}>
      <InicioHeader
        topInset={insets.top}
        fullName={fullName}
        avatarUrl={avatarUrl}
        isOnline={isOnline}
        isToggling={isTogglingAvail}
        onToggleOnline={handleToggleOnline}
      />

      {isLoading && !data ? (
        <View style={styles.loading}>
          <ActivityIndicator color={INICIO.blue} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(320)}>
            <KpiGrid
              earningsToday={stats?.earningsToday ?? 0}
              earningsYesterday={stats?.earningsYesterday ?? 0}
              solicitudesHoy={data?.solicitudesHoy ?? 0}
              solicitudesNuevas={data?.solicitudesNuevas ?? 0}
              ratingAvg={ratingAvg}
              radiusKm={radiusKm}
              onPressRadius={goRadar}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(320)}>
            <ZoneActivityCard
              workersOnline={data?.zoneWorkersOnline ?? 0}
              requestsLast2h={data?.zoneRequestsLast2h ?? 0}
              recommendedRadiusKm={data?.recommendedRadiusKm ?? radiusKm}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(110).duration(320)}>
            <BestHourCard label={data?.bestHourLabel ?? ''} bars={data?.bestHourBars ?? []} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).duration(320)}>
            <PromoBanner
              recommendedRadiusKm={Math.max(data?.recommendedRadiusKm ?? radiusKm, nextRadiusOption(radiusKm))}
              onPress={goRadar}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(210).duration(320)}>
            <QuickActions onAction={handleAction} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(260).duration(320)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Solicitudes recientes cerca de ti</Text>
              <View style={styles.updatedRow}>
                <View style={styles.updatedDot} />
                <Text style={styles.updatedText}>Actualizado</Text>
              </View>
            </View>

            {recent.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="time-outline" size={26} color={INICIO.textFaint} />
                <Text style={styles.emptyText}>
                  Aquí verás las solicitudes que superan una hora en el radar sin que nadie las tome. Permanecen 24 horas.
                </Text>
              </View>
            ) : (
              <View style={styles.requestList}>
                {recent.map((job) => (
                  <RequestCard key={job.id} job={job} onPressDetail={() => openDetail(job.id)} />
                ))}
              </View>
            )}
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(310).duration(320)}>
            <WeeklyProgress
              weekCompleted={stats?.weekCompleted ?? 0}
              weekEarned={stats?.weekEarned ?? 0}
              jobsGoal={WEEKLY_JOBS_GOAL}
              earnGoal={WEEKLY_EARN_GOAL}
            />
          </Animated.View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: INICIO.bg },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: INICIO.textStrong, flexShrink: 1 },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  updatedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: INICIO.green },
  updatedText: { fontSize: 10, color: INICIO.textMedium },
  requestList: { gap: 12 },
  emptyCard: {
    backgroundColor: INICIO.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: INICIO.border,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  emptyText: { fontSize: 13, color: INICIO.textMedium, textAlign: 'center', lineHeight: 19 },
});
