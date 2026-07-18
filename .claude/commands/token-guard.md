# TOKEN GUARD v1.0 — PROTOCOLO DE EFICIENCIA PARA CLAUDE CODE

## Objetivo

Reducir el consumo de tokens sin disminuir la calidad técnica.

Cada token debe aportar información útil.

---

# REGLA 1 — NO ESCANEAR TODO EL PROYECTO

Está prohibido hacer búsquedas globales si el usuario ya indicó el archivo.

❌ Incorrecto

Buscar en todo el workspace.

✅ Correcto

Abrir únicamente el archivo indicado.

Solo ampliar la búsqueda cuando exista evidencia de que el problema proviene de otro archivo.

---

# REGLA 2 — RADIO DE BÚSQUEDA MÍNIMO

Empieza siempre con:

1 archivo

↓

2 archivos relacionados

↓

dependencias directas

↓

recién después ampliar el alcance.

Nunca abras decenas de archivos por defecto.

---

# REGLA 3 — NO LEER ARCHIVOS GRANDES COMPLETOS

Si un archivo tiene cientos o miles de líneas:

* localizar la función;
* leer únicamente esa sección;
* ampliar solo si es necesario.

---

# REGLA 4 — NO EXPLICAR TEORÍA

No escribas explicaciones largas.

Entrega:

* evidencia;
* diagnóstico;
* solución.

Nada más.

---

# REGLA 5 — NO REPETIR CONTEXTO

Si el contexto ya fue establecido durante la sesión:

No vuelvas a resumirlo.

No vuelvas a explicar la arquitectura.

Continúa desde el estado actual.

---

# REGLA 6 — CAMBIOS QUIRÚRGICOS

Si el bug está en una función:

Modificar únicamente esa función.

No reformatear el archivo.

No mover código.

No hacer limpieza.

No cambiar nombres.

---

# REGLA 7 — NO REFACTORIZAR

Mientras exista un bug abierto queda prohibido:

* refactorizar;
* optimizar;
* reorganizar carpetas;
* renombrar componentes;
* cambiar estilos.

Resolver únicamente el problema solicitado.

---

# REGLA 8 — NO INVENTAR

Si falta información:

Pedir únicamente el dato necesario.

No explorar todo el proyecto intentando descubrirlo.

---

# REGLA 9 — USAR EVIDENCIA

Cada afirmación debe estar respaldada por:

* archivo;
* función;
* línea aproximada.

No emitir hipótesis largas.

---

# REGLA 10 — CAMBIO MÍNIMO

La solución debe modificar el menor número posible de líneas.

Si existen dos soluciones:

Elegir siempre la de menor impacto.

---

# REGLA 11 — DETENERSE

Cuando el bug solicitado esté resuelto:

Detener la búsqueda.

No seguir buscando "mejoras".

No optimizar otras áreas.

No hacer cambios preventivos.

---

# REGLA 12 — MEMORIA DE SESIÓN

No volver a inspeccionar archivos ya analizados salvo que hayan cambiado.

Reutilizar el conocimiento obtenido durante la sesión.

---

# REGLA 13 — RESPUESTA COMPACTA

Responder utilizando este formato:

Diagnóstico

Archivos inspeccionados

Archivos modificados

Motivo

Resultado

No generar textos extensos.

---

# REGLA 14 — PRESUPUESTO DE TOKENS

Antes de comenzar, estima el alcance.

* Bajo: 1–2 archivos.
* Medio: hasta 5 archivos.
* Alto: más de 5 archivos.

Si el trabajo supera el presupuesto inicial, detenerse y solicitar autorización para ampliar la búsqueda.

---

# OBJETIVO

Resolver el problema utilizando la menor cantidad posible de:

* archivos abiertos;
* búsquedas;
* modificaciones;
* tokens;

manteniendo la estabilidad del proyecto.
