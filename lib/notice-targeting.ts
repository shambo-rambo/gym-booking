import { prisma } from './prisma'
import { NoticeTargetType, ResidencyType, User } from '@prisma/client'
import { getFloorFromApartmentNumber } from './apartments'

// Only 65 apartments in the building, so it's simplest and clearest to fetch
// verified residents and filter in JS rather than build per-target SQL.
export async function resolveNoticeRecipients(
  targetType: NoticeTargetType,
  targetValues: string[]
): Promise<User[]> {
  const verifiedUsers = await prisma.user.findMany({
    where: { status: 'VERIFIED' },
  })

  switch (targetType) {
    case 'ALL':
      return verifiedUsers

    case 'RESIDENCY': {
      const residencyTypes = new Set(targetValues as ResidencyType[])
      return verifiedUsers.filter((u) => u.residencyType && residencyTypes.has(u.residencyType))
    }

    case 'FLOOR': {
      const floors = new Set(targetValues.map(Number))
      return verifiedUsers.filter((u) => floors.has(getFloorFromApartmentNumber(u.apartmentNumber).floor))
    }

    case 'APARTMENT': {
      const apartments = new Set(targetValues.map(Number))
      return verifiedUsers.filter((u) => apartments.has(u.apartmentNumber))
    }

    default:
      return []
  }
}
