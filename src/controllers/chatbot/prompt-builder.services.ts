function formatPrice(price: number) {
  return price.toLocaleString('vi-VN')
}

export function buildPrompt(message: string, guest: any, dishes: any[]) {
  const menuContext = dishes
    .map((d, i) => {
      const ingredients = d.dishIngredients?.map((di: any) => di.ingredient.name).join(', ') || 'unknown'
      const menuItemActivePrice = d.menuItems.filter((mi: any) => mi.menu.isActive)[0]?.price
      const allergens =
        d.dishIngredients
          ?.map((di: any) => di.ingredient.allergenType)
          .filter(Boolean)
          .join(', ') || 'none'

      return `
${i + 1}. ${d.name}
price: ${formatPrice(menuItemActivePrice)}
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

DANH SÁCH MÓN ĂN (CHỈ ĐƯỢC CHỌN TRONG ĐÂY):

${menuContext}

Câu hỏi khách:
"${message}"

QUY TẮC BẮT BUỘC:
- CHỈ được chọn món trong danh sách trên
- KHÔNG được tự tạo món mới
- Nếu không có món phù hợp → nói: "Hiện tại chưa có món phù hợp"
- Ưu tiên món phù hợp với yêu cầu khách
- Trả lời ngắn gọn, tự nhiên và dùng tiếng Việt không sử dụng tiếng Anh

Trả lời:
`
}
