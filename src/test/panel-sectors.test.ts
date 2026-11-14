import { describe, expect, it } from "vitest";
import { callsForSector } from "@/lib/panel-calls";
import { pickCallsToAnnounce } from "@/lib/announce";

describe("independent sector panels", () => {
  const sectors = ["Mamografia", "Tomografia", "Recepção", "Ultrassom", "Endoscopia"];
  const calls = sectors.map((sector_id, i) => ({ id: `call-${i}`, sector_id }));
  for (const sector of sectors) {
    it(`${sector} displays and announces only its own calls`, () => {
      const own = callsForSector([...calls, { id: "unassigned", sector_id: null }], sector);
      expect(own).toEqual([calls.find((c) => c.sector_id === sector)]);
      const seen = new Set<string>();
      expect(pickCallsToAnnounce(own, seen, { soundOn: true, gapMs: 8000 })).toEqual(own);
      expect(pickCallsToAnnounce(own, seen, { soundOn: true, gapMs: 8000 })).toEqual([]);
    });
  }
});