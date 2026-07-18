# CHAMBA — Evolución futura: capa Data Provider (NO implementada)

**Estado:** documentación de una posible evolución arquitectónica. Cero código escrito.
No forma parte de la Fase 3 aprobada — se registra para decidir en el futuro, cuando haya
2+ dominios migrados y se sienta la necesidad real (no antes, por disciplina anti-sobreingeniería).

---

## Qué resuelve

Hoy, `repositoryFactory` (`src/repositories/RepositoryFactory.ts`) es un **singleton a nivel de módulo**: cualquier archivo lo importa y llama `repositoryFactory.getProfileRepository()` directamente. Funciona bien para el piloto, pero tiene dos límites conocidos si el proyecto crece:

1. **Cambiar de modo (`demo`/`production`) requiere reiniciar la app** — el factory decide una sola vez, en el primer `getProfileRepository()`, y cachea la instancia.
2. **Tests no pueden inyectar un repositorio falso distinto** sin manipular el módulo global (`jest.mock`), lo cual es más fràgil que una inyección explícita.

## Propuesta (para cuando se justifique)

Un `DataProvider` de React (Context), que envuelve el árbol y expone el `RepositoryFactory` vía un hook:

```tsx
// Boceto — NO implementado
const RepositoriesContext = createContext<RepositoryFactory | null>(null);

export const DataProvider: React.FC<{ factory: RepositoryFactory; children: ReactNode }> =
  ({ factory, children }) => (
    <RepositoriesContext.Provider value={factory}>{children}</RepositoriesContext.Provider>
  );

export const useProfileRepository = (): ProfileRepository => {
  const factory = useContext(RepositoriesContext);
  if (!factory) throw new Error('useProfileRepository fuera de <DataProvider>');
  return factory.getProfileRepository();
};
```

Uso en `App.tsx` (boceto, no aplicado):
```tsx
<DataProvider factory={repositoryFactory}>
  <RootNavigator />
</DataProvider>
```

## Ventajas de esta evolución (cuando se implemente)

- **Toggle de modo en caliente**: un menú de desarrollador podría cambiar `demo`↔`production` sin reiniciar la app, re-renderizando con un `factory` distinto vía `setState`.
- **Tests limpios**: en un test, envolver el componente en `<DataProvider factory={fakeFactory}>` sin tocar módulos globales ni usar `jest.mock`.
- **Mismo patrón para todos los dominios futuros** — un solo Provider, un hook por dominio (`useProfileRepository`, `useJobsRepository`, ...).

## Por qué NO se implementa ahora

- El singleton actual ya cumple el objetivo de esta fase (backend intercambiable por variable de entorno).
- Ningún caso de uso real hoy necesita cambiar de modo sin reiniciar, ni inyectar un factory distinto en tests (no hay tests automatizados todavía — ver `MVP_ROADMAP.md`).
- Añadir un Context Provider ahora, sin un consumidor real que lo necesite, sería la sobreingeniería que el usuario pidió explícitamente evitar.

## Cuándo reconsiderar

- Cuando se escriban los primeros tests automatizados del dominio Perfil (Fase 1 del `MVP_ROADMAP.md`) y se sienta la fricción de mockear el módulo singleton.
- Cuando se quiera un modo "demo" activable desde un menú de desarrollador en runtime, sin rebuild.
- Cuando 2+ dominios ya estén migrados y el patrón de `RepositoryFactory` esté validado en la práctica.
