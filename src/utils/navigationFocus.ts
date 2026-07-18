import type { NavigationState, PartialState } from '@react-navigation/native';

type NavState = NavigationState | PartialState<NavigationState> | undefined;

/** Nombre de la ruta hoja enfocada (recorre stacks y tabs anidados). */
export function getFocusedRouteName(state: NavState): string | undefined {
  if (!state?.routes?.length) return undefined;
  const index = state.index ?? 0;
  const route = state.routes[index];
  if (!route) return undefined;
  if (route.state) return getFocusedRouteName(route.state) ?? route.name;
  return route.name;
}

/** Ocultar soporte WhatsApp mientras el usuario está en el chat del servicio. */
export function isJobChatRouteFocused(state: NavState): boolean {
  return getFocusedRouteName(state) === 'JobChat';
}

/** Ocultar soporte WhatsApp en el formulario de Nueva Solicitud — su botón
 * principal ("Siguiente paso" / "Confirmar Solicitud") queda tapado por la
 * burbuja ahí, ya que esa pantalla oculta la tab bar y pierde el espacio
 * que normalmente la mantiene despejada. */
export function isCreateJobFormFocused(state: NavState): boolean {
  return getFocusedRouteName(state) === 'CreateJobForm';
}
