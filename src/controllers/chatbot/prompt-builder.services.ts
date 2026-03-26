export function buildPrompt(message: string, guest: any, dishes: any[]) {
  const menuContext = dishes
    .map((d, i) => {
      const ingredients = d.dishIngredients?.map((di: any) => di.ingredient.name).join(', ') || 'unknown'
      const menuItemActivePrice = d.menuItems[0].price
      const allergens =
        d.dishIngredients
          ?.map((di: any) => di.ingredient.allergenType)
          .filter(Boolean)
          .join(', ') || 'none'

      return `
${i + 1}. ${d.name}
price: ${menuItemActivePrice}
category: ${d.category?.name}
spicyLevel: ${d.spicyLevel}
popular: ${d.popularity}
ingredients: ${ingredients}
allergens: ${allergens}
description: ${d.description}
`
    })
    .join('\n')

  return `
Bạn là AI tư vấn món ăn cho nhà hàng.

Thông tin khách:
name: ${guest?.name || 'guest'}
dietary: ${guest?.dietaryPreferences || 'none'}
allergy: ${guest?.allergyInfo || 'none'}

Menu:

${menuContext}

Khách hỏi:
"${message}"

Quy tắc:
- Chỉ gợi ý món trong menu
- Nếu khách dị ứng nguyên liệu thì KHÔNG gợi ý món đó
- Trả lời ngắn gọn, thân thiện
- Trả lời bằng tiếng Việt, không sử dụng tiếng Anh
`
}
