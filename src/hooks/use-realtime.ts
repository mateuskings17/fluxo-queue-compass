import { useEffect, useRef } from "react";
import { useQueryClient, type QueryKey } from "@tanstack/react-query";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type TableName = "settings" | "sectors" | "stations" | "ticket_types" | "routing_rules" | "tickets" | "ticket_steps" | "calls";
type Listener = (table: string) => void;

/*
 * The database broadcasts a data-free "changed" doorbell on one shared topic whenever queue tables change.
 * Screens then re-fetch through the server; no queue data travels over this channel.
 * One channel per page, shared by every hook.
 */
const DOORBELL_TOPIC = "queue-updates";
const listeners = new Set<Listener>();
let channel: RealtimeChannel | null = null;

function subscribeDoorbell(listener: Listener) {
  listeners.add(listener);
  if (!channel) {
    channel = supabase
      .channel(DOORBELL_TOPIC)
      .on("broadcast", { event: "changed" }, (msg) => {
        const table = String((msg['payload'] as { table?: unknown } | undefined)?.table ?? "");
        listeners.forEach((l) => l(table));
      })
      .subscribe();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}

/** Invalidates the given queries whenever any of the tables change. */
export function useRealtimeInvalidate(tables: TableName[], keys: QueryKey[], pollMs = 15000) {
  const qc = useQueryClient();
  const keysRef = useRef(keys);
  keysRef.current = keys;
  const tablesKey = tables.join(",");

  useEffect(() => {
    const watched = new Set(tablesKey.split(","));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        keysRef.current.forEach((k) => void qc.invalidateQueries({ queryKey: k }));
      }, 120);
    };
    const unsubscribe = subscribeDoorbell((table) => {
      if (!table || watched.has(table)) flush();
    });
    // Safety net: refresh periodically in case a doorbell is missed on the local network.
    const interval = setInterval(flush, pollMs);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      unsubscribe();
    };
  }, [qc, tablesKey, pollMs]);
}

/** Keeps the shared configuration (unit, sectors, stations, ticket types) live everywhere. */
export function useConfigRealtime() {
  useRealtimeInvalidate(["settings", "sectors", "stations", "ticket_types", "routing_rules"], [["config"]], 30000);
}
