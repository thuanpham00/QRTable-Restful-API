export const TokenType = {
  ForgotPasswordToken: 'ForgotPasswordToken',
  AccessToken: 'AccessToken',
  RefreshToken: 'RefreshToken',
  TableToken: 'TableToken'
} as const

export const Role = {
  Owner: 'Owner',
  Employee: 'Employee',
  Guest: 'Guest'
} as const

export const RoleValues = [Role.Owner, Role.Employee, Role.Guest] as const

export const DishStatus = {
  Active: 'Active', // Món đang hoạt động (có thể thêm vào menu)
  Discontinued: 'Discontinued' // Món ngừng phục vụ (không thêm vào menu được nữa)
} as const

export const DishStatusValues = [DishStatus.Active, DishStatus.Discontinued] as const

export const TableStatus = {
  Available: 'Available',
  Hidden: 'Hidden',
  Serving: 'Serving'
} as const

export const TableStatusValues = [TableStatus.Available, TableStatus.Hidden, TableStatus.Serving] as const

export const OrderStatus = {
  Pending: 'Pending',
  Processing: 'Processing',
  Rejected: 'Rejected',
  Delivered: 'Delivered',
  Paid: 'Paid'
} as const

export const OrderStatusValues = [
  OrderStatus.Pending,
  OrderStatus.Processing,
  OrderStatus.Rejected,
  OrderStatus.Delivered,
  OrderStatus.Paid
] as const

export const ManagerRoom = 'manager' as const
export const GuestRoom = 'guest' as const

export const MenuItemStatus = {
  AVAILABLE: 'Available', // Đang bán trong menu
  OUT_OF_STOCK: 'OutOfStock', // Tạm hết hàng
  HIDDEN: 'Hidden' // Ẩn khỏi menu này
} as const

export const MenuItemStatusValues = ['Available', 'OutOfStock', 'Hidden'] as const

export const GuestCallStatus = {
  Pending: 'Pending',
  Completed: 'Completed',
  Rejected: 'Rejected'
} as const

export const GuestCallValues = [GuestCallStatus.Pending, GuestCallStatus.Completed, GuestCallStatus.Rejected] as const

export type GuestCallStatusType = keyof typeof GuestCallStatus

export const OrderModeType = {
  DINE_IN: 'DINE_IN', // ăn tại quán
  TAKE_OUT: 'TAKE_OUT' // mang đi
} as const

export const OrderModeTypeValues = ['DINE_IN', 'TAKE_OUT'] as const

export enum PaymentMethod {
  CASH, // Tiền mặt
  SEPAY // Chuyển khoản sepay
}

// Dietary Preferences cho khách hàng
export const DietaryPreference = {
  VEGETARIAN: 'vegetarian', // Chay (không thịt)
  VEGAN: 'vegan', // Thuần chay (không sản phẩm động vật)
  LOW_CARB: 'low-carb', // Ít tinh bột
  GLUTEN_FREE: 'gluten-free', // Không gluten
  KETO: 'keto', // Chế độ keto
  PESCATARIAN: 'pescatarian' // Ăn hải sản, không thịt
} as const

export const DietaryPreferenceValues = [
  DietaryPreference.VEGETARIAN,
  DietaryPreference.VEGAN,
  DietaryPreference.LOW_CARB,
  DietaryPreference.GLUTEN_FREE,
  DietaryPreference.KETO,
  DietaryPreference.PESCATARIAN
] as const

export const DietaryPreferenceLabels = {
  [DietaryPreference.VEGETARIAN]: 'Chay (ăn trứng, sữa)',
  [DietaryPreference.VEGAN]: 'Thuần chay',
  [DietaryPreference.LOW_CARB]: 'Ít tinh bột',
  [DietaryPreference.GLUTEN_FREE]: 'Không gluten',
  [DietaryPreference.KETO]: 'Keto',
  [DietaryPreference.PESCATARIAN]: 'Hải sản (không thịt)'
} as const

// Allergens - Chất gây dị ứng
export const Allergen = {
  SHELLFISH: 'shellfish', // Hải sản có vỏ
  FISH: 'fish', // Cá
  DAIRY: 'dairy', // Sữa
  EGGS: 'eggs', // Trứng
  PEANUTS: 'peanuts', // Đậu phộng
  TREE_NUTS: 'tree-nuts', // Các loại hạt
  SOY: 'soy', // Đậu nành
  WHEAT: 'wheat', // Lúa mì
  GLUTEN: 'gluten', // Gluten
  SESAME: 'sesame' // Mè
} as const

export const AllergenValues = [
  Allergen.SHELLFISH,
  Allergen.FISH,
  Allergen.DAIRY,
  Allergen.EGGS,
  Allergen.PEANUTS,
  Allergen.TREE_NUTS,
  Allergen.SOY,
  Allergen.WHEAT,
  Allergen.GLUTEN,
  Allergen.SESAME
] as const

export const AllergenLabels = {
  [Allergen.SHELLFISH]: 'Hải sản (tôm, cua, sò)',
  [Allergen.FISH]: 'Cá',
  [Allergen.DAIRY]: 'Sữa',
  [Allergen.EGGS]: 'Trứng',
  [Allergen.PEANUTS]: 'Đậu phộng',
  [Allergen.TREE_NUTS]: 'Hạt (óc chó, hạnh nhân)',
  [Allergen.SOY]: 'Đậu nành',
  [Allergen.WHEAT]: 'Lúa mì',
  [Allergen.GLUTEN]: 'Gluten',
  [Allergen.SESAME]: 'Mè'
} as const
