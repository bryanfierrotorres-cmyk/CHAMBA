/**
 * analytics.ts — Motor de Analíticas Internas de CHAMBA
 *
 * Uso:
 *   import { trackEvent } from '@services/analytics';
 *   trackEvent('search', userId, { query: 'plomería', category: 'plomeria' });
 *
 * La función es fire-and-forget: nunca lanza excepciones ni bloquea el hilo de UI.
 * Los eventos se insertan en la tabla `analytics_events` de Supabase.
 */

import { supabase } from '@services/supabase';

/**
 * Registra un evento analítico de forma asíncrona sin bloquear la UI.
 *
 * @param eventName  Nombre del evento (ej. 'search', 'request_created')
 * @param userId     UUID del usuario (puede ser null para eventos anónimos)
 * @param metadata   Objeto JSON libre con datos contextuales del evento
 */
export const trackEvent = (
  eventName: string,
  userId: string | null | undefined,
  metadata: Record<string, unknown> = {},
): void => {
  // Fire-and-forget: envolvemos en una promesa que tragamos silenciosamente
  void (async () => {
    try {
      await supabase.from('analytics_events').insert({
        event_name: eventName,
        user_id: userId ?? null,
        metadata,
      });
    } catch (err) {
      // Silencioso en producción — nunca interrumpe la experiencia del usuario
      if (__DEV__) {
        console.warn('[Analytics] trackEvent failed:', eventName, err);
      }
    }
  })();
};
