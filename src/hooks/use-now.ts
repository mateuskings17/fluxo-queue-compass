import { useEffect, useState } from "react";

/** Current time, refreshed periodically; null until hydrated. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(i);
  }, [intervalMs]);
  return now;
}
