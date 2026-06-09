import React, { useMemo } from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { ChambaSlidingToggle } from '@components/chamba/ChambaSlidingToggle';
import { CHAMBA } from '@constants/chambaUI';
import type { WorkerAgendaTab } from '@utils/workerAgendaClassification';

const TAB_DEFINITIONS: { id: WorkerAgendaTab; label: string; hint: string }[] = [
  {
    id: 'pendientes',
    label: 'Pendientes',
    hint: 'Esperando confirmación del cliente',
  },
  {
    id: 'activas',
    label: 'Activas',
    hint: 'Servicios en curso',
  },
  {
    id: 'historial',
    label: 'Historial',
    hint: 'Completadas o canceladas',
  },
];

export interface WorkerAgendaTabBarProps {
  active: WorkerAgendaTab;
  onChange: (tab: WorkerAgendaTab) => void;
  counts?: Partial<Record<WorkerAgendaTab, number>>;
  style?: ViewStyle;
}

const formatTabLabel = (base: string, count?: number): string =>
  count != null && count > 0 ? `${base} (${count})` : base;

/**
 * Selector premium de 3 pestañas para Agenda del técnico:
 * Pendientes | Activas | Historial
 */
export const WorkerAgendaTabBar: React.FC<WorkerAgendaTabBarProps> = ({
  active,
  onChange,
  counts,
  style,
}) => {
  const options = useMemo(
    () =>
      TAB_DEFINITIONS.map((tab) => ({
        id: tab.id,
        label: formatTabLabel(tab.label, counts?.[tab.id]),
      })),
    [counts],
  );

  const activeHint = TAB_DEFINITIONS.find((tab) => tab.id === active)?.hint ?? '';

  return (
    <View style={style}>
      <ChambaSlidingToggle
        options={options}
        active={active}
        onChange={onChange}
        cornerRadius={14}
        activeFontWeight="600"
        style={styles.toggle}
      />
      {!!activeHint && (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {activeHint}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  toggle: {
    marginTop: 4,
  },
  hint: {
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 4,
    fontSize: 12,
    color: CHAMBA.muted,
    fontWeight: '500',
    lineHeight: 17,
  },
});
