import type { BookingType, EquipmentType } from "@prisma/client"

export type SlotStatus = "available" | "booked" | "blocked" | "unavailable" | "full"

export type DisplayStatus = "available" | "partial" | "yours" | "queued" | "blocked" | "unavailable" | "full"

export interface UserBookingRef {
  id: string
  bookingType: BookingType
  equipmentType: EquipmentType | null
}

export interface UserQueueEntryRef {
  id: string
  bookingType: BookingType
  equipmentType: EquipmentType | null
  position: number
}

export interface DurationAvailability {
  duration: 30 | 60
  exclusive: {
    status: SlotStatus
    reason: string
  }
  shared: Record<string, SlotStatus>
  userBooking: UserBookingRef | null
  userBookings: UserBookingRef[]
  userQueueEntry: UserQueueEntryRef | null
  queueCount: number
  bookedCount: number
}

export interface SlotAvailability {
  startTime: string
  durations: DurationAvailability[]
}

export interface DayAvailability {
  date: string
  facilityType: string
  slots: SlotAvailability[]
}
