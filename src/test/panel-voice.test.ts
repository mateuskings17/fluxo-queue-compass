import { describe, expect, it } from "vitest";
import { chooseFemalePtBrVoice } from "@/lib/voice";
import { pickCallsToAnnounce, STALE_GAP_MS } from "@/lib/announce";

describe("panel voice choice", () => {
  it("prefers a female Brazilian Portuguese voice over a male one", () => {
    const choice = chooseFemalePtBrVoice([
      { name: "Microsoft Daniel - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Microsoft Francisca Online (Natural) - Portuguese (Brazil)", lang: "pt-BR" },
      { name: "Google US English", lang: "en-US" },
    ]);
    expect(choice?.voice.name).toContain("Francisca");
    expect(choice?.female).toBe(true);
  });

  it("prefers pt-BR over pt-PT, also with Android-style language codes", () => {
    const choice = chooseFemalePtBrVoice([
      { name: "Joana", lang: "pt-PT" },
      { name: "pt-br-x-afs-local", lang: "pt_BR" },
    ]);
    expect(choice?.voice.name).toBe("pt-br-x-afs-local");
    expect(choice?.brazilian).toBe(true);
  });

  it("returns nothing when no Portuguese voice is installed", () => {
    expect(chooseFemalePtBrVoice([{ name: "Samantha", lang: "en-US" }])).toBeNull();
  });
});

describe("panel announcements", () => {
  const c = (id: string) => ({ id });

  it("does not announce calls already on screen when the panel opens", () => {
    const seen = new Set(["a2", "a1"]);
    expect(pickCallsToAnnounce([c("a2"), c("a1")], seen, { soundOn: true, gapMs: 8000 })).toEqual([]);
  });

  it("announces new calls once, oldest first", () => {
    const seen = new Set(["a1"]);
    const first = pickCallsToAnnounce([c("a3"), c("a2"), c("a1")], seen, { soundOn: true, gapMs: 8000 });
    expect(first.map((x) => x.id)).toEqual(["a2", "a3"]);
    const again = pickCallsToAnnounce([c("a3"), c("a2"), c("a1")], seen, { soundOn: true, gapMs: 8000 });
    expect(again).toEqual([]);
  });

  it("stays silent for calls made before the voice was activated", () => {
    const seen = new Set<string>();
    expect(pickCallsToAnnounce([c("b1")], seen, { soundOn: false, gapMs: 8000 })).toEqual([]);
    expect(pickCallsToAnnounce([c("b1")], seen, { soundOn: true, gapMs: 8000 })).toEqual([]);
  });

  it("stays silent for calls missed while the TV slept or was offline", () => {
    const seen = new Set<string>();
    expect(pickCallsToAnnounce([c("d1")], seen, { soundOn: true, gapMs: STALE_GAP_MS + 1 })).toEqual([]);
  });
});
