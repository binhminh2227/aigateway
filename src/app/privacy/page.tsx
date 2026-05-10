export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Chính sách bảo mật</h1>
        <p className="text-gray-500 text-sm mb-10">Cập nhật lần cuối: 08/05/2026</p>

        <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Thông tin chúng tôi thu thập</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Thông tin tài khoản:</b> Email, tên hiển thị, mật khẩu (đã mã hóa bcrypt).</li>
              <li><b>Dữ liệu sử dụng:</b> Model được gọi, số token, chi phí, thời gian — dùng để tính phí và hiển thị lịch sử.</li>
              <li><b>Dữ liệu thanh toán:</b> Số tiền giao dịch, phương thức, trạng thái — không lưu thông tin thẻ/tài khoản ngân hàng.</li>
              <li><b>Dữ liệu kỹ thuật:</b> IP address (cho rate limiting và bảo mật API key), thời gian request.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Cách chúng tôi sử dụng thông tin</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Xác thực danh tính và bảo mật tài khoản.</li>
              <li>Tính phí sử dụng API và quản lý số dư.</li>
              <li>Gửi thông báo về giao dịch và dịch vụ (nếu bạn đã đồng ý nhận email).</li>
              <li>Phát hiện và ngăn chặn gian lận, lạm dụng dịch vụ.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Chia sẻ thông tin</h2>
            <p>Chúng tôi <b>không bán</b> thông tin cá nhân của bạn. Chúng tôi chỉ chia sẻ thông tin trong các trường hợp:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Tuân thủ yêu cầu pháp lý từ cơ quan có thẩm quyền.</li>
              <li>Nhà cung cấp dịch vụ bên thứ ba cần thiết để vận hành (hosting, email) — bị ràng buộc bởi NDA.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Bảo mật dữ liệu</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Mật khẩu được hash bằng bcrypt (cost factor 12).</li>
              <li>API key được lưu trữ và chỉ trả về một lần khi tạo.</li>
              <li>Kết nối HTTPS bắt buộc trên môi trường production.</li>
              <li>Rate limiting và IP filtering để chống brute-force.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Quyền của bạn</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><b>Truy cập:</b> Bạn có thể xem dữ liệu tài khoản trong dashboard.</li>
              <li><b>Xóa tài khoản:</b> Liên hệ support để yêu cầu xóa toàn bộ dữ liệu.</li>
              <li><b>Chỉnh sửa:</b> Cập nhật thông tin cá nhân trong phần Profile.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Cookie</h2>
            <p>Chúng tôi chỉ dùng cookie session cần thiết cho đăng nhập (NextAuth session token). Không dùng cookie theo dõi hoặc quảng cáo.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Liên hệ</h2>
            <p>Mọi yêu cầu về quyền riêng tư, vui lòng liên hệ email hỗ trợ trên trang chủ.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6 text-xs text-gray-600">
          <a href="/" className="hover:text-gray-400">Trang chủ</a>
          <a href="/terms" className="hover:text-gray-400">Điều khoản dịch vụ</a>
        </div>
      </div>
    </div>
  );
}
