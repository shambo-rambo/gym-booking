import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('password123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'max@thewatertower.com.au' },
    update: { password: hash, status: 'VERIFIED' },
    create: {
      email: 'max@thewatertower.com.au',
      name: 'Max',
      password: hash,
      apartmentNumber: 101,
      role: 'RESIDENT',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })
  console.log('Created:', user.email, user.role, user.status)
}

main().catch(console.error).finally(() => prisma.$disconnect())
