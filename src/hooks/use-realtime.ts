import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type TableName = "settings" | "sectors" | "stations" | "ticket_types" | "routing_rules" | "tickets" | "ticket_steps" | "calls";

/** Invalidates the given queries whenever any of the tables change. */
export function useRealtimeInvalidate(tables: TableName[], keys: QueryKey[]) {
  const qc = useQueryClient();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const tablesKey = tables.join(",");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        keysRef.current.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      }, 120);
    };
    let channel = supabase.channel(`rt-${tablesKey}-${Math.random().toString(36).slice(2)}`);
    tablesKey.split(",").forEach((table) => {
      channel = channel.on("postgres_changes", { event: "*", schema: "public", table }, flush);
    });
    channel.subscribe();
    // Safety net: refresh periodically in case a realtime message is missed on the local network.
    const interval = setInterval(flush, 30000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [qc, tablesKey]);
}

/** Keeps the shared configuration (unit, sectors, stations, ticket types) live everywhere. */
export function useConfigRealtime() {
  useRealtimeInvalidate(["settings", "sectors", "stations", "ticket_types", "routing_rules"], [["config"]]);
}
