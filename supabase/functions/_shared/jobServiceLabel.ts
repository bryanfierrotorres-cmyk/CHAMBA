const FALLBACK_LABELS: Record<string, string> = {
  limpieza_sofas: 'Limpieza de Sofás',
  limpieza_banos: 'Limpieza de Baños',
  limpieza_alfombra: 'Limpieza de Alfombras',
  conserjeria_ocasional: 'Limpieza de Casa',
  vehiculo_lavado_regular: 'Lavado de Vehículo',
  vehiculo_limpieza_profunda: 'Limpieza Profunda de Vehículo',
  jardineria_corte: 'Corte de Grama',
  jardineria_poda: 'Poda',
  ac_mantenimiento: 'Mantenimiento de A/C',
  pet_bano: 'Baño de Mascota',
  pet_paseo: 'Paseo de Mascota',
  electricista: 'Electricista',
  plomeria: 'Plomería',
  mandados_express: 'Mandados Express',
};

export const buildNewJobNotificationBody = (
  jobCategory: string,
  jobTitle: string | null | undefined,
  remoteLabel: string | null | undefined,
): string => {
  const trimmedTitle = jobTitle?.trim();
  if (trimmedTitle && trimmedTitle.length > 0) {
    return `Se necesita ${trimmedTitle}`;
  }

  const label =
    remoteLabel?.trim() ||
    FALLBACK_LABELS[jobCategory] ||
    jobCategory.replace(/_/g, ' ');

  return `Se necesita ${label}`;
};
