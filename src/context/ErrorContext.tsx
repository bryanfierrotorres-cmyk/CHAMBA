import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ErrorContextProps {
  error: string | null;
  setError: (msg: string | null) => void;
}

const ErrorContext = createContext<ErrorContextProps | undefined>(undefined);

export const ErrorProvider = ({ children }: { children: ReactNode }) => {
  const [error, setError] = useState<string | null>(null);
  return (
    <ErrorContext.Provider value={{ error, setError }}>
      {children}
    </ErrorContext.Provider>
  );
};

export const useError = (): ErrorContextProps => {
  const ctx = useContext(ErrorContext);
  if (!ctx) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return ctx;
};
