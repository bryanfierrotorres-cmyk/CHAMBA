import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  adminRemoveOpenJob,
  type AdminModerationReason,
} from '../services/adminService';
import { JOB_KEYS } from '@features/jobs/hooks/useJobs';
import { useAuthStore } from '@store/authStore';

export function useAdminRemoveJob() {
  const profile = useAuthStore((s) => s.profile);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ jobId, reason }: { jobId: string; reason: AdminModerationReason }) => {
      if (!profile?.id) throw new Error('Sesión de administrador requerida');
      return adminRemoveOpenJob(jobId, profile.id, reason);
    },
    onSuccess: (_job, { jobId }) => {
      void queryClient.invalidateQueries({ queryKey: JOB_KEYS.adminControl() });
      void queryClient.invalidateQueries({ queryKey: JOB_KEYS.feed('open') });
      void queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });
    },
  });
}
