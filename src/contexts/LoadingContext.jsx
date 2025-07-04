import React, { createContext, useState, useContext, useMemo } from 'react';

// Create the context with a default value
const LoadingContext = createContext({
  isLoading: false,
  setIsLoading: () => {},
});

/**
 * A custom hook to easily access the loading context.
 */
export const useLoading = () => useContext(LoadingContext);

/**
 * The provider component that will wrap our application.
 */
export const LoadingProvider = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);

  // useMemo ensures that the context value object is only recreated when isLoading changes.
  const value = useMemo(() => ({ isLoading, setIsLoading }), [isLoading]);

  return (
    <LoadingContext.Provider value={value}>
      {children}
    </LoadingContext.Provider>
  );
};