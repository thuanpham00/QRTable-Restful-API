const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  try {
    const res = await prisma.guestCall.deleteMany()
    console.log('deleted:', res.count)
  } catch (e) {
    console.error('Error:', e.message || e)
    if (e.code) console.error('Prisma code:', e.code)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
