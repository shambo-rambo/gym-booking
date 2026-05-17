import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const hash = await bcrypt.hash('Password123', 10)
  const user = await prisma.user.upsert({
    where: { email: 'hello@simonhamblin.com' },
    update: { role: 'MANAGER', status: 'VERIFIED', password: hash },
    create: {
      email: 'hello@simonhamblin.com',
      name: 'Simon Hamblin',
      password: hash,
      apartmentNumber: 0,
      role: 'MANAGER',
      status: 'VERIFIED',
      notificationPreference: 'EMAIL_ONLY',
    },
  })
  console.log('Created:', user.email, user.role)
}

main().catch(console.error).finally(() => prisma.$disconnect())
