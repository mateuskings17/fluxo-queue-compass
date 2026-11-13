import { useCallback, useEffect, useState } from "react";

/** Small localStorage-backed state, read after hydration to avoid SSR mismatches. */
export function useLocalSetting<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      setValue(raw != null ? (JSON.parse(raw) as T) : initial);
    } catch {
      setValue(initial);
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (v: T) => {
      setValue(v);
      try {
        window.localStorage.setItem(key, JSON.stringify(v));
      } catch {
        /* ignore */
      }
    },
    [key],
  );

  return [value, update, loaded] as const;
}
