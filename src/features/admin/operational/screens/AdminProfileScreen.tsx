import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '@store/authStore';
import { ChambaScreenHeader } from '@components/chamba/ChambaScreenHeader';
import { ChambaProfileHeroCard } from '@components/chamba/ChambaProfileHeroCard';
import { ChambaMenuRow } from '@components/chamba/ChambaMenuRow';
import { CHAMBA, chambaStyles } from '@constants/chambaUI';
import { webMinViewportStyle } from '@constants/webMobileLayout';
import { ServiceCatalogGroups } from '@components/catalog/ServiceCatalogGroups';
import { StitchToggle } from '@components/admin/StitchToggle';
import { useAdminDevMode } from '@features/admin/devModeFlag';
import { ConfigurationModal } from './ConfigurationModal';
import type { AdminTabParamList } from '@/types';

type AdminTabNav = BottomTabNavigationProp<AdminTabParamList>;

export const AdminProfileScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AdminTabNav>();
  const profile = useAuthStore((s) => s.profile);
  const isLoading = useAuthStore((s) => s.isLoading);
  const signOut = useAuthStore((s) => s.signOut);
  const [signingOut, setSigningOut] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const devModeEnabled = useAdminDevMode((s) => s.enabled);
  const toggleDevMode = useAdminDevMode((s) => s.toggle);

  const runSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.warn('[AdminProfile] signOut:', err);
      if (Platform.OS === 'web') {
        window.alert('No se pudo cerrar sesión. Recargá la página.');
      } else {
        Alert.alert('Error', 'No se pudo cerrar sesión. Intentá de nuevo.');
      }
    } finally {
      setSigningOut(false);
    }
  };

  const handleSignOut = () => {
    if (signingOut) return;
    if (Platform.OS === 'web') {
      if (confirm('¿Seguro que querés cerrar sesión?')) void runSignOut();
      return;
    }
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void runSignOut() },
    ]);
  };

  if (!profile) {
    return (
      <View style={[chambaStyles.screen, styles.center, webMinViewportStyle]}>
        <ActivityIndicator size="large" color={CHAMBA.blue} />
        <Text style={styles.loadingText}>
          {isLoading ? 'Cargando perfil…' : 'No hay sesión de administrador'}
        </Text>
      </View>
    );
  }

  const displayName = profile.full_name?.trim() || 'Administrador';
  const meta = [profile.email, profile.phone].filter(Boolean) as string[];

  return (
    <SafeAreaView style={[chambaStyles.screen, webMinViewportStyle]} edges={['top']}>
      <ChambaScreenHeader
        title="Mi Perfil"
        subtitle="Panel de administración CHAMBA"
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 160 }]}
      >
        <ChambaProfileHeroCard
          avatarUri={profile.avatar_url}
          name={displayName}
          roleLabel="Administrador"
          roleIcon="shield-checkmark"
          roleIconColor={CHAMBA.blue}
          meta={meta}
        />

        <View style={chambaStyles.sectionHeader}>
          <Text style={chambaStyles.sectionTitle}>Catálogo de servicios</Text>
          <Text style={chambaStyles.sectionSubtitle}>
            Hogar (express y especializados) y Para tu negocio — sincronizado con el cliente
          </Text>
        </View>
        <View style={chambaStyles.catalogPanel}>
          <ServiceCatalogGroups compact accordion />
        </View>

        <View style={[chambaStyles.sectionHeader, { marginTop: 20 }]}>
          <Text style={chambaStyles.sectionTitle}>Panel</Text>
          <Text style={chambaStyles.sectionSubtitle}>Accesos rápidos</Text>
        </View>

        <ChambaMenuRow
          title="Centro de control"
          subtitle="Radar de operaciones y métricas"
          iconColor="#007AFF"
          icon={<Ionicons name="pulse" size={22} color="#FFF" />}
          onPress={() => navigation.navigate('Dashboard')}
        />
        <ChambaMenuRow
          title="Gestión de catálogo"
          subtitle="Categorías y servicios dinámicos"
          iconColor="#5856D6"
          icon={<Ionicons name="grid" size={22} color="#FFF" />}
          onPress={() => navigation.navigate('ManageCatalog')}
        />
        <ChambaMenuRow
          title="Equipo operativo"
          subtitle="Técnicos, documentos y aprobaciones"
          iconColor="#34C759"
          icon={<Ionicons name="people" size={22} color="#FFF" />}
          onPress={() => navigation.navigate('ManageWorkers')}
        />
        <ChambaMenuRow
          title="Configuración"
          subtitle="Parámetros operativos, sin tocar código"
          iconColor="#64748B"
          icon={<Ionicons name="settings" size={22} color="#FFF" />}
          onPress={() => setShowConfig(true)}
        />
        <ChambaMenuRow
          title={signingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          subtitle={signingOut ? 'Un momento' : 'Salir del panel de forma segura'}
          iconColor="#FF453A"
          icon={
            signingOut
              ? <ActivityIndicator color="#FFF" size="small" />
              : <Ionicons name="log-out-outline" size={22} color="#FFF" />
          }
          onPress={signingOut ? undefined : handleSignOut}
          destructive
          loading={signingOut}
        />

        <View style={[chambaStyles.sectionHeader, { marginTop: 20 }]}>
          <Text style={chambaStyles.sectionTitle}>Desarrollo</Text>
          <Text style={chambaStyles.sectionSubtitle}>Solo para uso interno del equipo técnico</Text>
        </View>
        <View style={styles.devRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.devRowTitle}>Modo desarrollador</Text>
            <Text style={styles.devRowHint}>
              {devModeEnabled ? 'Activo — el tab "Dev" está visible' : 'Muestra el Centro Técnico (diagnóstico, logs)'}
            </Text>
          </View>
          <StitchToggle value={devModeEnabled} onValueChange={toggleDevMode} />
        </View>

        <Text style={styles.version}>CHAMBA · Panel administrador</Text>
      </ScrollView>

      <ConfigurationModal visible={showConfig} onClose={() => setShowConfig(false)} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, color: CHAMBA.muted, fontWeight: '400' },
  scroll: { paddingHorizontal: 20 },
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
  },
  devRowTitle: { fontSize: 14, fontWeight: '600', color: CHAMBA.navy },
  devRowHint: { fontSize: 12, color: CHAMBA.muted, marginTop: 2, fontWeight: '400' },
  version: {
    textAlign: 'center',
    color: CHAMBA.muted,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '400',
  },
});
