import { useEffect, useState } from "react";

export function Clock({ className, withDate = false }: { className?: string; withDate?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const i = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(i);
  }, []);
  if (!now) return <span className={className}>&nbsp;</span>;
  return (
    <span className={className}>
      {withDate && (
        <span className="mr-3 font-medium opacity-70">
          {now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
        </span>
      )}
      {now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}
