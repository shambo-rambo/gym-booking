export const USERS = {
  userA: {
    email: "resident1@gym.local",
    password: "resident123",
    name: "John Resident",
    apartmentNumber: "101",
  },
  userB: {
    email: "resident2@gym.local",
    password: "resident123",
    name: "Jane Smith",
    apartmentNumber: "205",
  },
  manager: {
    email: "manager1@gym.local",
    password: "manager123",
  },
} as const

export const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000"
export const BUILDING_CODE = process.env.BUILDING_CODE ?? ""
