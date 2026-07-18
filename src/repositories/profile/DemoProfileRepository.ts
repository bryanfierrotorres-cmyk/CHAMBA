import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/types';
import type { ProfileRepository, ProfileUpdatePatch } from './ProfileRepository';

const STORAGE_KEY = 'CHAMBA_DEMO_PROFILES';

/** Mismos usuarios de prueba usados en supabase/seed_dev_users.sql — consistencia con QA manual. */
const SEED_PROFILES: UserProfile[] = [
  {
    id: 'b0332110-9d62-46f4-89d2-d4139d9a98e3',
    email: 'cliente@prueba.com',
    full_name: 'Cliente de Prueba',
    phone: '88883333',
    avatar_url: null,
    role: 'client',
    is_approved: true,
    worker_status: null,
    cedula_url: null,
    record_policia_url: null,
    category_1: null,
    category_2: null,
    category_1_approved: false,
    category_2_approved: false,
    stripe_account_id: null,
    fcm_token: null,
    created_at: '2026-06-16T20:16:59.303Z',
    updated_at: '2026-06-16T20:16:59.303Z',
  },
  {
    id: '78ae307b-80c1-4185-bbb6-8bc80486d6fd',
    email: 'tecnico@prueba.com',
    full_name: 'Técnico de Prueba',
    phone: '88884444',
    avatar_url: null,
    role: 'worker',
    is_approved: true,
    worker_status: 'active',
    cedula_url: null,
    record_policia_url: null,
    category_1: 'limpieza_sofas',
    category_2: null,
    category_1_approved: true,
    category_2_approved: false,
    stripe_account_id: null,
    fcm_token: null,
    created_at: '2026-06-16T20:16:59.303Z',
    updated_at: '2026-06-16T20:16:59.303Z',
  },
];

const simulateLatency = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));

/**
 * DEMO MODE: Perfil en memoria, sin Supabase ni Internet.
 * Persiste mutaciones en AsyncStorage durante la sesión; reset() vuelve al seed conocido.
 */
export class DemoProfileRepository implements ProfileRepository {
  private state: Map<string, UserProfile>;

  constructor() {
    this.state = new Map(SEED_PROFILES.map((p) => [p.id, p]));
    void this.hydrateFromStorage();
  }

  private async hydrateFromStorage(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as UserProfile[];
      stored.forEach((p) => this.state.set(p.id, p));
    } catch {
      // sin caché previa: se queda con el seed inicial
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...this.state.values()]));
    } catch {
      // AsyncStorage no disponible: el estado en memoria sigue funcionando igual
    }
  }

  async getById(userId: string): Promise<UserProfile | null> {
    await simulateLatency();
    return this.state.get(userId) ?? null;
  }

  async update(userId: string, patch: ProfileUpdatePatch): Promise<UserProfile> {
    await simulateLatency();
    const current = this.state.get(userId);
    if (!current) throw new Error('Perfil no encontrado (demo)');
    const updated: UserProfile = { ...current, ...patch, updated_at: new Date().toISOString() };
    this.state.set(userId, updated);
    await this.persist();
    return updated;
  }

  /** DEMO no tiene Storage real: devuelve el URI local, suficiente para <Image> en la sesión. */
  async uploadAvatar(_userId: string, localUri: string): Promise<string> {
    await simulateLatency();
    return localUri;
  }

  /** Vuelve al estado inicial. Llamar al arrancar una sesión demo nueva. */
  reset(): void {
    this.state = new Map(SEED_PROFILES.map((p) => [p.id, p]));
    void this.persist();
  }
}
