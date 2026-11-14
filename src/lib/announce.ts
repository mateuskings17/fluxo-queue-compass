/** Decides which panel calls are new and should be spoken. Pure, for testing. */

/** A refresh gap longer than this means the TV slept or lost the network; calls made meanwhile are old news. */
export const STALE_GAP_MS = 90_000;
const MAX_REMEMBERED = 300;

export function pickCallsToAnnounce<C extends { id: string }>(
  calls: readonly C[],
  seen: Set<string>,
  opts: { soundOn: boolean; gapMs: number },
): C[] {
  // calls arrive newest first; announce oldest first
  const fresh = calls.filter((c) => c.id && !seen.has(c.id)).reverse();
  fresh.forEach((c) => seen.add(c.id));
  if (seen.size > MAX_REMEMBERED) {
    const keep = new Set(calls.map((c) => c.id));
    for (const id of seen) {
      if (seen.size <= MAX_REMEMBERED) break;
      if (!keep.has(id)) seen.delete(id);
    }
  }
  if (!opts.soundOn || opts.gapMs > STALE_GAP_MS) return [];
  return fresh;
}
