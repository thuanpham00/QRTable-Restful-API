import prisma from '@/database'

export async function retrieveMenuContext(analysis: any) {
  const where: any = {}

  if (analysis.spicyLevel !== null) {
    where.spicyLevel = {
      gte: analysis.spicyLevel
    }
  }

  if (analysis.dietaryPreference === 'vegetarian') {
    where.dietaryTags = {
      contains: 'vegetarian'
    }
  }

  if (analysis.dietaryPreference === 'vegan') {
    where.dietaryTags = {
      contains: 'vegan'
    }
  }

  // if (analysis.category) {
  //   where.category = {
  //     name: {
  //       contains: analysis.category
  //     }
  //   }
  // }

  const dishes = await prisma.dish.findMany({
    where: {
      ...where,
      menuItems: {
        some: {
          menu: {
            isActive: true
          }
        }
      }
    },
    include: {
      category: true,
      dishIngredients: {
        include: {
          ingredient: true
        }
      },
      menuItems: { include: { menu: true } }
    },
    orderBy: {
      popularity: 'desc'
    }
  })

  return dishes
}
