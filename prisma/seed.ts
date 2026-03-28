import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Create 2 manager accounts
  const hashedPassword = await bcrypt.hash('manager123', 10)

  const manager1 = await prisma.user.upsert({
    where: { email: 'manager1@gym.local' },
    update: {},
    create: {
      email: 'manager1@gym.local',
      name: 'Manager One',
      password: hashedPassword,
      apartmentNumber: 0, // Managers don't belong to apartments
      role: 'MANAGER',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })

  const manager2 = await prisma.user.upsert({
    where: { email: 'manager2@gym.local' },
    update: {},
    create: {
      email: 'manager2@gym.local',
      name: 'Manager Two',
      password: hashedPassword,
      apartmentNumber: 0,
      role: 'MANAGER',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })

  console.log('Created managers:', { manager1, manager2 })
  console.log('Manager credentials: manager1@gym.local / manager123')

  // Create test resident users
  const residentPassword = await bcrypt.hash('resident123', 10)

  const resident1 = await prisma.user.upsert({
    where: { email: 'resident1@gym.local' },
    update: {},
    create: {
      email: 'resident1@gym.local',
      name: 'John Resident',
      password: residentPassword,
      apartmentNumber: 101,
      role: 'RESIDENT',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })

  const resident2 = await prisma.user.upsert({
    where: { email: 'resident2@gym.local' },
    update: {},
    create: {
      email: 'resident2@gym.local',
      name: 'Jane Smith',
      password: residentPassword,
      apartmentNumber: 205,
      role: 'RESIDENT',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })

  const resident3 = await prisma.user.upsert({
    where: { email: 'resident3@gym.local' },
    update: {},
    create: {
      email: 'resident3@gym.local',
      name: 'Mike Johnson',
      password: residentPassword,
      apartmentNumber: 312,
      role: 'RESIDENT',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })

  console.log('Created residents:', { resident1, resident2, resident3 })
  console.log('Resident credentials: resident1@gym.local / resident123')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
