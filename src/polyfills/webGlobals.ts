/**
 * Polyfills mínimos para Expo Web en Vercel / navegadores puros.
 * Debe importarse antes que cualquier otro módulo de la app.
 */
import { Platform } from 'react-native';

if (Platform.OS === 'web' && typeof window !== 'undefined') {
  const w = window as typeof window & {
    process?: { env: Record<string, string | undefined> };
    global?: typeof window;
  };

  if (typeof w.global === 'undefined') {
    w.global = w;
  }

  if (typeof w.process === 'undefined') {
    w.process = { env: {} };
  } else if (!w.process.env) {
    w.process.env = {};
  }

  // Asegura altura del root antes del primer paint (evita flash en blanco).
  const root = document.getElementById('root');
  if (root) {
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.width = '100%';
    root.style.height = '100dvh';
    root.style.minHeight = '-webkit-fill-available';
    root.style.overflow = 'hidden';
  }

  const vh = (window.visualViewport?.height ?? window.innerHeight) * 0.01;
  document.documentElement.style.setProperty('--chamba-vh', `${vh}px`);
}
