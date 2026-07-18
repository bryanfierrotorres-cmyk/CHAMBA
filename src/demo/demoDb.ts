import AsyncStorage from '@react-native-async-storage/async-storage';
import { phaseToJobStatus } from '@utils/workerOperationalPhase';
import type {
  UserProfile,
  UserRole,
  Job,
  JobCategory,
  JobStatus,
  ClientOrderJob,
  JobAssignment,
  AssignedWorkerSummary,
  UrgencyLevel,
  WorkerOperationalPhase,
  WorkerReview,
  AppNotification,
  ServiceMessage,
} from '@/types';

/**
 * DEMO MODE — Backend en memoria, 100 % offline.
 *
 * Única fuente de verdad cuando ENV.DATA_MODE === 'demo'. No toca Supabase ni la red.
 * Las mutaciones se persisten en AsyncStorage durante la sesión; reset() vuelve al seed.
 *
 * Todo el estado del backend vive aquí para que los distintos dominios (auth, jobs,
 * reviews, favoritos, chat, notificaciones) compartan un mismo grafo consistente.
 */

const STORAGE_KEY = 'CHAMBA_DEMO_DB_V1';

// ─── Entidades solo-demo (no existen como tabla en producción) ──────────────

export interface DemoFavorite {
  client_id: string;
  worker_id: string;
  created_at: string;
}

interface DemoState {
  profiles: UserProfile[];
  jobs: Job[];
  assignments: JobAssignment[];
  reviews: WorkerReview[];
  favorites: DemoFavorite[];
  /** Mensajes de chat con la misma forma que producción (ServiceMessage). */
  chat: ServiceMessage[];
  notifications: AppNotification[];
}

// ─── Utilidades ─────────────────────────────────────────────────────────────

/** UUID v4 (mismo criterio que authStore, sin depender de él). */
export const demoUuid = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = (Math.random() * 256) | 0;
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** Latencia simulada para que la UI se sienta como producción (spinners, optimistic UI). */
export const demoLatency = (min = 180, max = 480): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, min + Math.random() * (max - min)));

const nowIso = () => new Date().toISOString();

// ─── Seed determinista ──────────────────────────────────────────────────────

const SEED_CLIENT_ID = 'b0332110-9d62-46f4-89d2-d4139d9a98e3';
const SEED_WORKER_ID = '78ae307b-80c1-4185-bbb6-8bc80486d6fd';
const SEED_WORKER2_ID = 'c1443221-ae73-4296-9ae3-e5240e0b0a7f';
const SEED_ADMIN_ID = 'a0111000-1111-4111-8111-000000000001';

const SEED_TS = '2026-06-16T20:16:59.303Z';

const makeProfile = (p: Partial<UserProfile> & Pick<UserProfile, 'id' | 'full_name' | 'role'>): UserProfile => ({
  email: '',
  phone: null,
  avatar_url: null,
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
  rating_avg: null,
  total_reviews: 0,
  created_at: SEED_TS,
  updated_at: SEED_TS,
  ...p,
}) as UserProfile;

const makeJob = (p: Partial<Job> & Pick<Job, 'id' | 'title' | 'category' | 'created_by' | 'pay_amount'>): Job => {
  const platformFee = Math.round(p.pay_amount * 0.1);
  return {
    description: '',
    status: 'open',
    platform_fee: platformFee,
    worker_payout: p.pay_amount - platformFee,
    location: { address: 'Managua, Nicaragua', lat: 12.1364, lng: -86.2514 },
    scheduled_at: null,
    duration_hours: 2,
    required_workers: 1,
    slots_taken: 0,
    media_urls: [],
    booking_type: 'custom',
    urgency_level: 'hoy',
    created_at: nowIso(),
    updated_at: nowIso(),
    ...p,
  } as Job;
};

function buildSeed(): DemoState {
  const profiles: UserProfile[] = [
    makeProfile({
      id: SEED_CLIENT_ID,
      email: 'cliente@prueba.com',
      full_name: 'Cliente de Prueba',
      phone: '88883333',
      role: 'client',
    }),
    makeProfile({
      id: SEED_WORKER_ID,
      email: 'tecnico@prueba.com',
      full_name: 'Técnico de Prueba',
      phone: '88884444',
      role: 'worker',
      worker_status: 'active',
      category_1: 'limpieza_sofas' as JobCategory,
      category_1_approved: true,
      rating_avg: 4.8,
      total_reviews: 12,
    }),
    makeProfile({
      id: SEED_WORKER2_ID,
      full_name: 'Marlon Herrera',
      phone: '88885555',
      role: 'worker',
      worker_status: 'active',
      category_1: 'electricidad' as JobCategory,
      category_1_approved: true,
      rating_avg: 4.5,
      total_reviews: 7,
    }),
    makeProfile({
      id: SEED_ADMIN_ID,
      email: 'admin@prueba.com',
      full_name: 'Admin de Prueba',
      phone: '88880000',
      role: 'admin',
      is_approved: true,
    }),
  ];

  const jobs: Job[] = [
    makeJob({
      id: demoUuid(),
      title: 'Limpieza de sofá 3 plazas',
      description: 'Sofá de tela con manchas de café. Necesito limpieza profunda hoy.',
      category: 'limpieza_sofas' as JobCategory,
      created_by: SEED_CLIENT_ID,
      pay_amount: 600,
      status: 'open',
      urgency_level: 'hoy',
    }),
    makeJob({
      id: demoUuid(),
      title: 'Revisar tomacorriente que no funciona',
      description: 'Un tomacorriente de la cocina dejó de dar corriente.',
      category: 'electricidad' as JobCategory,
      created_by: SEED_CLIENT_ID,
      pay_amount: 450,
      status: 'open',
      urgency_level: 'manana',
    }),
  ];

  return { profiles, jobs, assignments: [], reviews: [], favorites: [], chat: [], notifications: [] };
}

// ─── Backend singleton ────────────────────────────────────────────────────────

class DemoDb {
  private state: DemoState = buildSeed();
  private hydration: Promise<void>;

  constructor() {
    this.hydration = this.hydrate();
  }

  /** Espera a que termine la hidratación desde AsyncStorage antes de leer/escribir. */
  async ready(): Promise<void> {
    await this.hydration;
  }

  private async hydrate(): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as Partial<DemoState>;

      // Merge por id (no reemplazo directo): preserva altas/ediciones del usuario
      // guardadas en una sesión anterior, y además rellena perfiles de seed nuevos
      // (p. ej. el admin agregado después) que ese AsyncStorage viejo no tiene.
      const seedProfiles = this.state.profiles;
      const storedProfiles = stored.profiles ?? [];
      const storedIds = new Set(storedProfiles.map((p) => p.id));
      const missingSeedProfiles = seedProfiles.filter((p) => !storedIds.has(p.id));

      this.state = {
        ...this.state,
        ...stored,
        profiles: [...storedProfiles, ...missingSeedProfiles],
      };
    } catch {
      // sin caché previa: se queda con el seed inicial
    }
  }

  private async persist(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // AsyncStorage no disponible: el estado en memoria sigue operando
    }
  }

  /** Vuelve al seed conocido (útil para reiniciar una demo limpia). */
  async reset(): Promise<void> {
    this.state = buildSeed();
    await this.persist();
  }

  // ── Perfiles ───────────────────────────────────────────────────────────────

  async findProfileByPhone(phone: string): Promise<UserProfile | null> {
    await this.ready();
    return this.state.profiles.find((p) => p.phone === phone) ?? null;
  }

  async findProfileById(id: string): Promise<UserProfile | null> {
    await this.ready();
    return this.state.profiles.find((p) => p.id === id) ?? null;
  }

  async findProfileByEmail(email: string): Promise<UserProfile | null> {
    await this.ready();
    const normalized = email.trim().toLowerCase();
    return this.state.profiles.find((p) => p.email.toLowerCase() === normalized) ?? null;
  }

  async createProfile(input: {
    full_name: string;
    phone: string;
    role: UserRole;
    email?: string;
  }): Promise<UserProfile> {
    await this.ready();
    const profile = makeProfile({
      id: demoUuid(),
      full_name: input.full_name,
      phone: input.phone,
      email: input.email ?? '',
      role: input.role,
      is_approved: input.role === 'client',
      worker_status: input.role === 'worker' ? 'incomplete' : null,
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    this.state.profiles.push(profile);
    await this.persist();
    return profile;
  }

  async updateProfile(id: string, patch: Partial<UserProfile>): Promise<UserProfile> {
    await this.ready();
    const idx = this.state.profiles.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Perfil no encontrado (demo)');
    const updated: UserProfile = {
      ...this.state.profiles[idx],
      ...patch,
      updated_at: nowIso(),
    };
    this.state.profiles[idx] = updated;
    await this.persist();
    return updated;
  }

  // ── Jobs ─────────────────────────────────────────────────────────────────────

  /** Adjunta el perfil del creador (para tarjetas de feed / detalle). */
  private withCreator(job: Job): Job {
    const c = this.state.profiles.find((p) => p.id === job.created_by);
    if (!c) return { ...job };
    return {
      ...job,
      creator: { id: c.id, full_name: c.full_name, avatar_url: c.avatar_url, phone: c.phone },
    };
  }

  async createJob(input: DemoCreateJobInput): Promise<Job> {
    await this.ready();
    const platformFee = parseFloat((input.payAmount * 0.05).toFixed(2));
    const job = makeJob({
      id: demoUuid(),
      title: input.title,
      description: input.description,
      category: input.category,
      created_by: input.createdBy,
      pay_amount: input.payAmount,
      status: 'open',
      platform_fee: platformFee,
      worker_payout: parseFloat((input.payAmount * 0.95).toFixed(2)),
      location: { address: input.address, lat: input.lat, lng: input.lng },
      scheduled_at: input.scheduledAt ?? null,
      urgency_level: input.urgencyLevel ?? 'hoy',
      duration_hours: input.durationHours,
      required_workers: input.requiredWorkers,
      slots_taken: 0,
      media_urls: input.mediaUrls ?? [],
      booking_type: input.bookingType ?? 'custom',
      created_at: nowIso(),
      updated_at: nowIso(),
    });
    this.state.jobs.unshift(job);
    await this.persist();
    return this.withCreator(job);
  }

  async getJobById(jobId: string): Promise<Job | null> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    return job ? this.withCreator(job) : null;
  }

  /** Feed del técnico: solicitudes abiertas, opcionalmente filtradas por categoría. */
  async listOpenJobs(opts?: { categories?: string[] }): Promise<Job[]> {
    await this.ready();
    const cats = opts?.categories?.length ? new Set(opts.categories) : null;
    return this.state.jobs
      .filter((j) => j.status === 'open')
      .filter((j) => !cats || cats.has(j.category))
      .map((j) => this.withCreator(j));
  }

  /** Panel del cliente: sus solicitudes con el técnico asignado embebido. */
  async listClientOrders(clientId: string): Promise<ClientOrderJob[]> {
    await this.ready();
    return this.state.jobs
      .filter((j) => j.created_by === clientId)
      .map((j) => {
        const assignment = this.state.assignments.find(
          (a) => a.job_id === j.id && a.selection_status !== 'rejected',
        );
        const worker = assignment
          ? this.state.profiles.find((p) => p.id === assignment.worker_id)
          : null;
        const assigned_worker: AssignedWorkerSummary | null = worker
          ? { id: worker.id, full_name: worker.full_name, avatar_url: worker.avatar_url, phone: worker.phone }
          : null;
        const pending = this.state.assignments.filter(
          (a) => a.job_id === j.id && a.selection_status === 'pending',
        ).length;
        return {
          ...this.withCreator(j),
          assigned_worker_id: worker?.id ?? null,
          assigned_worker,
          pending_applications_count: pending,
        };
      });
  }

  /** "Mis Chambas" del técnico: asignaciones con el job embebido. */
  async listWorkerAssignments(workerId: string): Promise<JobAssignment[]> {
    await this.ready();
    return this.state.assignments
      .filter((a) => a.worker_id === workerId)
      .map((a) => {
        const job = this.state.jobs.find((j) => j.id === a.job_id);
        return { ...a, job: job ? this.withCreator(job) : undefined };
      });
  }

  /** Técnico acepta una solicitud. Devuelve la asignación creada. */
  async acceptJob(jobId: string, workerId: string): Promise<JobAssignment> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('La solicitud ya no está disponible');
    if (job.status !== 'open') throw new Error('La solicitud ya fue tomada por otro técnico');

    job.status = 'assigned';
    job.operational_phase = 'accepted';
    job.assigned_worker_id = workerId;
    job.slots_taken = (job.slots_taken ?? 0) + 1;
    job.updated_at = nowIso();

    let assignment = this.state.assignments.find(
      (a) => a.job_id === jobId && a.worker_id === workerId,
    );
    if (!assignment) {
      assignment = {
        id: demoUuid(),
        job_id: jobId,
        worker_id: workerId,
        assigned_at: nowIso(),
        completed_at: null,
        payment_status: 'pending',
        payment_intent_id: null,
        selection_status: 'approved',
      };
      this.state.assignments.push(assignment);
    }
    await this.persist();
    return { ...assignment, job: this.withCreator(job) };
  }

  /** Avanza la fase operativa del técnico (en_route → arrived → completed). */
  async advancePhase(jobId: string, nextPhase: WorkerOperationalPhase): Promise<void> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return;
    job.operational_phase = nextPhase;
    job.status = phaseToJobStatus(nextPhase, job.status);
    job.updated_at = nowIso();
    if (nextPhase === 'completed') {
      const a = this.state.assignments.find((x) => x.job_id === jobId);
      if (a) a.completed_at = nowIso();
    }
    await this.persist();
  }

  /** Guarda las fotos antes/después del técnico (URI local en demo). */
  async updateJobPhotos(
    jobId: string,
    patch: { before_photo_url?: string | null; after_photo_url?: string | null },
  ): Promise<Job | null> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    if (patch.before_photo_url !== undefined) job.before_photo_url = patch.before_photo_url;
    if (patch.after_photo_url !== undefined) job.after_photo_url = patch.after_photo_url;
    job.updated_at = nowIso();
    await this.persist();
    return this.withCreator(job);
  }

  /** Cambia el status del job directamente (start/complete/cancel). */
  async setJobStatus(jobId: string, status: JobStatus): Promise<Job | null> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    job.status = status;
    job.updated_at = nowIso();
    if (status === 'completed') {
      job.operational_phase = 'completed';
      const a = this.state.assignments.find((x) => x.job_id === jobId);
      if (a) a.completed_at = nowIso();
    }
    await this.persist();
    return this.withCreator(job);
  }

  // ── Chat ─────────────────────────────────────────────────────────────────────

  async listJobMessages(servicioId: string): Promise<ServiceMessage[]> {
    await this.ready();
    return this.state.chat
      .filter((m) => m.servicio_id === servicioId)
      .sort((a, b) => new Date(a.creado_al).getTime() - new Date(b.creado_al).getTime());
  }

  async addJobMessage(servicioId: string, remitenteId: string, texto: string): Promise<ServiceMessage> {
    await this.ready();
    const msg: ServiceMessage = {
      id: demoUuid(),
      servicio_id: servicioId,
      remitente_id: remitenteId,
      texto,
      creado_al: nowIso(),
    };
    this.state.chat.push(msg);
    await this.persist();
    return msg;
  }

  /** Contexto del chat (cliente/técnico/estado) a partir del job y sus perfiles. */
  async getJobChatContext(jobId: string): Promise<{
    jobId: string;
    status: JobStatus;
    serviceTitle: string;
    clientId: string;
    workerId: string | null;
    clientName: string;
    clientAvatar: string | null;
    workerName: string | null;
    workerAvatar: string | null;
  } | null> {
    await this.ready();
    const job = this.state.jobs.find((j) => j.id === jobId);
    if (!job) return null;
    const client = this.state.profiles.find((p) => p.id === job.created_by) ?? null;
    const workerId = job.assigned_worker_id ?? null;
    const worker = workerId ? this.state.profiles.find((p) => p.id === workerId) ?? null : null;
    return {
      jobId,
      status: job.status,
      serviceTitle: job.title,
      clientId: job.created_by,
      workerId,
      clientName: client?.full_name ?? 'Cliente',
      clientAvatar: client?.avatar_url ?? null,
      workerName: worker?.full_name ?? null,
      workerAvatar: worker?.avatar_url ?? null,
    };
  }
}

export interface DemoCreateJobInput {
  title: string;
  description: string;
  category: JobCategory;
  payAmount: number;
  address: string;
  lat: number;
  lng: number;
  scheduledAt?: string | null;
  urgencyLevel?: UrgencyLevel;
  durationHours: number;
  requiredWorkers: number;
  mediaUrls?: string[];
  bookingType?: 'express' | 'custom';
  createdBy: string;
}

/** Instancia única del backend demo. */
export const demoDb = new DemoDb();
