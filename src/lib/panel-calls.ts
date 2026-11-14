/** A sector screen never displays or announces another sector's calls. */
export function callsForSector<T extends { sector_id: string | null }>(calls: T[], sectorId: string): T[] {
  return calls.filter((call) => call.sector_id === sectorId);
}