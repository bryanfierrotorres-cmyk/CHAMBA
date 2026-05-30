/**
 * Estilos y utilidades exclusivas de layout web móvil (Vercel).
 * En Android/iOS todas las exportaciones están protegidas con Platform.OS === 'web'.
 */
import { Platform, type ViewStyle } from 'react-native';

/** Altura base de tab bar (sin safe area). */
export const WEB_TAB_BAR_BASE_HEIGHT = 56;

/** CSS global para viewport dinámico en Safari/Chrome móvil. */
export const WEB_MOBILE_CSS = `
  :root {
    --chamba-vh: 1vh;
  }
  html {
    height: 100%;
    height: 100dvh;
    height: calc(var(--chamba-vh, 1vh) * 100);
    overflow: hidden;
    -webkit-text-size-adjust: 100%;
  }
  body {
    height: 100%;
    height: 100dvh;
    height: calc(var(--chamba-vh, 1vh) * 100);
    margin: 0;
    padding: 0;
    overflow: hidden;
    overscroll-behavior: none;
    width: 100%;
    position: relative;
  }
  #root {
    display: flex;
    flex-direction: column;
    height: 100%;
    height: 100dvh;
    height: calc(var(--chamba-vh, 1vh) * 100);
    min-height: -webkit-fill-available;
    width: 100%;
    overflow: hidden;
    position: relative;
  }
`;

/** Actualiza --chamba-vh cuando cambia la barra del navegador móvil. */
export function installWebViewportListeners(): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  const update = () => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    document.documentElement.style.setProperty('--chamba-vh', `${h * 0.01}px`);
  };

  update();
  window.addEventListener('resize', update);
  window.visualViewport?.addEventListener('resize', update);
  window.visualViewport?.addEventListener('scroll', update);

  return () => {
    window.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('resize', update);
    window.visualViewport?.removeEventListener('scroll', update);
  };
}

export const webAppShellStyle = Platform.OS === 'web'
  ? ({
      flex: 1,
      height: '100dvh' as unknown as number,
      maxHeight: '100dvh' as unknown as number,
      overflow: 'hidden' as const,
    })
  : ({ flex: 1 });

export const webFixedTabBarStyle = (Platform.OS === 'web'
  ? {
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
    }
  : {}) as ViewStyle;

export const webMinViewportStyle = Platform.OS === 'web'
  ? ({ minHeight: '100dvh' as unknown as number })
  : ({});

/** Padding inferior para contenido detrás de tab bar fija en web. */
export function webTabScenePadding(bottomInset: number): number {
  if (Platform.OS !== 'web') return 0;
  return WEB_TAB_BAR_BASE_HEIGHT + Math.max(bottomInset, 8) + 12;
}
