# Centro Técnico — pendiente (Fase 2)

Carpeta reservada para las pantallas de diagnóstico interno (Estado del sistema,
Logs/errores, Rendimiento) descritas en el plan de migración. Vacía a propósito:
se puebla en la Fase 2, reutilizando `src/utils/systemHealth.ts` y la tabla
`analytics_events` que ya existen.

Regla de desacoplamiento: nada bajo `technical/` importa de `operational/`, ni
viceversa. Solo `AdminNavigator.tsx` conoce a ambos.
