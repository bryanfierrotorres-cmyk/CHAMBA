import { create } from 'zustand';

/**
 * Flag neutral "Modo desarrollador" del panel admin.
 *
 * Vive fuera de `operational/` y `technical/` a propósito: es el único punto que
 * ambos lados necesitan tocar (uno para prender el switch, otro para decidir si
 * se muestra), sin que `operational/` importe nada de `technical/` ni viceversa.
 * Store aislado — no comparte estado con `authStore` ni ningún otro store de la app.
 * Se reinicia a `false` en cada sesión (no persiste) a propósito: mínima complejidad.
 */
interface AdminDevModeState {
  enabled: boolean;
  toggle: () => void;
}

export const useAdminDevMode = create<AdminDevModeState>((set) => ({
  enabled: false,
  toggle: () => set((s) => ({ enabled: !s.enabled })),
}));
