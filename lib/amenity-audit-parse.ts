import { VALID_UNITS } from "./apartments"

// Inception's "Who" field is a free-text label set by whoever configured each fob
// (e.g. "305 - 292" or "SP22906 Milan Owners Corp - 305"), not a structured unit
// reference. \b\d{1,4}\b pulls out standalone 1-4 digit tokens — word boundaries
// mean a longer run like "22906" is never matched, since there's no boundary
// between its 4th and 5th digit. Candidates are then checked against VALID_UNITS
// (the same source of truth used for registration) to discard incidental numbers
// like fob IDs. If more than one candidate remains valid, the string is ambiguous
// and treated as unparseable rather than guessed at — a false negative here just
// means a log line is skipped, whereas a false positive would mis-flag a resident.
export function extractUnitNumber(who: string | undefined | null): number | null {
  if (!who) return null

  const candidates = who.match(/\b\d{1,4}\b/g) ?? []
  const validCandidates = Array.from(new Set(candidates.map(Number))).filter((n) => VALID_UNITS.has(n))

  if (validCandidates.length !== 1) {
    console.warn(`[amenity-audit] could not uniquely resolve unit number from Inception "Who": "${who}"`)
    return null
  }

  return validCandidates[0]
}
