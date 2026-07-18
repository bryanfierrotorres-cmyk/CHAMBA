import { ENV } from '@utils/env';
import type { ProfileRepository } from './profile/ProfileRepository';
import { SupabaseProfileRepository } from './profile/SupabaseProfileRepository';
import { DemoProfileRepository } from './profile/DemoProfileRepository';

/**
 * Punto único de acceso a los repositorios de datos de CHAMBA.
 *
 * Hoy solo implementa el dominio Perfil. Los dominios futuros (Jobs, Reviews,
 * Chat, ...) se agregan como un método más aquí — ej. getJobsRepository() —
 * sin cambiar esta forma ni los métodos ya existentes.
 */
export interface RepositoryFactory {
  getProfileRepository(): ProfileRepository;
}

class DefaultRepositoryFactory implements RepositoryFactory {
  private profileRepository: ProfileRepository | null = null;

  getProfileRepository(): ProfileRepository {
    if (!this.profileRepository) {
      this.profileRepository =
        ENV.DATA_MODE === 'demo'
          ? new DemoProfileRepository()
          : new SupabaseProfileRepository();
    }
    return this.profileRepository;
  }
}

/** Instancia única de la app. Los futuros dominios se consumen igual: repositoryFactory.getXRepository(). */
export const repositoryFactory: RepositoryFactory = new DefaultRepositoryFactory();
