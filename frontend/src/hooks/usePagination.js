import { useState, useEffect, useCallback } from 'react';

export function usePagination(apiFn, params = {}) {
  const [items,      setItems]      = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [page,       setPage]       = useState(1);

  const load = useCallback(async (p = 1, extra = {}) => {
    setLoading(true);
    try {
      const res = await apiFn({ ...params, ...extra, page: p, per_page: 15 });
      setItems(res.data.data);
      setPagination({
        current:  res.data.current_page,
        last:     res.data.last_page,
        total:    res.data.total,
        from:     res.data.from,
        to:       res.data.to,
      });
      setPage(p);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => { load(1); }, [load]);

  return { items, pagination, loading, error, page, setPage: load, reload: () => load(page) };
}
