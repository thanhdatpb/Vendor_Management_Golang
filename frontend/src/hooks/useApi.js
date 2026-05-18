import { useState, useEffect, useCallback, useRef } from 'react';

export function useApi(apiFn, deps = [], options = {}) {
  const { immediate = true, defaultData = null } = options;
  const [data,    setData]    = useState(defaultData);
  const [loading, setLoading] = useState(immediate);
  const [error,   setError]   = useState(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async (...args) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn(...args);
      if (mountedRef.current) setData(res.data);
      return res.data;
    } catch (err) {
      if (mountedRef.current) setError(err.message);
      throw err;
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (immediate) fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}