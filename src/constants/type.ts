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
  Reserved: 'Reserved'
} as const

export const TableStatusValues = [TableStatus.Available, TableStatus.Hidden, TableStatus.Reserved] as const

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
