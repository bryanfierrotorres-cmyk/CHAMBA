import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, Alert, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { StarRating } from '@components/StarRating';
import { Input } from '@components/Input';
import { Button } from '@components/Button';
import { Avatar } from '@components/Avatar';
import { useWorkerReviews } from '@features/reviews/hooks/useWorkerReviews';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '@constants/theme';
import { coerceNumber, formatDate } from '@utils/formatters';
import type { ReviewerRole, WorkerReview } from '@/types';

interface WorkerReviewsPanelProps {
  workerId:      string;
  workerName?:   string;
  reviewerId:    string;
  reviewerRole:  ReviewerRole;
  reviewerName:  string;
  /** Mostrar formulario para calificar (admin siempre; cliente si hay técnico asignado) */
  allowReview?:  boolean;
  compact?:      boolean;
}

const ROLE_LABELS: Record<ReviewerRole, string> = {
  admin:  'Administrador',
  client: 'Cliente',
  worker: 'Técnico',
};

const ReviewRow: React.FC<{ review: WorkerReview }> = ({ review }) => (
  <View style={styles.reviewRow}>
    <View style={styles.reviewHeader}>
      <Avatar
        uri={review.reviewer?.avatar_url}
        name={review.reviewer?.full_name ?? 'Usuario'}
        size={32}
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.reviewerName}>
          {review.reviewer?.full_name ?? 'Usuario'}
        </Text>
        <Text style={styles.reviewMeta}>
          {ROLE_LABELS[review.reviewer_role]} · {formatDate(review.created_at)}
        </Text>
      </View>
      <StarRating rating={coerceNumber(review.rating, 0)} showCount={false} size="sm" />
    </View>
    <Text style={styles.reviewComment}>{review.comment}</Text>
  </View>
);

export const WorkerReviewsPanel: React.FC<WorkerReviewsPanelProps> = ({
  workerId,
  workerName,
  reviewerId,
  reviewerRole,
  reviewerName,
  allowReview = true,
  compact = false,
}) => {
  const { reviews, summary, isLoading, submitReview, isSubmitting } = useWorkerReviews(workerId);

  const myReview = reviews.find((r: WorkerReview) => r.reviewer_id === reviewerId);

  const [rating, setRating]   = useState(coerceNumber(myReview?.rating, 0));
  const [comment, setComment] = useState(myReview?.comment ?? '');

  useEffect(() => {
    if (myReview) {
      setRating(coerceNumber(myReview.rating, 0));
      setComment(myReview.comment);
    }
  }, [myReview?.id, myReview?.rating, myReview?.comment]);

  const handleSubmit = async () => {
    if (rating < 1) {
      Alert.alert('Calificación requerida', 'Selecciona de 1 a 5 estrellas.');
      return;
    }
    if (comment.trim().length < 3) {
      Alert.alert('Comentario requerido', 'Escribe al menos 3 caracteres.');
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
      });
      if (Platform.OS === 'web') {
        // eslint-disable-next-line no-alert
        alert(myReview ? 'Reseña actualizada' : 'Reseña enviada');
      } else {
        Alert.alert('¡Gracias!', myReview ? 'Tu reseña fue actualizada.' : 'Tu reseña fue publicada.');
      }
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'No se pudo guardar la reseña');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.brand[500]} />
      </View>
    );
  }

  // Cliente: mostrar confirmación en lugar de ocultar el panel
  if (reviewerRole === 'client' && myReview && !allowReview) {
    return (
      <View style={[styles.root, compact && styles.rootCompact]}>
        <View style={styles.summaryRow}>
          {summary.total_reviews > 0 ? (
            <StarRating
              rating={summary.rating_avg}
              totalReviews={summary.total_reviews}
              size={compact ? 'sm' : 'md'}
            />
          ) : (
            <Text style={{ color: '#F59E0B', fontWeight: 'bold' }}>✨ Primera Chamba</Text>
          )}
        </View>
        <View style={styles.clientThankCard}>
          <Text style={styles.clientThankTitle}>Tu calificación</Text>
          <StarRating rating={coerceNumber(myReview.rating, 0)} showCount={false} size="md" />
          <Text style={styles.reviewComment}>{myReview.comment}</Text>
          <Text style={styles.reviewMeta}>
            Publicada el {formatDate(myReview.created_at)}
          </Text>
        </View>
      </View>
    );
  }

  if (reviewerRole === 'client' && myReview && allowReview) {
    return (
      <View style={[styles.root, compact && styles.rootCompact]}>
        <View style={styles.clientThankCard}>
          <Text style={styles.clientThankTitle}>¡Gracias por calificar!</Text>
          <StarRating rating={coerceNumber(myReview.rating, 0)} showCount={false} size="md" />
          <Text style={styles.reviewComment}>{myReview.comment}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <View style={styles.summaryRow}>
        {summary.total_reviews > 0 ? (
          <StarRating
            rating={summary.rating_avg}
            totalReviews={summary.total_reviews}
            size={compact ? 'sm' : 'md'}
          />
        ) : (
          <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 16 }}>✨ Primera Chamba</Text>
        )}
        {workerName && (
          <Text style={styles.workerLabel} numberOfLines={1}>
            {workerName}
          </Text>
        )}
      </View>

      {allowReview && (reviewerRole !== 'client' || !myReview) && (
        <View style={styles.form}>
          <Text style={styles.formTitle}>
            {myReview && reviewerRole !== 'client'
              ? 'Actualizar tu calificación'
              : 'Calificar técnico'}
          </Text>
          <Text style={styles.formHint}>
            Toca las estrellas y deja un comentario sobre el servicio.
          </Text>

          <View style={styles.starsRow}>
            <StarRating
              interactive
              value={rating}
              onChange={setRating}
              size="lg"
              showCount={false}
            />
          </View>

          <Input
            label="Comentario"
            placeholder="Describe tu experiencia con este técnico…"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />

          <Button
            label={myReview && reviewerRole !== 'client' ? 'Actualizar reseña' : 'Publicar reseña'}
            onPress={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            icon={<Ionicons name="star" size={16} color="#FFF" />}
            size="md"
            fullWidth
          />
        </View>
      )}

      {reviews.length > 0 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>
            Reseñas ({reviews.length})
          </Text>
          {reviews.map((review: WorkerReview) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </View>
      )}

      {reviews.length === 0 && !allowReview && (
        <Text style={styles.emptyText}>Aún no hay reseñas para este técnico.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    gap: SPACING.md,
  },
  rootCompact: {
    marginTop: SPACING.sm,
  },
  loading: {
    paddingVertical: SPACING.lg,
    alignItems: 'center',
  },
  summaryRow: {
    gap: SPACING.xs,
    alignItems: 'center',
  },
  workerLabel: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    textAlign: 'center',
  },
  form: {
    backgroundColor: COLORS.bg.elevated,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
  },
  formTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.md,
    fontWeight: '800',
  },
  formHint: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    lineHeight: 18,
  },
  starsRow: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    paddingVertical: SPACING.xs,
  },
  list: {
    gap: SPACING.sm,
  },
  listTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '800',
  },
  reviewRow: {
    backgroundColor: '#FFF',
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
    gap: SPACING.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  reviewerName: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '700',
  },
  reviewMeta: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.xs,
    marginTop: 1,
  },
  reviewComment: {
    color: COLORS.text.secondary,
    fontSize: FONT_SIZE.sm,
    lineHeight: 20,
  },
  emptyText: {
    color: COLORS.text.muted,
    fontSize: FONT_SIZE.sm,
    textAlign: 'center',
    paddingVertical: SPACING.md,
  },
  clientThankCard: {
    backgroundColor: COLORS.bg.elevated,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border.subtle,
  },
  clientThankTitle: {
    color: COLORS.text.primary,
    fontSize: FONT_SIZE.sm,
    fontWeight: '800',
  },
});
