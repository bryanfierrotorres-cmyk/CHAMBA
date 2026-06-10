import React from 'react';
import { ContadorExpiracion } from './ContadorExpiracion';

interface JobExpiryBadgeProps {
  createdAt: string;
  jobId: string;
  onExpirar?: (jobId: string) => void;
  /** worker = radar técnico · client = publicación / mis solicitudes */
  tone?: 'worker' | 'client';
}

/** Pill compacta MM:SS — para headers, modales y detalle. */
export const JobExpiryBadge: React.FC<JobExpiryBadgeProps> = ({
  createdAt,
  jobId,
  onExpirar,
  tone = 'client',
}) => (
  <ContadorExpiracion
    createdAt={createdAt}
    idSolicitud={jobId}
    onExpirar={onExpirar}
    variant={tone === 'client' ? 'chipClient' : 'chip'}
  />
);
