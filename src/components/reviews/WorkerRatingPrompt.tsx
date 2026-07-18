import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StarRating } from '@components/StarRating';
import { ChambaPressable } from '@components/chamba/ChambaPressable';
import { CHAMBA, CARD_STEP_SHADOW } from '@constants/chambaUI';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';
import { coerceNumber, formatDate } from '@utils/formatters';
import type { ReviewerRole, WorkerReview } from '@/types';

interface WorkerRatingPromptProps {
  workerId: string;
  workerName: string;
  reviewerId: string;
  reviewerRole: Extract<ReviewerRole, 'admin' | 'client' | 'worker'>;
  reviewerName: string;
  /** Rol del sujeto calificado. Default 'worker'. */
  subjectRole?: 'worker' | 'client';
  /** Título personalizado (ej. servicio completado). */
  title?: string;
}

export const WorkerRatingPrompt: React.FC<WorkerRatingPromptProps> = ({
  workerId,
  workerName,
  reviewerId,
  reviewerRole,
  reviewerName,
  subjectRole = 'worker',
  title = '¿Cómo fue tu experiencia?',
}) => {
  const { reviews, summary, isLoading, submitReview, isSubmitting } = useWorkerReviews(workerId);
  const myReview = reviews.find((r: WorkerReview) => r.reviewer_id === reviewerId);

  const [rating, setRating] = useState(coerceNumber(myReview?.rating, 0));
  const [comment, setComment] = useState(myReview?.comment ?? '');

  useEffect(() => {
    if (myReview) {
      setRating(coerceNumber(myReview.rating, 0));
      setComment(myReview.comment);
    }
  }, [myReview?.id, myReview?.rating, myReview?.comment]);

  const handleSubmit = async () => {
    if (rating < 1) {
      Alert.alert('Calificación requerida', 'Seleccioná de 1 a 5 estrellas.');
      return;
    }
    if (comment.trim().length < 3) {
      Alert.alert('Comentario requerido', 'Escribí al menos 3 caracteres.');
      return;
    }

    try {
      await submitReview({
        workerId,
        reviewerId,
        reviewerRole,
        reviewerName,
        rating,
        comment,
        subjectRole,
      });
      if (Platform.OS === 'web') {
        alert('¡Gracias! Tu calificación fue publicada.');
      } else {
        Alert.alert('¡Gracias!', 'Tu calificación ayuda a otros clientes.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar');
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.card, styles.loading]}>
        <ActivityIndicator color={CHAMBA.primary} />
      </View>
    );
  }

  if (myReview) {
    return (
      <View style={styles.card}>
        <View style={styles.thankRow}>
          <View style={styles.thankIcon}>
            <Ionicons name="checkmark" size={20} color="#FFFFFF" />
          </View>
          <View style={styles.thankText}>
            <Text style={styles.thankTitle}>¡Gracias por calificar!</Text>
            <Text style={styles.thankSub}>
              Tu reseña de {workerName} quedó registrada el {formatDate(myReview.created_at)}.
            </Text>
          </View>
        </View>
        <StarRating rating={myReview.rating} size="md" showCount={false} />
        <Text style={styles.thankComment}>{myReview.comment}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>
        Calificá a {workerName} — tu opinión mejora la comunidad CHAMBA.
      </Text>

      {summary.total_reviews > 0 && (
        <View style={styles.summaryRow}>
          <StarRating
            rating={summary.rating_avg}
            totalReviews={summary.total_reviews}
            size="sm"
          />
        </View>
      )}

      <View style={styles.starsWrap}>
        <StarRating
          interactive
          value={rating}
          onChange={setRating}
          size="lg"
          showCount={false}
        />
        {rating > 0 && (
          <Text style={styles.ratingHint}>
            {rating === 5 ? '¡Excelente!' : rating >= 4 ? 'Muy bueno' : rating >= 3 ? 'Regular' : 'Necesita mejorar'}
          </Text>
        )}
      </View>

      <Text style={styles.inputLabel}>Comentario</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Contanos cómo fue el servicio…"
        placeholderTextColor={CHAMBA.muted}
        multiline
        numberOfLines={3}
        style={styles.input}
        textAlignVertical="top"
      />

      <ChambaPressable
        onPress={() => { void handleSubmit(); }}
        disabled={isSubmitting}
        style={[styles.submitBtn, isSubmitting && styles.submitDisabled]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="star" size={18} color="#FFFFFF" />
            <Text style={styles.submitText}>Publicar calificación</Text>
          </>
        )}
      </ChambaPressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: CHAMBA.white,
    borderRadius: 18,
    padding: 18,
    gap: 12,
    ...CARD_STEP_SHADOW,
  },
  loading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: CHAMBA.navy,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: CHAMBA.muted,
    lineHeight: 20,
  },
  summaryRow: {
    alignItems: 'flex-start',
  },
  starsWrap: {
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  ratingHint: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.primary,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: CHAMBA.navy,
  },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: CHAMBA.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: CHAMBA.navy,
    backgroundColor: '#F9FAFB',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: CHAMBA.primary,
    borderRadius: 12,
    minHeight: 48,
    marginTop: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  thankRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thankIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thankText: { flex: 1 },
  thankTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  thankSub: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginTop: 2,
    lineHeight: 18,
  },
  thankComment: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 21,
  },
});
