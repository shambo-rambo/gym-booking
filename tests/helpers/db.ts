/**
 * Direct DB helpers for test setup/teardown. Only used in beforeAll/afterAll.
 * Requires DATABASE_URL or DIRECT_URL in the environment — the same values
 * used by the app. Call `initDb()` before any helper and `closeDb()` in
 * afterAll.
 */
import { PrismaClient } from "@prisma/client"

let prisma: PrismaClient | null = null

export function getDb(): PrismaClient {
  if (!prisma) prisma = new PrismaClient()
  return prisma
}

export async function closeDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect()
    prisma = null
  }
}

export async function clearUserByEmail(email: string): Promise<void> {
  const db = getDb()
  await db.user.deleteMany({ where: { email } })
}

export async function clearBookingsForUser(email: string): Promise<void> {
  const db = getDb()
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return
  await db.booking.deleteMany({ where: { userId: user.id } })
  await db.queueEntry.deleteMany({ where: { userId: user.id } })
}

export async function getQueueEntry(email: string) {
  const db = getDb()
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return null
  return db.queueEntry.findFirst({ where: { userId: user.id } })
}

export async function markQueueEntryNotified(email: string): Promise<void> {
  const db = getDb()
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return
  const entry = await db.queueEntry.findFirst({ where: { userId: user.id } })
  if (!entry) return
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000)
  await db.queueEntry.update({
    where: { id: entry.id },
    data: { notifiedAt: new Date(), expiresAt },
  })
}
