import { GuestCallStatus, GuestCallStatusType, GuestCallValues } from '@/constants/type'
import prisma from '@/database'

export const getGuestCallsController = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const guestCallList = await prisma.guestCall.findMany({
    include: {
      guest: true,
      account: true
    },
    orderBy: {
      createdAt: 'desc'
    },
    where: {
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return guestCallList
}

export const getCountGuestCallPendingController = async ({ fromDate, toDate }: { fromDate?: Date; toDate?: Date }) => {
  const guestCallList = await prisma.guestCall.count({
    where: {
      status: GuestCallStatus.Pending,
      createdAt: {
        gte: fromDate,
        lte: toDate
      }
    }
  })
  return guestCallList
}

export const updateGuestCall = async ({
  idGuestCall,
  status,
  accountRecipient
}: {
  idGuestCall: number
  status: GuestCallStatusType
  accountRecipient: number
}) => {
  const checkGuestCallStatus = await prisma.guestCall.findUniqueOrThrow({
    where: {
      id: Number(idGuestCall)
    }
  })
  if (checkGuestCallStatus.status !== GuestCallStatus.Pending) {
    throw new Error('Lời phục vụ này đã được xử lý!')
  }
  const updatedGuestCall = await prisma.guestCall.update({
    where: {
      id: Number(idGuestCall)
    },
    data: {
      status,
      accountId: accountRecipient
    },
    include: {
      guest: true,
      account: true
    }
  })
  return updatedGuestCall
}
