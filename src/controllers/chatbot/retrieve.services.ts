import prisma from '@/database'
import { type IntentAnalysis } from './ai.services'
import { type Intent } from './intent.services'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDishText(dish: any): string {
  const ingredients = dish.dishIngredients?.map((di: any) => di.ingredient.name).join(' ') || ''
  return [dish.name, dish.description, dish.searchKeywords || '', ingredients, dish.category?.name || '']
    .join(' ')
    .toLowerCase()
}

function scoreDish(dish: any, keywords: string[]): number {
  const text = buildDishText(dish)
  let score = 0

  for (const word of keywords) {
    if (word.length < 2) continue // bỏ qua từ quá ngắn (dấu câu, "ở", "và"…)
    if (text.includes(word)) score += 2
  }

  // boost nhẹ theo popularity (không lấn át keyword match)
  score += (dish.popularity || 0) * 0.05

  return score
}

function getActivePrice(dish: any): number {
  return dish.menuItems?.find((mi: any) => mi.menu?.isActive)?.price ?? 0
}

function filterByAllergy(dishes: any[], allergyInfo?: string): any[] {
  if (!allergyInfo) return dishes

  const allergies = allergyInfo
    .toLowerCase()
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean)

  return dishes.filter((d) => {
    const allergens =
      d.dishIngredients
        ?.map((di: any) => di.ingredient.allergenType)
        .filter(Boolean)
        .join(',')
        .toLowerCase() || ''

    return !allergies.some((a) => allergens.includes(a))
  })
}

function filterByDietary(dishes: any[], dietaryPreference: string | null): any[] {
  if (!dietaryPreference) return dishes

  return dishes.filter((d) => {
    const pref = d.dietaryType?.toLowerCase() || ''
    return pref.includes(dietaryPreference)
  })
}

function filterBySpicy(dishes: any[], spicyLevel: number | null): any[] {
  if (spicyLevel === null) return dishes
  // lấy các món có spicyLevel khớp ±1
  return dishes.filter((d) => Math.abs((d.spicyLevel || 0) - spicyLevel) <= 1)
}

// ─── Strategy router ──────────────────────────────────────────────────────────

const TOP_N = 30 // số món tối đa đưa vào prompt

export async function retrieveAndRankDishes(
  message: string,
  guest: any,
  intent: Intent,
  analysis: IntentAnalysis
): Promise<any[]> {
  // Chỉ load món đang active, tránh load toàn bộ DB rồi filter in-memory
  const allDishes = await prisma.dish.findMany({
    where: {
      menuItems: {
        some: { menu: { isActive: true } }
      }
    },
    include: {
      category: true,
      dishIngredients: { include: { ingredient: true } },
      menuItems: {
        where: { menu: { isActive: true } },
        include: { menu: true }
      }
    }
  })

  // Luôn filter allergy trước
  let dishes = filterByAllergy(allDishes, guest?.allergyInfo)

  // ── Route theo intent ──────────────────────────────────────────────────────

  // 1. Sort intent: đắt nhất / rẻ nhất / ngon nhất / cay nhất
  if (intent === 'sort_dish' && analysis.sortBy) {
    switch (analysis.sortBy) {
      case 'price_desc':
        return dishes
          .map((d) => ({ ...d, _activePrice: getActivePrice(d) }))
          .sort((a, b) => b._activePrice - a._activePrice)
          .slice(0, TOP_N)

      case 'price_asc':
        return dishes
          .map((d) => ({ ...d, _activePrice: getActivePrice(d) }))
          .filter((d) => d._activePrice > 0) // bỏ món chưa có giá
          .sort((a, b) => a._activePrice - b._activePrice)
          .slice(0, TOP_N)

      case 'popularity':
        return dishes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, TOP_N)

      case 'spicy_desc':
        return dishes.sort((a, b) => (b.spicyLevel || 0) - (a.spicyLevel || 0)).slice(0, TOP_N)
    }
  }

  // 2. Filter intent: chay / vegan / cay
  if (intent === 'filter_dish') {
    if (analysis.filterBy === 'vegetarian' || analysis.dietaryPreference === 'vegetarian') {
      dishes = filterByDietary(dishes, 'vegetarian')
    }
    if (analysis.filterBy === 'vegan' || analysis.dietaryPreference === 'vegan') {
      dishes = filterByDietary(dishes, 'vegan')
    }
    if (analysis.filterBy === 'spicy' && analysis.spicyLevel !== null) {
      dishes = filterBySpicy(dishes, analysis.spicyLevel)
    }

    // sau filter → sort theo popularity để chọn món tốt nhất
    return dishes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, TOP_N)
  }

  // 3. Search / general: keyword scoring
  const keywords = [
    ...message.toLowerCase().split(/\s+/),
    ...(analysis.keywords || []).map((k) => k.toLowerCase())
  ].filter((w) => w.length >= 2)

  // filter theo category nếu AI detect được
  if (analysis.category) {
    const categoryDishes = dishes.filter((d) =>
      d.category?.name?.toLowerCase().includes(analysis.category!.toLowerCase())
    )
    // chỉ thu hẹp nếu còn đủ kết quả
    if (categoryDishes.length >= 3) dishes = categoryDishes
  }

  const scored = dishes.map((d) => ({ ...d, _score: scoreDish(d, keywords) })).sort((a, b) => b._score - a._score)

  // fallback: nếu mọi score = 0 → trả theo popularity
  const hasMatch = scored.some((d) => d._score > 0)
  if (!hasMatch) {
    return dishes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0)).slice(0, TOP_N)
  }

  return scored.slice(0, TOP_N)
}
