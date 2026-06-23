import React from 'react';
import { StartupErrorScreen } from './StartupErrorScreen';

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
  }

  render() {
    if (this.state.error) {
      return (
      <StartupErrorScreen
        title="Error inesperado al cargar CHAMBA"
        message="La aplicación encontró un problema al renderizar. Intenta recargar la página."
        details={this.state.error.message}
        // Add a retry button
        actionLabel="Reintentar"
        onAction={() => {
          if (typeof window !== 'undefined') {
            window.location.reload();
          }
        }}
      />
      );
    }
    return this.props.children;
  }
}
