import prisma from '@/database'

function buildDishText(dish: any) {
  const ingredients = dish.dishIngredients?.map((di: any) => di.ingredient.name).join(', ') || ''

  return `
    ${dish.name}
    ${dish.description}
    ${dish.searchKeywords || ''}
    ${ingredients}
    ${dish.category?.name || ''}
  `.toLowerCase()
}

function scoreDish(dish: any, userMessage: string) {
  const text = buildDishText(dish)
  const keywords = userMessage.toLowerCase().split(/\s+/)

  let score = 0

  for (const word of keywords) {
    if (text.includes(word)) score += 2
  }

  // boost theo popularity
  score += (dish.popularity || 0) * 0.05

  return score
}

function filterByAllergy(dishes: any[], allergyInfo?: string) {
  if (!allergyInfo) return dishes

  const allergies = allergyInfo.toLowerCase().split(',')

  return dishes.filter((d) => {
    const allergens =
      d.dishIngredients
        ?.map((di: any) => di.ingredient.allergenType)
        .filter(Boolean)
        .join(',')
        .toLowerCase() || ''

    return !allergies.some((a) => allergens.includes(a.trim()))
  })
}

export async function retrieveAndRankDishes(message: string, guest: any) {
  const allDishes = await prisma.dish.findMany({
    include: {
      category: true,
      dishIngredients: { include: { ingredient: true } },
      menuItems: { include: { menu: true } }
    }
  })

  // chỉ lấy món đang active
  let dishes = allDishes.filter((d) => d.menuItems?.some((mi: any) => mi.menu?.isActive))

  // filter allergy trước
  dishes = filterByAllergy(dishes, guest?.allergyInfo)

  // scoring
  const scored = dishes.map((d) => ({
    ...d,
    score: scoreDish(d, message)
  }))

  // sort + lấy top
  let topDishes: any = scored.sort((a, b) => b.score - a.score).slice(0, 100)

  // fallback nếu không match
  if (topDishes.length === 0) {
    topDishes = dishes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, 100)
  }

  return topDishes
}
