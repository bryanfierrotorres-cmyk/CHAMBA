import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadAndSaveJobWorkPhoto, type WorkPhotoKind } from '../services/jobWorkPhotosService';
import { JOB_KEYS } from './useJobs';

export function useUploadJobWorkPhoto(jobId: string, workerId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ localUri, kind }: { localUri: string; kind: WorkPhotoKind }) => {
      if (!workerId) throw new Error('Sesión inválida');
      return uploadAndSaveJobWorkPhoto(jobId, workerId, localUri, kind);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: JOB_KEYS.detail(jobId) });
      queryClient.invalidateQueries({ queryKey: [...JOB_KEYS.detail(jobId), 'active'] });
      queryClient.invalidateQueries({ queryKey: ['client-orders'] });
      queryClient.invalidateQueries({ queryKey: ['client-job-summary', jobId] });
      if (workerId) {
        queryClient.invalidateQueries({ queryKey: JOB_KEYS.myJobs(workerId) });
      }
    },
  });
}
