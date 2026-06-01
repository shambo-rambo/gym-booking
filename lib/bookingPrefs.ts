import type { BookingType, EquipmentType } from "@prisma/client"

export type Amenity = "gym" | "sauna" | "library"

export interface BookingPrefs {
  amenity: Amenity
  bookingType: BookingType
  duration: 30 | 60
  equipment: EquipmentType[]
}

const KEY = "gymBookingPrefs"

export function loadBookingPrefs(): BookingPrefs | null {
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(KEY) : null
    return raw ? (JSON.parse(raw) as BookingPrefs) : null
  } catch {
    return null
  }
}

export function saveBookingPrefs(prefs: BookingPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {}
}
