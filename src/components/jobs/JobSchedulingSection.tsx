import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Platform,
  TouchableOpacity,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CARD_STEP_SHADOW, CHAMBA, chambaStyles } from '@constants/chambaUI';
import { textInputWebFocusStyle } from '@constants/textInputFocus';
import type { UrgencyLevel } from '@/types';
import {
  URGENCY_OPTIONS,
  formatScheduleDateLabel,
  getLocalDateString,
  normalizeScheduledTime,
  resolveJobScheduling,
  type ResolvedJobScheduling,
} from '@utils/jobScheduling';

export interface JobSchedulingSectionProps {
  urgencyLevel: UrgencyLevel;
  onUrgencyChange: (level: UrgencyLevel) => void;
  scheduledDate: string;
  onScheduledDateChange: (value: string) => void;
  scheduledTime: string;
  onScheduledTimeChange: (value: string) => void;
  disabled?: boolean;
  style?: ViewStyle;
  /** Oculta el título interno si el padre ya muestra encabezado de sección. */
  hideTitle?: boolean;
}

const webDateInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  background: 'transparent',
  fontSize: 15,
  color: CHAMBA.navy,
  fontFamily: 'inherit',
  padding: '12px 0',
  minHeight: 44,
};

const webTimeInputStyle: React.CSSProperties = {
  ...webDateInputStyle,
};

const ScheduleDateField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  min: string;
  disabled?: boolean;
}> = ({ value, onChange, min, disabled }) => {
  if (Platform.OS === 'web') {
    return (
      // @ts-expect-error — input nativo web
      <input
        type="date"
        value={value}
        min={min}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={webDateInputStyle}
      />
    );
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="AAAA-MM-DD"
      placeholderTextColor={CHAMBA.muted}
      editable={!disabled}
      style={[styles.nativeInput, textInputWebFocusStyle]}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
};

const ScheduleTimeField: React.FC<{
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}> = ({ value, onChange, disabled }) => {
  if (Platform.OS === 'web') {
    return (
      // @ts-expect-error — input nativo web
      <input
        type="time"
        value={value.length >= 5 ? value.slice(0, 5) : value}
        disabled={disabled}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
          const next = normalizeScheduledTime(e.target.value);
          onChange(next ?? e.target.value);
        }}
        style={webTimeInputStyle}
      />
    );
  }

  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Ej. 14:30"
      placeholderTextColor={CHAMBA.muted}
      editable={!disabled}
      style={[styles.nativeInput, textInputWebFocusStyle]}
      autoCapitalize="none"
      autoCorrect={false}
    />
  );
};

const UrgencyPills: React.FC<{
  active: UrgencyLevel;
  onChange: (level: UrgencyLevel) => void;
  disabled?: boolean;
}> = ({ active, onChange, disabled }) => (
  <View style={styles.pillRow}>
    {URGENCY_OPTIONS.map((option) => {
      const selected = active === option.id;
      return (
        <TouchableOpacity
          key={option.id}
          style={[styles.pill, selected && styles.pillActive]}
          onPress={() => {
            if (!disabled) onChange(option.id);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityState={{ selected }}
        >
          <Ionicons
            name={
              option.id === 'hoy'
                ? 'flash'
                : option.id === 'manana'
                  ? 'sunny-outline'
                  : 'calendar-outline'
            }
            size={16}
            color={selected ? '#FFF' : CHAMBA.blue}
          />
          <Text style={[styles.pillText, selected && styles.pillTextActive]}>
            {option.label}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const JobSchedulingSection: React.FC<JobSchedulingSectionProps> = ({
  urgencyLevel,
  onUrgencyChange,
  scheduledDate,
  onScheduledDateChange,
  scheduledTime,
  onScheduledTimeChange,
  disabled = false,
  style,
  hideTitle = false,
}) => {
  const minDate = getLocalDateString(0);
  const activeHint = URGENCY_OPTIONS.find((o) => o.id === urgencyLevel)?.hint ?? '';

  const contextMessage = useMemo(() => {
    if (urgencyLevel === 'hoy') {
      return 'Los técnicos verán que necesitás el servicio hoy.';
    }
    if (urgencyLevel === 'manana') {
      const label = scheduledDate
        ? formatScheduleDateLabel(scheduledDate)
        : formatScheduleDateLabel(getLocalDateString(1));
      return `Programado para mañana (${label}).`;
    }
    if (scheduledDate) {
      return `Fecha elegida: ${formatScheduleDateLabel(scheduledDate)}`;
    }
    return 'Elegí la fecha en la que querés el servicio.';
  }, [urgencyLevel, scheduledDate]);

  return (
    <View style={[styles.wrap, style]}>
      {!hideTitle ? (
        <>
          <Text style={styles.mainTitle}>¿Cuándo lo necesitás?</Text>
          <Text style={styles.sectionHint}>{activeHint}</Text>
        </>
      ) : null}

      <UrgencyPills
        active={urgencyLevel}
        onChange={onUrgencyChange}
        disabled={disabled}
      />

      <View style={styles.infoCard}>
        <Ionicons name="information-circle-outline" size={18} color={CHAMBA.blue} />
        <Text style={styles.infoText}>{contextMessage}</Text>
      </View>

      {urgencyLevel === 'programado' ? (
        <View style={styles.fieldBlock}>
          <Text style={chambaStyles.formLabel}>Fecha del servicio</Text>
          <View style={[chambaStyles.formInputRow, disabled && styles.fieldDisabled]}>
            <Ionicons name="calendar-outline" size={18} color={CHAMBA.muted} style={styles.fieldIcon} />
            <ScheduleDateField
              value={scheduledDate}
              onChange={onScheduledDateChange}
              min={minDate}
              disabled={disabled}
            />
          </View>
        </View>
      ) : null}

      <View style={styles.fieldBlock}>
        <Text style={chambaStyles.formLabel}>Hora aproximada (opcional)</Text>
        <View style={[chambaStyles.formInputRow, disabled && styles.fieldDisabled]}>
          <Ionicons name="time-outline" size={18} color={CHAMBA.muted} style={styles.fieldIcon} />
          <ScheduleTimeField
            value={scheduledTime}
            onChange={onScheduledTimeChange}
            disabled={disabled}
          />
        </View>
        <Text style={styles.optionalHint}>
          Podés dejarla en blanco si te da igual la hora exacta.
        </Text>
      </View>
    </View>
  );
};

export interface UseJobSchedulingFieldsResult {
  urgencyLevel: UrgencyLevel;
  setUrgencyLevel: (level: UrgencyLevel) => void;
  scheduledDate: string;
  setScheduledDate: (value: string) => void;
  scheduledTime: string;
  setScheduledTime: (value: string) => void;
  schedulingPayload: ResolvedJobScheduling;
  scheduleError: string | null;
  isScheduleValid: boolean;
  resetScheduling: () => void;
}

/** Estado + validación mínima para formularios de publicación. */
export const useJobSchedulingFields = (): UseJobSchedulingFieldsResult => {
  const [urgencyLevel, setUrgencyLevelRaw] = useState<UrgencyLevel>('hoy');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');

  const setUrgencyLevel = useCallback((level: UrgencyLevel) => {
    setUrgencyLevelRaw(level);
    if (level === 'hoy') {
      setScheduledDate('');
    } else if (level === 'manana') {
      setScheduledDate(getLocalDateString(1));
    }
  }, []);

  const schedulingPayload = useMemo(
    () =>
      resolveJobScheduling({
        urgencyLevel,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
      }),
    [urgencyLevel, scheduledDate, scheduledTime],
  );

  const scheduleError =
    urgencyLevel === 'programado' && !scheduledDate.trim()
      ? 'Elegí una fecha para servicios programados.'
      : null;

  const resetScheduling = useCallback(() => {
    setUrgencyLevelRaw('hoy');
    setScheduledDate('');
    setScheduledTime('');
  }, []);

  return {
    urgencyLevel,
    setUrgencyLevel,
    scheduledDate,
    setScheduledDate,
    scheduledTime,
    setScheduledTime,
    schedulingPayload,
    scheduleError,
    isScheduleValid: !scheduleError,
    resetScheduling,
  };
};

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: CHAMBA.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    ...CARD_STEP_SHADOW,
  },
  mainTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: CHAMBA.navy,
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  sectionHint: {
    fontSize: 13,
    color: CHAMBA.muted,
    marginBottom: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: '#BFDBFE',
    backgroundColor: '#F8FAFC',
    minHeight: 44,
  },
  pillActive: {
    backgroundColor: CHAMBA.blue,
    borderColor: CHAMBA.blue,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    color: CHAMBA.navy,
  },
  pillTextActive: {
    color: '#FFF',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#1E40AF',
    fontWeight: '500',
  },
  fieldBlock: { marginBottom: 4 },
  fieldIcon: { marginRight: 8 },
  fieldDisabled: { opacity: 0.6 },
  nativeInput: {
    flex: 1,
    color: CHAMBA.navy,
    fontSize: 15,
    paddingVertical: 12,
  },
  optionalHint: {
    fontSize: 12,
    color: CHAMBA.muted,
    marginTop: 6,
    paddingLeft: 2,
  },
});
