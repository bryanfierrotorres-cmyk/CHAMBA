import React from 'react';

/** Envuelve el flujo cliente; extensible para flags de plataforma o mantenimiento. */
export const ClientJobPlatformGate: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
);
