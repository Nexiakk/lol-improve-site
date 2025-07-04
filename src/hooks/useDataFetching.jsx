import { useState, useEffect, useCallback } from "react";
import { useLoading } from "../contexts/LoadingContext";

/**
 * A custom hook to handle data fetching and global loading state.
 * @param {Function} fetchFunction - The async function that fetches data.
 * @param {Array} dependencies - The dependency array for the useEffect hook.
 * @returns An object containing the fetched data, any errors, and the component's specific loading state.
 */
export const useDataFetching = (fetchFunction, dependencies = []) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const { setIsLoading } = useLoading();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchFunction();
      setData(result);
    } catch (e) {
      console.error("Data fetching error:", e);
      setError(e);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies); // Dependencies are passed in from the component

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, error };
};
