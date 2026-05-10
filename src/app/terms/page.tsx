export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-950 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-2">Điều khoản dịch vụ</h1>
        <p className="text-gray-500 text-sm mb-10">Cập nhật lần cuối: 08/05/2026</p>

        <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
          <section>
            <h2 className="text-lg font-semibold text-white mb-3">1. Chấp nhận điều khoản</h2>
            <p>Khi sử dụng dịch vụ AI Gateway, bạn đồng ý bị ràng buộc bởi các điều khoản này. Nếu không đồng ý, vui lòng ngừng sử dụng dịch vụ.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">2. Mô tả dịch vụ</h2>
            <p>AI Gateway cung cấp dịch vụ proxy API trí tuệ nhân tạo, cho phép người dùng truy cập các mô hình AI thông qua một API key thống nhất. Dịch vụ hoạt động theo mô hình prepaid — người dùng nạp credit trước và thanh toán theo lượng sử dụng thực tế.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">3. Tài khoản người dùng</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Bạn phải cung cấp thông tin chính xác khi đăng ký.</li>
              <li>Bạn có trách nhiệm bảo mật thông tin đăng nhập và API key.</li>
              <li>Mỗi người chỉ được tạo một tài khoản. Tài khoản không được chuyển nhượng.</li>
              <li>Chúng tôi có quyền đình chỉ tài khoản vi phạm điều khoản.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">4. Thanh toán và hoàn tiền</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Tất cả giao dịch nạp tiền và mua gói đều không hoàn lại trừ khi có lỗi kỹ thuật từ phía chúng tôi.</li>
              <li>Credit không có thời hạn sử dụng. Gói dịch vụ có thời hạn theo thỏa thuận.</li>
              <li>Giá cả có thể thay đổi. Thay đổi sẽ được thông báo trước 7 ngày.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">5. Sử dụng hợp lệ</h2>
            <p>Nghiêm cấm sử dụng dịch vụ để:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Tạo nội dung vi phạm pháp luật Việt Nam hoặc quốc tế.</li>
              <li>Gian lận, tấn công hệ thống hoặc phá hoại dịch vụ.</li>
              <li>Bán lại hoặc chia sẻ API key cho bên thứ ba mà không có sự cho phép.</li>
              <li>Spam, phishing hoặc các hoạt động lừa đảo.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">6. Giới hạn trách nhiệm</h2>
            <p>Dịch vụ được cung cấp "nguyên trạng" (as-is). Chúng tôi không đảm bảo tính liên tục 100% và không chịu trách nhiệm về thiệt hại gián tiếp phát sinh từ việc sử dụng dịch vụ.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-white mb-3">7. Liên hệ</h2>
            <p>Mọi thắc mắc về điều khoản, vui lòng liên hệ qua email hỗ trợ được ghi trên trang chủ.</p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-800 flex gap-6 text-xs text-gray-600">
          <a href="/" className="hover:text-gray-400">Trang chủ</a>
          <a href="/privacy" className="hover:text-gray-400">Chính sách bảo mật</a>
        </div>
      </div>
    </div>
  );
}
