1. Khách hàng quét QR → Chuyển khoản vào TK ngân hàng của bạn (MB Bank 0123456789)
   ↓
2. Ngân hàng của bạn nhận tiền → Gửi thông báo biến động số dư tới SePay
   ↓
3. SePay nhận thông báo từ bank → Parse thông tin (số tiền, nội dung chuyển khoản)
   ↓
4. SePay gọi webhook tới server của bạn: POST https://yourdomain.com/api/payments/sepay/webhook
   ↓
5. Server của bạn nhận webhook → Xử lý → Cập nhật payment status = "Paid"
   ↓
6. Emit Socket.IO → Frontend nhận realtime → Hiển thị "Thanh toán thành công!"
