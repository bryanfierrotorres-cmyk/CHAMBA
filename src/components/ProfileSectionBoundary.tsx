import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  children: React.ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

/** Evita que una sección del perfil tumbe toda la pantalla. */
export class ProfileSectionBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.warn('[ProfileSectionBoundary]', this.props.title ?? 'section', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.fallback}>
          <Text style={styles.fallbackTitle}>
            No se pudo cargar {this.props.title ?? 'esta sección'}
          </Text>
          <Text style={styles.fallbackMsg}>{this.state.error.message}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  fallback: {
    padding: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  fallbackTitle: { fontSize: 14, fontWeight: '600', color: '#B91C1C', marginBottom: 4 },
  fallbackMsg: { fontSize: 12, color: '#7F1D1D' },
});
