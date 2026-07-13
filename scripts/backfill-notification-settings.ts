import { PrismaClient, NotificationCategory, NotificationPreference } from '@prisma/client'

const prisma = new PrismaClient()

const CATEGORIES: NotificationCategory[] = ['BOOKINGS', 'AMENITY', 'MAINTENANCE', 'URGENT', 'GENERAL', 'MOVE']

function defaultsFor(category: NotificationCategory, pref: NotificationPreference) {
  if (category === 'URGENT') {
    return { email: true, sms: true, push: true }
  }
  return {
    email: pref === 'EMAIL_ONLY' || pref === 'BOTH',
    sms: pref === 'SMS_ONLY' || pref === 'BOTH',
    push: true,
  }
}

async function main() {
  const PAGE_SIZE = 100
  let cursor: string | undefined
  let usersProcessed = 0
  let rowsCreated = 0
  let usersAlreadyMigrated = 0

  while (true) {
    const users = await prisma.user.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, notificationPreference: true, notificationSettings: { select: { category: true } } },
    })

    if (users.length === 0) break

    for (const user of users) {
      usersProcessed++
      const existing = new Set(user.notificationSettings.map((s) => s.category))
      const missing = CATEGORIES.filter((c) => !existing.has(c))

      if (missing.length === 0) {
        usersAlreadyMigrated++
        continue
      }

      const result = await prisma.notificationSetting.createMany({
        data: missing.map((category) => ({
          userId: user.id,
          category,
          ...defaultsFor(category, user.notificationPreference),
        })),
        skipDuplicates: true,
      })
      rowsCreated += result.count
    }

    cursor = users[users.length - 1].id
    if (users.length < PAGE_SIZE) break
  }

  console.log(`Processed ${usersProcessed} users.`)
  console.log(`Already fully migrated: ${usersAlreadyMigrated}.`)
  console.log(`Created ${rowsCreated} NotificationSetting rows.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
