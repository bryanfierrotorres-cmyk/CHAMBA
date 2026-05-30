import { Platform } from 'react-native';
import type { NavigationContainerRef, NavigationState, PartialState } from '@react-navigation/native';
import type { RootStackParamList } from '@/types';

let lastDepth = 0;
let isHandlingPop = false;

function getNavigationDepth(state: NavigationState | PartialState<NavigationState> | undefined): number {
  if (!state?.routes?.length) return 0;

  let depth = 0;
  let current: NavigationState | PartialState<NavigationState> | undefined = state;

  while (current?.routes?.length) {
    depth += 1;
    const index = current.index ?? 0;
    const route = current.routes[index];
    current = route.state as NavigationState | PartialState<NavigationState> | undefined;
  }

  return depth;
}

/** Sincroniza pushState cuando el usuario navega hacia adelante. */
export function syncWebHistoryOnNavigate(
  state: NavigationState | undefined,
  ref: NavigationContainerRef<RootStackParamList>,
): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !state || isHandlingPop) return;

  const depth = getNavigationDepth(state);

  if (depth > lastDepth) {
    window.history.pushState({ chambaNav: depth }, '', window.location.pathname + window.location.search);
  }

  lastDepth = depth;
}

/** Escucha el botón/gesto atrás del navegador móvil. */
export function attachWebHistory(
  ref: NavigationContainerRef<RootStackParamList>,
): () => void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};

  const initial = ref.isReady() ? ref.getRootState() : undefined;
  lastDepth = getNavigationDepth(initial) || 1;
  window.history.replaceState(
    { chambaNav: lastDepth },
    '',
    window.location.pathname + window.location.search,
  );

  const onPopState = () => {
    if (!ref.isReady()) return;

    isHandlingPop = true;

    if (ref.canGoBack()) {
      ref.goBack();
    } else {
      window.history.pushState(
        { chambaNav: lastDepth },
        '',
        window.location.pathname + window.location.search,
      );
    }

    requestAnimationFrame(() => {
      lastDepth = getNavigationDepth(ref.getRootState());
      isHandlingPop = false;
    });
  };

  window.addEventListener('popstate', onPopState);
  return () => window.removeEventListener('popstate', onPopState);
}
