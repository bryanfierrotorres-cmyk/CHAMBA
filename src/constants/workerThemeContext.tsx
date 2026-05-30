import React, { createContext, useContext } from 'react';
import { COLORS as GLOBAL_COLORS, FONT_SIZE, SPACING, BORDER_RADIUS, FONT_WEIGHT } from './theme';
import { WORKER_COLORS, M3, WORKER_SPACING } from './workerTheme';

const WorkerThemeContext = createContext(false);

export const WorkerThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <WorkerThemeContext.Provider value={true}>{children}</WorkerThemeContext.Provider>
);

export const useIsWorkerTheme = (): boolean => useContext(WorkerThemeContext);

/** Theme tokens — worker M3 when inside WorkerNavigator, global elsewhere */
export function useAppTheme() {
  const isWorker = useIsWorkerTheme();
  return {
    isWorker,
    colors: isWorker ? WORKER_COLORS : GLOBAL_COLORS,
    m3: isWorker ? M3 : null,
    spacing: isWorker ? WORKER_SPACING : SPACING,
    fontSize: FONT_SIZE,
    borderRadius: BORDER_RADIUS,
    fontWeight: FONT_WEIGHT,
  };
}
