import React from 'react';
import { ContadorExpiracion } from '@components/shared/ContadorExpiracion';
import { getJobExpiryAtMs } from '@constants/jobExpiry';
import type { Job } from '@/types';

interface RadarJobExpiryTimerProps {
  /** Epoch ms de expiración (legacy) o usar `createdAt` + job id. */
  expiresAt?: number;
  createdAt?: string;
  jobId?: string;
  onExpirar?: (jobId: string) => void;
  active?: boolean;
}

/** Wrapper radar — delega en ContadorExpiracion (MM:SS local). */
export const RadarJobExpiryTimer: React.FC<RadarJobExpiryTimerProps> = ({
  expiresAt,
  createdAt,
  jobId,
  onExpirar,
  active = true,
}) => {
  const resolvedCreatedAt = createdAt
    ?? (expiresAt != null
      ? new Date(expiresAt - 60 * 60 * 1000).toISOString()
      : null);

  if (!resolvedCreatedAt || !jobId) {
    return null;
  }

  return (
    <ContadorExpiracion
      createdAt={resolvedCreatedAt}
      idSolicitud={jobId}
      onExpirar={onExpirar ?? (() => {})}
      variant="radar"
      active={active}
    />
  );
};

export const getRadarExpiryAt = (job: Pick<Job, 'created_at'>): number =>
  getJobExpiryAtMs(job.created_at);
