# QRTable Restful API

Backend API cho hệ thống quản lý quán ăn theo mô hình QR Table.

Hệ thống hỗ trợ:

- Quản lý bàn, phiên bàn, khách, nhân viên
- Gọi món theo bàn, xử lý đơn, thanh toán tiền mặt/chuyển khoản
- Quản lý menu, món ăn, nguyên liệu, nhập kho, xuất kho, tồn kho
- Realtime với Socket.IO cho màn hình quản lý và khách
- Chatbot tư vấn món ăn theo ngữ cảnh khách

## Tổng quan công nghệ

- Runtime: Node.js
- Framework: Fastify
- Language: TypeScript
- ORM: Prisma
- Database: SQLite
- Validation: Zod + fastify-type-provider-zod
- Authentication: JWT (Access Token, Refresh Token)
- Realtime: Socket.IO (fastify-socket.io)
- Upload: @fastify/multipart + @fastify/static
- Scheduler/Cron: Croner
- Payment webhook: SePay
- AI chatbot: Ollama local endpoint (mặc định `http://127.0.0.1:11434`)

## Cấu trúc thư mục chính

```text
.
|- prisma/
|  |- schema.prisma
|- src/
|  |- controllers/
|  |- routes/
|  |- schemaValidations/
|  |- hooks/
|  |- jobs/
|  |- plugins/
|  |- utils/
|  |- index.ts
|  |- config.ts
|- uploads/
|- scripts/
|- package.json
```

## Các module API đang sử dụng

Tất cả route được mount trong [src/index.ts](src/index.ts#L1):

- `/auth`
- `/accounts`
- `/media`
- `/static`
- `/dishes`
- `/ingredients`
- `/dish-categories`
- `/menus`
- `/tables`
- `/table-sessions`
- `/orders`
- `/indicators`
- `/guest`
- `/guest-calls`
- `/payments`
- `/sepay`
- `/chatbot`
- `/suppliers`
- `/supplies`
- `/inventory-stocks`
- `/inventory-batches`
- `/export-receipts`
- `/import-receipts`

## Danh sách endpoint theo nhóm

### 1. Auth (`/auth`)

- `POST /auth/login` - Đăng nhập account Owner/Employee
- `POST /auth/logout` - Đăng xuất
- `POST /auth/refresh-token` - Cấp token mới
- `GET /auth/login/google` - Đăng nhập Google OAuth

### 2. Account (`/accounts`)

- `GET /accounts` - Danh sách nhân viên (Owner)
- `GET /accounts/detail/:id` - Chi tiết nhân viên (Owner)
- `POST /accounts` - Tạo nhân viên (Owner)
- `PUT /accounts/detail/:id` - Cập nhật nhân viên (Owner)
- `DELETE /accounts/detail/:id` - Xóa nhân viên (Owner)
- `GET /accounts/me` - Lấy profile đang đăng nhập
- `PUT /accounts/me` - Cập nhật profile
- `PUT /accounts/change-password` - Đổi mật khẩu
- `PUT /accounts/change-password-v2` - Đổi mật khẩu + cấp lại token
- `POST /accounts/guests` - Tạo guest bởi nhân viên/chủ quán
- `GET /accounts/guests` - Danh sách guest theo khoảng thời gian

### 3. Dish Category (`/dish-categories`)

- `GET /dish-categories`
- `GET /dish-categories/:id`
- `POST /dish-categories`
- `PUT /dish-categories/:id`
- `DELETE /dish-categories/:id`
- `GET /dish-categories/names`

### 4. Dish (`/dishes`)

- `GET /dishes`
- `GET /dishes/:id`
- `POST /dishes`
- `PUT /dishes/:id`
- `DELETE /dishes/:id`
- `GET /dishes/:id/ingredients`
- `GET /dishes/ingredient-item/:id`
- `POST /dishes/ingredient-item`
- `PUT /dishes/ingredient-item/:id`
- `DELETE /dishes/ingredient-item/:id`

### 5. Ingredient (`/ingredients`)

- `GET /ingredients`
- `GET /ingredients/:id`
- `POST /ingredients`
- `PUT /ingredients/:id`
- `DELETE /ingredients/:id`

### 6. Menu (`/menus`)

- `GET /menus`
- `GET /menus/active`
- `GET /menus/suggested`
- `GET /menus/:id`
- `POST /menus`
- `PUT /menus/:id`
- `DELETE /menus/:id`
- `GET /menus/:id/items`
- `GET /menus/menu-item/:id`
- `POST /menus/menu-item`
- `PUT /menus/menu-item/:id`
- `DELETE /menus/menu-item/:id`

### 7. Table (`/tables`)

- `GET /tables`
- `GET /tables/:number`
- `POST /tables`
- `PUT /tables/:number`
- `DELETE /tables/:number`
- `GET /tables/:id/sessions` - Lịch sử phiên của bàn
- `POST /tables/clean` - Dọn bàn (nếu đã tất cả order đã xử lý)

### 8. Table Session (`/table-sessions`)

- `GET /table-sessions/:id` - Chi tiết 1 phiên
- `GET /table-sessions/active-list` - Danh sách phiên đang active
- `GET /table-sessions/:id/active` - Phiên active theo số bàn

### 9. Guest (`/guest`)

- `POST /guest/auth/login` - Khách đăng nhập vào bàn bằng token QR
- `POST /guest/auth/logout`
- `POST /guest/auth/refresh-token`
- `POST /guest/orders` - Khách tạo order
- `GET /guest/orders` - Danh sách order của khách
- `GET /guest/payments` - Danh sách payment của khách

### 10. Orders (`/orders`)

- `POST /orders`
- `GET /orders`
- `GET /orders/:orderId`
- `PUT /orders/:orderId`
- `GET /orders/count-order-today`

### 11. Guest Calls (`/guest-calls`)

- `GET /guest-calls`
- `PUT /guest-calls/:id` - Nhân viên xử lý yêu cầu gọi phục vụ
- `GET /guest-calls/count-pending-today`

### 12. Indicators (`/indicators`)

- `GET /indicators/dashboard`

### 13. Payments (`/payments`)

- `POST /payments` - Tạo payment theo guest/order
- `POST /payments/table` - Tạo payment cho cả bàn
- `GET /payments`
- `GET /payments/:id`

### 14. SePay Webhook (`/sepay`)

- `POST /sepay/webhook` - Public webhook endpoint

### 15. Suppliers + Supplies

Supplier (`/suppliers`):

- `GET /suppliers`
- `GET /suppliers/options`
- `GET /suppliers/:id`
- `POST /suppliers`
- `PUT /suppliers/:id`
- `DELETE /suppliers/:id`

Supply (`/supplies`):

- `GET /supplies/list/:supplierId`
- `GET /supplies/not-linked/:supplierId`
- `GET /supplies/:id`
- `POST /supplies`
- `PUT /supplies/:id`
- `DELETE /supplies/:id`

### 16. Inventory

Inventory Stocks (`/inventory-stocks`):

- `GET /inventory-stocks`
- `GET /inventory-stocks/all`
- `GET /inventory-stocks/:id`
- `PUT /inventory-stocks/:id`

Inventory Batches (`/inventory-batches`):

- `GET /inventory-batches/:id`

Import Receipts (`/import-receipts`):

- `GET /import-receipts`
- `GET /import-receipts/:id`
- `POST /import-receipts`
- `PUT /import-receipts/:id`

Export Receipts (`/export-receipts`):

- `GET /export-receipts`
- `GET /export-receipts/:id`

### 17. Media + Static

- `POST /media/upload` - Upload 1 file
- `GET /static/:id` - Lấy file từ thư mục upload

### 18. Chatbot (`/chatbot`)

- `POST /chatbot/chat` - Guest chat với AI
- `GET /chatbot/messages` - Lịch sử chat của guest hiện tại
- `GET /chatbot/list-message` - Danh sách lịch sử chat all guest (Owner/Employee)

## Authentication và phân quyền

JWT có 2 loại:

- Access token
- Refresh token

Role đang sử dụng trong hệ thống:

- Owner
- Employee
- Guest

Các hook auth chính nằm trong [src/hooks/auth.hooks.ts](src/hooks/auth.hooks.ts#L1):

- `requireLoginedHook`
- `requireOwnerHook`
- `requireEmployeeHook`
- `requireGuestHook`

Header cho endpoint bảo vệ:

```http
Authorization: Bearer <accessToken>
```

## Realtime Socket.IO

Server sử dụng `fastify-socket.io` và plugin custom trong [src/plugins/socket.plugins.ts](src/plugins/socket.plugins.ts#L1).

Sự kiện realtime tiêu biểu:

- `new-order`
- `update-order`
- `count-order`
- `count-call-waiter`
- `update-status-table`
- `payment`
- `table-token-rotated`
- `table-cleaned`

## Cron jobs

Dự án đang chạy các tác vụ nền:

- Xóa refresh token hết hạn theo giờ
- Rotate token bàn mỗi 10 phút
- Cập nhật trạng thái lô hàng mỗi ngày lúc 00:00

Tham khảo trong thư mục [src/jobs](src/jobs).

## Biến môi trường (.env)

Dự án validate biến môi trường tại [src/config.ts](src/config.ts#L1).

Danh sách biến quan trọng:

- `PORT`
- `DATABASE_URL`
- `ACCESS_TOKEN_SECRET`
- `ACCESS_TOKEN_EXPIRES_IN`
- `GUEST_ACCESS_TOKEN_EXPIRES_IN`
- `GUEST_REFRESH_TOKEN_EXPIRES_IN`
- `REFRESH_TOKEN_SECRET`
- `REFRESH_TOKEN_EXPIRES_IN`
- `INITIAL_EMAIL_OWNER`
- `INITIAL_PASSWORD_OWNER`
- `DOMAIN`
- `PROTOCOL`
- `UPLOAD_FOLDER`
- `CLIENT_URL`
- `GOOGLE_REDIRECT_CLIENT_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_AUTHORIZED_REDIRECT_URI`
- `PRODUCTION`
- `DOCKER`
- `PRODUCTION_URL`
- `SERVER_TIMEZONE`
- `PAUSE_SOME_ENDPOINTS`
- `SEPAY_WEBHOOK_SECRET`
- `SEPAY_BANK_CODE`
- `SEPAY_ACCOUNT_NUMBER`
- `SEPAY_ACCOUNT_NAME`
- `SEPAY_PAYMENT_PREFIX`
- `GROQ_API_KEY`

Ví dụ `.env` tối thiểu:

```env
PORT=4000
DATABASE_URL="file:./dev.db"

ACCESS_TOKEN_SECRET="your_access_secret"
ACCESS_TOKEN_EXPIRES_IN="15m"
REFRESH_TOKEN_SECRET="your_refresh_secret"
REFRESH_TOKEN_EXPIRES_IN="30d"

GUEST_ACCESS_TOKEN_EXPIRES_IN="15m"
GUEST_REFRESH_TOKEN_EXPIRES_IN="7d"

INITIAL_EMAIL_OWNER="owner@example.com"
INITIAL_PASSWORD_OWNER="123456"

DOMAIN="localhost"
PROTOCOL="http"
UPLOAD_FOLDER="uploads"
CLIENT_URL="http://localhost:3000"

GOOGLE_REDIRECT_CLIENT_URL="http://localhost:3000/auth/google"
GOOGLE_CLIENT_ID=""
GOOGLE_CLIENT_SECRET=""
GOOGLE_AUTHORIZED_REDIRECT_URI=""

PRODUCTION="false"
DOCKER="false"
PRODUCTION_URL=""
SERVER_TIMEZONE="Asia/Ho_Chi_Minh"
PAUSE_SOME_ENDPOINTS="false"

SEPAY_ACCOUNT_NUMBER=""
SEPAY_WEBHOOK_SECRET=""
SEPAY_BANK_CODE="MBBank"
SEPAY_ACCOUNT_NAME="KITCHEN SMART"
SEPAY_PAYMENT_PREFIX="KS"

GROQ_API_KEY=""
```

## Cài đặt và chạy dự án

### 1. Cài dependencies

```bash
npm install
```

### 2. Prisma migration/generate

```bash
npx prisma migrate dev
npx prisma generate
```

### 3. Chạy development

```bash
npm run dev
```

### 4. Build production

```bash
npm run build
npm run start
```

### 5. Xem database bằng Prisma Studio

```bash
npx prisma studio
```

## Scripts

Scripts trong [package.json](package.json#L1):

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run lint:fix`
- `npm run prettier`
- `npm run prettier:fix`

## Định dạng response

Server trả về JSON và thường có các trường:

- `message`
- `data`
- `pagination` (với API list)
- `errors` (khi validation fail)

Ví dụ thành công:

```json
{
  "message": "Lấy danh sách món ăn thành công!",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 0,
    "totalPages": 0
  }
}
```

Ví dụ lỗi validation:

```json
{
  "message": "A validation error occurred when validating the body...",
  "errors": [
    {
      "field": "price",
      "message": "Required"
    }
  ],
  "statusCode": 422
}
```

## Postman

Bạn có thể import file collection tại [Quản lý quán ăn.postman_collection.json](Quản lý quán ăn.postman_collection.json).

## Lưu ý

- Khi chạy lần đầu, hệ thống tự tạo Owner account nếu database chưa có tài khoản (xem [src/controllers/account.controller.ts](src/controllers/account.controller.ts#L1)).
- Thư mục upload được tạo tự động khi server start.
- Webhook SePay là endpoint public, cần cấu hình secret và verify đúng quy trình khi deploy thực tế.
- Chatbot hiện tại gọi đến Ollama local endpoint, cần đảm bảo dịch vụ Ollama đang chạy.
