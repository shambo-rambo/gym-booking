import { EquipmentType } from "@prisma/client"

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  WEIGHTS_MACHINE: "Weights Machine",
  FREE_DUMBBELLS:  "Dumbbells",
  TREADMILL:       "Treadmill",
  ROWING_MACHINE:  "Rowing Machine",
  EXERCISE_BIKE:   "Exercise Bike",
}

export const EQUIPMENT_LIST = Object.entries(EQUIPMENT_LABELS) as [EquipmentType, string][]
