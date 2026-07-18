import React from 'react';
import { StartupErrorScreen } from './StartupErrorScreen';
import { supabase } from '@services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
    
    // Log catastrophic error to analytics
    // (columna real de analytics_events es event_name, no event_type — ver 064_analytics_events.sql)
    void supabase.from('analytics_events').insert({
      event_name: 'app_crash',
      metadata: {
        error: error.message,
        stack: info.componentStack
      }
    });
  }

  render() {
    if (this.state.error) {
      return (
      <StartupErrorScreen
        title="Algo salió mal. Reintentar."
        message="La aplicación encontró un problema al renderizar."
        details={this.state.error.message}
        // Add a retry button with deep recovery strategy
        onRetry={async () => {
          try {
            // 1. Limpiar caché local excepto la sesión de Supabase
            const keys = await AsyncStorage.getAllKeys();
            const keysToRemove = keys.filter(k => !k.includes('supabase.auth.token'));
            if (keysToRemove.length > 0) {
              await AsyncStorage.multiRemove(keysToRemove);
            }
          } catch (e) {
            console.warn('Error clearing cache', e);
          }

          // 2. Recargar aplicación
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.location.reload();
          } else {
            try {
              // Intento de soft-reload nativo
              const Updates = require('expo-updates');
              await Updates.reloadAsync();
            } catch (e) {
              // Fallback
              this.setState({ error: null });
            }
          }
        }}
      />
      );
    }
    return this.props.children;
  }
}
