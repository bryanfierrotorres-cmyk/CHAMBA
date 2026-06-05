#!/usr/bin/env node
/**
 * Limpia cachés CHAMBA en localStorage (web) vía instrucciones + Node no puede acceder al browser.
 * En dev: abrir consola del navegador y ejecutar:
 *   localStorage.removeItem('CHAMBA_WORKER_ASSIGNMENTS');
 *   localStorage.removeItem('CHAMBA_SERVICE_CATALOG_V1');
 *   localStorage.removeItem('CHAMBA_PILOT_PROFILE');
 */
console.log(`
CHAMBA — liberar espacio en el navegador

En https://chamba-woad.vercel.app abrí DevTools (F12) → Consola y pegá:

  ['CHAMBA_WORKER_ASSIGNMENTS','CHAMBA_SERVICE_CATALOG_V1','CHAMBA_PILOT_PROFILE'].forEach(k => localStorage.removeItem(k));

Luego recargá e iniciá sesión de nuevo.
`);
