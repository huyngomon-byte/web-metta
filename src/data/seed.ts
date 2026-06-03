import type { CapiEventLog, CapiMapping, CapiSettings } from '@/types/capi';
import type { ClassItem, ClassSession, ClassStudent, Course, Student } from '@/types/academic';
import type { CmsPage, MediaItem, PageSection, ProgramCms, SiteSettings } from '@/types/cms';
import type { Appointment, Lead, LeadActivity } from '@/types/crm';
import type { AdminUser } from '@/types/user';
import { DEAL_QUOTED_STATUS, DEFAULT_COURSE_DEAL_SIZE, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, discountPercentOptions, pendingReasonOptions } from '@/lib/constants';
import { expectedRevenueFrom } from '@/lib/leadFinance';

const now = '2026-05-26T09:00:00+07:00';

const DEFAULT_PRIVACY_POLICY = `<h2>CHÍNH SÁCH BẢO MẬT</h2>
<p><em>Cập nhật lần cuối: 03/06/2026</em></p>
<p>METTA Academy tôn trọng quyền riêng tư và cam kết bảo vệ thông tin cá nhân của phụ huynh, học viên và người dùng khi truy cập website <a href="https://metta-academy.gg99.vn/">https://metta-academy.gg99.vn/</a>.</p>
<p>Chính sách này giải thích cách METTA Academy thu thập, sử dụng, lưu trữ, bảo vệ và xử lý thông tin cá nhân khi người dùng truy cập website, điền form đăng ký tư vấn, liên hệ hoặc sử dụng các dịch vụ liên quan.</p>

<h3>1. Đơn vị quản lý thông tin</h3>
<p>Website này được vận hành bởi:</p>
<ul>
<li>[Tên công ty/Trung tâm]</li>
<li>Mã số thuế: [MST]</li>
<li>Địa chỉ: [Địa chỉ công ty/trung tâm]</li>
<li>Email liên hệ: [Email]</li>
<li>Hotline: [Số điện thoại]</li>
</ul>
<p>Trong chính sách này, "METTA Academy", "chúng tôi" hoặc "bên vận hành" được hiểu là đơn vị quản lý và vận hành website nêu trên.</p>

<h3>2. Thông tin chúng tôi có thể thu thập</h3>
<p>Khi người dùng truy cập hoặc điền thông tin trên website, chúng tôi có thể thu thập các nhóm thông tin sau:</p>
<p><strong>Thông tin do người dùng cung cấp trực tiếp, bao gồm:</strong></p>
<ul>
<li>Họ và tên phụ huynh hoặc người đăng ký;</li>
<li>Số điện thoại;</li>
<li>Email;</li>
<li>Tên học viên;</li>
<li>Độ tuổi/lớp học của học viên;</li>
<li>Nhu cầu học tập, chương trình quan tâm;</li>
<li>Nội dung cần tư vấn hoặc các thông tin khác do người dùng tự nguyện cung cấp.</li>
</ul>
<p><strong>Thông tin kỹ thuật khi truy cập website, bao gồm:</strong></p>
<ul>
<li>Địa chỉ IP;</li>
<li>Loại thiết bị, trình duyệt, hệ điều hành;</li>
<li>Thời gian truy cập;</li>
<li>Trang đã xem, hành vi tương tác trên website;</li>
<li>Cookies, pixel hoặc công nghệ theo dõi tương tự.</li>
</ul>

<h3>3. Mục đích sử dụng thông tin</h3>
<p>Thông tin cá nhân được thu thập nhằm các mục đích sau:</p>
<ul>
<li>Liên hệ tư vấn chương trình học phù hợp;</li>
<li>Xác nhận nhu cầu học tập của phụ huynh/học viên;</li>
<li>Gửi thông tin về khóa học, lịch học, ưu đãi hoặc sự kiện của METTA Academy;</li>
<li>Chăm sóc khách hàng và hỗ trợ người dùng;</li>
<li>Quản lý dữ liệu đăng ký, phân công tư vấn viên, theo dõi trạng thái liên hệ;</li>
<li>Cải thiện nội dung, giao diện và trải nghiệm người dùng trên website;</li>
<li>Đo lường hiệu quả quảng cáo, truyền thông và tối ưu chiến dịch marketing;</li>
<li>Đáp ứng yêu cầu của cơ quan nhà nước có thẩm quyền khi pháp luật yêu cầu.</li>
</ul>
<p>Chúng tôi không bán, trao đổi hoặc chuyển nhượng thông tin cá nhân của người dùng cho bên thứ ba vì mục đích thương mại độc lập nếu không có sự đồng ý của người dùng, trừ trường hợp pháp luật có quy định khác.</p>

<h3>4. Thông tin của trẻ em/học viên</h3>
<p>Do METTA Academy hoạt động trong lĩnh vực giáo dục, website có thể thu thập một số thông tin liên quan đến học viên là trẻ em như tên, độ tuổi, lớp học, nhu cầu học tập.</p>
<p>Việc cung cấp thông tin học viên trên website được hiểu là do phụ huynh, người giám hộ hoặc người có quyền hợp pháp thực hiện để phục vụ mục đích tư vấn, đăng ký học hoặc chăm sóc học viên.</p>
<p>METTA Academy chỉ sử dụng thông tin của học viên trong phạm vi cần thiết cho hoạt động tư vấn, đào tạo, chăm sóc và quản lý học tập. Chúng tôi không cố ý thu thập thông tin cá nhân của trẻ em nếu không có sự đồng ý hoặc xác nhận từ phụ huynh/người giám hộ.</p>

<h3>5. Cookies, pixel và công cụ phân tích</h3>
<p>Website có thể sử dụng cookies, pixel, thẻ theo dõi hoặc công cụ phân tích từ bên thứ ba như Google, Meta/Facebook hoặc các nền tảng quảng cáo khác để:</p>
<ul>
<li>Ghi nhớ lựa chọn của người dùng;</li>
<li>Phân tích lượng truy cập;</li>
<li>Đo lường hiệu quả quảng cáo;</li>
<li>Hiển thị nội dung hoặc quảng cáo phù hợp hơn;</li>
<li>Cải thiện trải nghiệm người dùng trên website.</li>
</ul>
<p>Người dùng có thể chủ động tắt cookies trong phần cài đặt trình duyệt. Tuy nhiên, việc tắt cookies có thể ảnh hưởng đến một số chức năng hoặc trải nghiệm trên website.</p>

<h3>6. Chia sẻ thông tin với bên thứ ba</h3>
<p>METTA Academy có thể chia sẻ thông tin cá nhân trong phạm vi cần thiết với các bên sau:</p>
<ul>
<li>Nhân sự nội bộ phụ trách tư vấn, chăm sóc khách hàng, đào tạo hoặc quản lý lớp học;</li>
<li>Đơn vị cung cấp hạ tầng website, lưu trữ dữ liệu, CRM, email, SMS, tổng đài hoặc công cụ quản lý khách hàng;</li>
<li>Đối tác quảng cáo, phân tích dữ liệu hoặc đo lường hiệu quả truyền thông;</li>
<li>Đơn vị thanh toán, kế toán hoặc pháp lý nếu phát sinh giao dịch;</li>
<li>Cơ quan nhà nước có thẩm quyền theo quy định pháp luật.</li>
</ul>
<p>Các bên thứ ba khi tiếp cận dữ liệu phải sử dụng thông tin đúng mục đích được chỉ định và có trách nhiệm bảo mật thông tin theo thỏa thuận hoặc quy định pháp luật liên quan.</p>

<h3>7. Thời gian lưu trữ thông tin</h3>
<p>Thông tin cá nhân sẽ được lưu trữ trong thời gian cần thiết để phục vụ mục đích đã nêu tại Chính sách này, bao gồm tư vấn, chăm sóc khách hàng, quản lý học viên, thực hiện nghĩa vụ pháp lý, giải quyết tranh chấp hoặc khi người dùng yêu cầu xóa dữ liệu hợp lệ.</p>
<p>Khi thông tin không còn cần thiết hoặc khi người dùng yêu cầu xóa theo quy định, METTA Academy sẽ tiến hành xóa, ẩn danh hoặc hạn chế xử lý dữ liệu, trừ trường hợp pháp luật yêu cầu phải tiếp tục lưu trữ.</p>

<h3>8. Bảo mật thông tin</h3>
<p>METTA Academy áp dụng các biện pháp phù hợp nhằm bảo vệ thông tin cá nhân khỏi truy cập trái phép, mất mát, rò rỉ, thay đổi hoặc sử dụng sai mục đích.</p>
<p>Các biện pháp có thể bao gồm:</p>
<ul>
<li>Giới hạn quyền truy cập dữ liệu theo vai trò;</li>
<li>Sử dụng tài khoản quản trị có phân quyền;</li>
<li>Lưu trữ dữ liệu trên hệ thống có kiểm soát;</li>
<li>Theo dõi, rà soát và xử lý sự cố bảo mật khi phát sinh;</li>
<li>Yêu cầu nhân sự, đối tác liên quan tuân thủ nghĩa vụ bảo mật.</li>
</ul>
<p>Tuy nhiên, không có phương thức truyền tải hoặc lưu trữ dữ liệu qua Internet nào an toàn tuyệt đối. Người dùng cần tự bảo vệ thông tin tài khoản, thiết bị và không chia sẻ thông tin nhạy cảm cho các nguồn không đáng tin cậy.</p>

<h3>9. Quyền của người dùng đối với dữ liệu cá nhân</h3>
<p>Người dùng có quyền:</p>
<ul>
<li>Yêu cầu được biết về việc xử lý dữ liệu cá nhân của mình;</li>
<li>Yêu cầu truy cập, chỉnh sửa hoặc cập nhật thông tin cá nhân;</li>
<li>Rút lại sự đồng ý cho một hoặc nhiều mục đích xử lý dữ liệu;</li>
<li>Yêu cầu xóa hoặc hạn chế xử lý dữ liệu trong phạm vi pháp luật cho phép;</li>
<li>Phản ánh, khiếu nại nếu cho rằng thông tin cá nhân bị sử dụng sai mục đích.</li>
</ul>
<p>Để thực hiện các quyền trên, người dùng có thể liên hệ METTA Academy qua:</p>
<ul>
<li>Email: [Email liên hệ]</li>
<li>Hotline: [Số điện thoại]</li>
</ul>
<p>Chúng tôi sẽ tiếp nhận và xử lý yêu cầu trong thời gian hợp lý theo quy định pháp luật và quy trình nội bộ.</p>

<h3>10. Liên kết đến website bên thứ ba</h3>
<p>Website có thể chứa liên kết đến Facebook, Zalo, YouTube, TikTok, Google Maps hoặc các website/dịch vụ của bên thứ ba.</p>
<p>METTA Academy không chịu trách nhiệm đối với nội dung, chính sách bảo mật hoặc cách thức xử lý dữ liệu của các website/dịch vụ bên thứ ba. Người dùng nên đọc kỹ chính sách riêng tư của các nền tảng đó trước khi cung cấp thông tin.</p>

<h3>11. Thay đổi Chính sách bảo mật</h3>
<p>METTA Academy có thể cập nhật Chính sách bảo mật này theo từng thời điểm để phù hợp với hoạt động thực tế, thay đổi công nghệ hoặc yêu cầu pháp luật.</p>
<p>Phiên bản mới nhất sẽ được đăng tải trên website. Việc người dùng tiếp tục truy cập hoặc sử dụng website sau khi Chính sách được cập nhật được hiểu là người dùng đã đọc và đồng ý với các thay đổi đó.</p>`;

const DEFAULT_TERMS_OF_USE = `<h2>ĐIỀU KHOẢN SỬ DỤNG</h2>
<p><em>Cập nhật lần cuối: 03/06/2026</em></p>
<p>Chào mừng bạn đến với website <a href="https://metta-academy.gg99.vn/">https://metta-academy.gg99.vn/</a> của METTA Academy.</p>
<p>Khi truy cập, sử dụng website, điền form đăng ký tư vấn hoặc tương tác với các nội dung trên website, người dùng được hiểu là đã đọc, hiểu và đồng ý tuân thủ các Điều khoản sử dụng dưới đây.</p>

<h3>1. Phạm vi áp dụng</h3>
<p>Điều khoản này áp dụng cho toàn bộ người dùng truy cập website METTA Academy, bao gồm phụ huynh, học viên, khách hàng tiềm năng, đối tác, nhân sự nội bộ hoặc bất kỳ cá nhân/tổ chức nào sử dụng website.</p>
<p>Nếu người dùng không đồng ý với bất kỳ nội dung nào trong Điều khoản này, vui lòng ngừng truy cập và sử dụng website.</p>

<h3>2. Mục đích của website</h3>
<p>Website METTA Academy được xây dựng nhằm:</p>
<ul>
<li>Giới thiệu thông tin về METTA Academy;</li>
<li>Cung cấp thông tin về chương trình học, khóa học, phương pháp đào tạo và hoạt động giáo dục;</li>
<li>Tiếp nhận đăng ký tư vấn từ phụ huynh/học viên;</li>
<li>Hỗ trợ liên hệ, chăm sóc khách hàng và quản lý thông tin đăng ký;</li>
<li>Cung cấp các nội dung truyền thông, học thuật hoặc thông tin liên quan đến giáo dục.</li>
</ul>
<p>Thông tin trên website chỉ mang tính giới thiệu, tham khảo và có thể được cập nhật theo từng thời điểm.</p>

<h3>3. Đăng ký tư vấn và cung cấp thông tin</h3>
<p>Khi điền form đăng ký tư vấn, người dùng cam kết:</p>
<ul>
<li>Cung cấp thông tin trung thực, chính xác và hợp pháp;</li>
<li>Có quyền cung cấp thông tin của học viên nếu học viên là trẻ em hoặc người phụ thuộc;</li>
<li>Không sử dụng thông tin của người khác để đăng ký nếu chưa được cho phép;</li>
<li>Chịu trách nhiệm với nội dung thông tin mình cung cấp.</li>
</ul>
<p>METTA Academy có quyền từ chối xử lý các thông tin đăng ký không đầy đủ, không chính xác, có dấu hiệu giả mạo, spam hoặc vi phạm pháp luật.</p>

<h3>4. Liên hệ tư vấn và chăm sóc khách hàng</h3>
<p>Sau khi người dùng gửi thông tin đăng ký, METTA Academy có thể liên hệ qua điện thoại, email, Zalo, SMS hoặc các phương thức phù hợp khác để tư vấn chương trình học, xác nhận nhu cầu hoặc hỗ trợ thông tin liên quan.</p>
<p>Người dùng có thể từ chối nhận thông tin tư vấn/marketing bất kỳ lúc nào bằng cách thông báo trực tiếp với nhân sự tư vấn hoặc liên hệ qua thông tin hỗ trợ của METTA Academy.</p>

<h3>5. Tài khoản quản trị và hệ thống nội bộ</h3>
<p>Trong trường hợp website có khu vực đăng nhập dành cho nhân sự, giáo viên, quản lý hoặc người dùng được cấp quyền, người dùng tài khoản có trách nhiệm:</p>
<ul>
<li>Bảo mật thông tin đăng nhập;</li>
<li>Không chia sẻ tài khoản cho người không có thẩm quyền;</li>
<li>Chỉ sử dụng hệ thống đúng phạm vi công việc được phân quyền;</li>
<li>Không tự ý sao chép, trích xuất, chuyển giao hoặc sử dụng dữ liệu ngoài mục đích được phép;</li>
<li>Thông báo ngay cho quản trị viên khi phát hiện rò rỉ tài khoản hoặc truy cập bất thường.</li>
</ul>
<p>METTA Academy có quyền tạm khóa, thu hồi hoặc giới hạn quyền truy cập nếu phát hiện tài khoản có dấu hiệu vi phạm bảo mật, sử dụng sai mục đích hoặc gây ảnh hưởng đến hệ thống.</p>

<h3>6. Quyền sở hữu trí tuệ</h3>
<p>Toàn bộ nội dung trên website, bao gồm nhưng không giới hạn ở tên thương hiệu, logo, hình ảnh, bài viết, thiết kế giao diện, biểu tượng, video, tài liệu học tập, nội dung khóa học và bố cục website thuộc quyền sở hữu hoặc quyền sử dụng hợp pháp của METTA Academy.</p>
<p>Người dùng không được tự ý:</p>
<ul>
<li>Sao chép, chỉnh sửa, phân phối hoặc đăng tải lại nội dung website;</li>
<li>Sử dụng hình ảnh, logo, tài liệu hoặc nội dung của METTA Academy cho mục đích thương mại;</li>
<li>Gỡ bỏ thông tin bản quyền hoặc dấu hiệu nhận diện thương hiệu;</li>
<li>Sử dụng nội dung website để gây nhầm lẫn về quan hệ hợp tác, đại diện hoặc bảo trợ từ METTA Academy.</li>
</ul>
<p>Việc trích dẫn nội dung chỉ được thực hiện khi có sự đồng ý của METTA Academy hoặc khi tuân thủ đúng quy định pháp luật về sở hữu trí tuệ.</p>

<h3>7. Hành vi bị cấm</h3>
<p>Người dùng không được thực hiện các hành vi sau khi sử dụng website:</p>
<ul>
<li>Cung cấp thông tin giả mạo, sai sự thật hoặc mạo danh người khác;</li>
<li>Gửi spam, nội dung quảng cáo trái phép hoặc thông tin gây rối;</li>
<li>Can thiệp, tấn công, dò quét, khai thác lỗ hổng hoặc làm gián đoạn hệ thống;</li>
<li>Tải lên hoặc phát tán mã độc, virus, phần mềm gây hại;</li>
<li>Thu thập dữ liệu người dùng, học viên, phụ huynh hoặc nhân sự khi chưa được phép;</li>
<li>Sử dụng website cho mục đích lừa đảo, vi phạm pháp luật hoặc xâm phạm quyền lợi của bên thứ ba;</li>
<li>Đăng tải, truyền gửi nội dung xúc phạm, đe dọa, phân biệt đối xử, phản cảm hoặc trái thuần phong mỹ tục.</li>
</ul>
<p>METTA Academy có quyền chặn truy cập, xóa dữ liệu, tạm ngưng tài khoản hoặc chuyển thông tin cho cơ quan có thẩm quyền nếu phát hiện hành vi vi phạm.</p>

<h3>8. Thông tin khóa học và kết quả học tập</h3>
<p>METTA Academy nỗ lực cung cấp thông tin chính xác về chương trình học, giáo viên, lịch học, học phí, ưu đãi và nội dung đào tạo. Tuy nhiên, các thông tin này có thể thay đổi theo từng thời điểm tùy theo kế hoạch vận hành thực tế.</p>
<p>Kết quả học tập của học viên phụ thuộc vào nhiều yếu tố như năng lực nền tảng, mức độ tham gia, sự đồng hành của phụ huynh, phương pháp học tập và quá trình rèn luyện cá nhân. Vì vậy, METTA Academy không cam kết tuyệt đối một kết quả cụ thể nếu không được thể hiện rõ bằng văn bản chính thức.</p>

<h3>9. Học phí, ưu đãi và thanh toán</h3>
<p>Nếu website có hiển thị học phí, chương trình ưu đãi hoặc thông tin thanh toán, các nội dung này chỉ có giá trị tại thời điểm được công bố và có thể được điều chỉnh theo chính sách của METTA Academy.</p>
<p>Việc đăng ký học, thanh toán, hoàn phí, bảo lưu hoặc chuyển lớp sẽ được thực hiện theo chính sách riêng, thỏa thuận đăng ký học hoặc hợp đồng/phiếu xác nhận giữa METTA Academy và phụ huynh/học viên.</p>
<p>Trong trường hợp có sự khác biệt giữa thông tin trên website và văn bản xác nhận chính thức, nội dung tại văn bản xác nhận chính thức sẽ được ưu tiên áp dụng.</p>

<h3>10. Giới hạn trách nhiệm</h3>
<p>METTA Academy cố gắng duy trì website hoạt động ổn định, chính xác và an toàn. Tuy nhiên, chúng tôi không cam kết website sẽ luôn không bị gián đoạn, không có lỗi kỹ thuật hoặc không bị ảnh hưởng bởi các sự kiện ngoài khả năng kiểm soát.</p>
<p>METTA Academy không chịu trách nhiệm đối với:</p>
<ul>
<li>Thiệt hại phát sinh do người dùng cung cấp thông tin sai;</li>
<li>Việc người dùng tự ý sử dụng thông tin trên website không đúng mục đích;</li>
<li>Lỗi kết nối Internet, thiết bị, trình duyệt hoặc nền tảng bên thứ ba;</li>
<li>Nội dung, chính sách hoặc hoạt động của website/dịch vụ bên thứ ba được liên kết từ website;</li>
<li>Các sự kiện bất khả kháng như thiên tai, sự cố kỹ thuật diện rộng, tấn công mạng, thay đổi chính sách từ nền tảng thứ ba hoặc yêu cầu của cơ quan nhà nước.</li>
</ul>

<h3>11. Bảo mật thông tin cá nhân</h3>
<p>Việc thu thập, sử dụng và bảo vệ thông tin cá nhân của người dùng được thực hiện theo Chính sách bảo mật được công bố trên website.</p>
<p>Bằng việc sử dụng website và cung cấp thông tin, người dùng xác nhận đã đọc, hiểu và đồng ý với Chính sách bảo mật của METTA Academy.</p>

<h3>12. Tạm ngưng hoặc thay đổi website</h3>
<p>METTA Academy có quyền cập nhật, thay đổi, tạm ngưng hoặc chấm dứt một phần/toàn bộ website, tính năng, nội dung hoặc dịch vụ trên website mà không cần thông báo trước trong trường hợp cần thiết.</p>
<p>Chúng tôi có thể cập nhật giao diện, nội dung khóa học, biểu mẫu đăng ký, hệ thống quản lý, chính sách vận hành hoặc các tài liệu liên quan để phù hợp với hoạt động thực tế.</p>

<h3>13. Giải quyết khiếu nại và tranh chấp</h3>
<p>Nếu có bất kỳ thắc mắc, phản ánh hoặc khiếu nại nào liên quan đến việc sử dụng website, người dùng vui lòng liên hệ:</p>
<ul>
<li>Email: [Email liên hệ]</li>
<li>Hotline: [Số điện thoại]</li>
<li>Địa chỉ: [Địa chỉ công ty/trung tâm]</li>
</ul>
<p>METTA Academy sẽ tiếp nhận và xử lý phản ánh trên tinh thần thiện chí, hợp tác và phù hợp với quy định pháp luật Việt Nam.</p>
<p>Trường hợp phát sinh tranh chấp không thể giải quyết thông qua thương lượng, tranh chấp sẽ được giải quyết tại cơ quan có thẩm quyền theo quy định của pháp luật Việt Nam.</p>

<h3>14. Thay đổi Điều khoản sử dụng</h3>
<p>METTA Academy có thể sửa đổi, cập nhật Điều khoản sử dụng này theo từng thời điểm. Phiên bản mới nhất sẽ được đăng tải trên website.</p>
<p>Việc người dùng tiếp tục truy cập hoặc sử dụng website sau khi Điều khoản được cập nhật được hiểu là người dùng đã đồng ý với các thay đổi đó.</p>`;

export const siteSettings: SiteSettings = {
  brandName: 'METTA Academy',
  logoUrl: '/brand/logo.png',
  faviconUrl: '/favicon.svg',
  primaryColor: '#003B7A',
  secondaryColor: '#1267AE',
  accentColor: '#F45A0A',
  fontFamily: 'Inter',
  hotline: '090 000 0000',
  email: 'hello@mettaacademy.vn',
  address: 'METTA Academy Campus',
  socials: {
    facebook: 'https://www.facebook.com/anhngumetta',
    messenger: 'https://www.facebook.com/messages/t/anhngumetta',
    tiktok: 'https://tiktok.com',
    youtube: 'https://youtube.com',
  },
  footerText: 'Learn with Mind. Lead with Heart.',
  headerLinks: [
    { label: 'Giới thiệu', href: '/#about' },
    {
      label: 'Chương trình học', href: '/#programs',
      children: [
        { label: 'METTA Kiddies', href: '/programs/metta-kiddies' },
        { label: 'METTA on Phonics', href: '/programs/metta-on-phonics' },
        { label: 'METTA Young Learner', href: '/programs/metta-young-learner' },
        { label: 'IELTS Junior', href: '/programs/ielts-junior' },
      ],
    },
    { label: 'Đội ngũ giáo viên', href: '/#teachers' },
    { label: 'Tin tức', href: '/tin-tuc' },
    { label: 'Liên hệ', href: '/#lead-form' },
  ],
  headerCtaText: 'Đăng ký tư vấn',
  headerCtaLink: '/#lead-form',
  programs: [
    {
      slug: 'metta-kiddies',
      title: 'METTA Kiddies',
      eyebrow: 'Tiếng Anh mầm non thế hệ mới',
      ageRange: '3-6 tuổi',
      duration: '75 phút/buổi',
      courseName: 'Mẫu giáo',
      image: '/brand/workshop-kids.jpg',
      summary: 'Khơi mở tiềm năng vàng và định hình tư duy ngôn ngữ tự nhiên cho trẻ mầm non.',
      description: 'METTA Kiddies tạo môi trường học không áp lực, nơi trẻ được sống trong tiếng Anh qua trò chơi, hoạt động tương tác, câu chuyện, âm nhạc và trải nghiệm đa giác quan.',
      highlights: [
        'Thẩm thấu ngôn ngữ tự nhiên trong giai đoạn vàng 3-6 tuổi',
        'Triết lý giáo dục khai phóng, ưu tiên well-being và sự tự tin của trẻ',
        'Học liệu mầm non hiện đại, tích hợp kỹ năng sống và cảm xúc',
        'Smart classroom, video stories và creative zone tăng hứng thú học tập',
      ],
      methodology: ['Học qua chơi', 'Active Learning', 'CLIL', 'Đa giác quan', 'Well-being'],
      outcomes: [
        'Hình thành ngữ điệu và phản xạ tiếng Anh tự nhiên',
        'Tăng sự tự tin khi nghe, nói và tham gia hoạt động nhóm',
        'Phát triển trí thông minh đa dạng, kỹ năng xã hội và tự điều chỉnh',
        'Có nền tảng sẵn sàng bước vào tiếng Anh tiểu học',
      ],
      roadmap: [
        'Làm quen âm thanh, nhịp điệu và từ vựng qua bài hát, hình ảnh',
        'Tương tác bằng câu ngắn, phản hồi qua trò chơi và vận động',
        'Kể chuyện, đóng vai, hoạt động sáng tạo theo chủ đề',
        'Tổng kết năng lực nghe nói và tư vấn lộ trình tiếp theo',
      ],
    } as ProgramCms,
    {
      slug: 'metta-young-learners',
      title: 'METTA Young Learners',
      eyebrow: 'Tiếng Anh thiếu nhi quốc tế',
      ageRange: '7-12 tuổi',
      duration: '90 phút x 2 buổi/tuần',
      courseName: 'Thiếu Nhi',
      image: '/brand/brand-banner.jpg',
      summary: 'Khởi đầu vững chắc cho hành trình công dân toàn cầu với lộ trình Cambridge rõ ràng.',
      description: 'METTA Young Learners được thiết kế theo CEFR, dùng học liệu từ các nhà xuất bản uy tín như Oxford và Cambridge, giúp học sinh phát triển đồng đều nghe, nói, đọc, viết.',
      highlights: [
        'Lộ trình theo Cambridge YLE, hướng đến Starters, Movers, Flyers, KET và PET',
        'Oxford Discover với phương pháp Inquiry-based Learning',
        'Tích hợp CLIL, activity-based learning và student-centered approach',
        'Phát triển future skills: thuyết trình, làm việc nhóm, tư duy sáng tạo',
      ],
      methodology: ['Inquiry-based', 'CLIL', 'Project-based', 'Student-centered', 'Visual approach'],
      outcomes: [
        'Xây nền tiếng Anh học thuật và giao tiếp cho bậc tiểu học',
        'Phát triển năng lực nghe, nói, đọc, viết theo chuẩn quốc tế',
        'Biết đặt câu hỏi, khám phá và trình bày ý tưởng bằng tiếng Anh',
        'Sẵn sàng cho các mốc chứng chỉ Cambridge phù hợp độ tuổi',
      ],
      roadmap: [
        'Level 1: Oxford Discover 1, Cambridge Starters Practice, mục tiêu Pre A1',
        'Level 2: Oxford Discover 2, Cambridge Movers Practice, mục tiêu A1',
        'Level 3: Oxford Discover 3, Cambridge Flyers Practice, mục tiêu A2',
        'Level 4-5: Oxford Discover 4-5, KET/PET Practice, mục tiêu A2-B1',
      ],
    } as ProgramCms,
    {
      slug: 'metta-on-phonics',
      title: 'METTA on Phonics',
      eyebrow: 'Đánh vần chuẩn bản xứ',
      ageRange: '4-10 tuổi',
      duration: '75 phút/buổi',
      courseName: 'Phonics',
      image: '/brand/workshop-pattern.jpg',
      summary: 'Làm chủ nền tảng đọc viết tiếng Anh thông qua quy tắc âm, chữ và đánh vần như trẻ bản xứ.',
      description: 'METTA on Phonics sử dụng Oxford Phonics World 1-5, giúp trẻ kết nối âm thanh với chữ cái, đọc từ mới độc lập và viết chính tả tự tin hơn.',
      highlights: [
        'Giáo trình Oxford Phonics World 1-5',
        'Học thông qua chơi với bài hát, câu đố, hoạt hình và nhân vật sinh động',
        'Dạy trẻ tư duy về mối liên hệ giữa âm thanh và ký tự',
        'Trang bị quy tắc giải mã để trẻ tự đọc từ mới, không học vẹt mặt chữ',
      ],
      methodology: ['Phonics Friends', 'Blending', 'Segmenting', 'Songs & chants', 'Decoding rules'],
      outcomes: [
        'Nhận diện âm, ghép âm và tách âm chính xác hơn',
        'Đọc từ mới tự tin nhờ hiểu quy tắc phát âm',
        'Viết chính tả tốt hơn qua liên kết âm và chữ',
        'Có nền tảng đọc viết vững chắc trước và trong bậc tiểu học',
      ],
      roadmap: [
        'Level 1: Letter sounds và short vowels',
        'Level 2: Consonant blends và short vowel words',
        'Level 3: Long vowels và vowel combinations',
        'Level 4-5: Advanced phonics, reading fluency và spelling confidence',
      ],
    } as ProgramCms,
  ] as ProgramCms[],
  footerColumns: [
    {
      title: 'Khám phá',
      links: [
        { label: 'Về chúng tôi', href: '#about' },
        { label: 'Chương trình học', href: '#programs' },
        { label: 'Phương pháp', href: '#method' },
        { label: 'Tin tức', href: '#news' },
      ],
    },
    {
      title: 'Thông tin',
      links: [
        { label: 'Chính sách bảo mật', href: '/chinh-sach-bao-mat' },
        { label: 'Điều khoản sử dụng', href: '/dieu-khoan-su-dung' },
        { label: 'Câu hỏi thường gặp', href: '#' },
        { label: 'Hợp tác', href: '#' },
      ],
    },
  ],
  facilities: {
    visible: true,
    eyebrow: 'Không gian học tập',
    title: 'Cơ sở vật chất tại METTA Academy',
    description: 'Không gian học tập hiện đại, chỉn chu và truyền cảm hứng, giúp học viên thoải mái phát triển mỗi ngày.',
    images: [
      { src: '/images/facilities/facility-1.jpg', alt: 'Phòng học hiện đại tại METTA Academy', title: '' },
      { src: '/images/facilities/facility-2.jpg', alt: 'Toà nhà METTA Academy', title: '' },
      { src: '/images/facilities/facility-3.jpg', alt: 'Khu vực lễ tân METTA Academy', title: '' },
    ],
  },
  legalPages: [
    { slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật', content: DEFAULT_PRIVACY_POLICY, visible: true, updatedAt: now },
    { slug: 'dieu-khoan-su-dung', title: 'Điều khoản sử dụng', content: DEFAULT_TERMS_OF_USE, visible: true, updatedAt: now },
  ],
  updatedAt: now
};

export const pages: CmsPage[] = [
  { id: 'page-home', title: 'Homepage', slug: 'homepage', metaTitle: 'METTA Academy', metaDescription: 'Trung tâm tiếng Anh trẻ em.', status: 'published', createdAt: now, updatedAt: now },
  { id: 'page-phonics', title: 'Landing Page Phonics', slug: 'landing-page-phonics', metaTitle: 'Phonics METTA', metaDescription: 'Chương trình phát âm và ghép âm.', status: 'published', createdAt: now, updatedAt: now },
  { id: 'page-ebook', title: 'Landing Page Ebook', slug: 'landing-page-ebook', metaTitle: 'Ebook học tiếng Anh', metaDescription: 'Tải ebook miễn phí.', status: 'draft', createdAt: now, updatedAt: now }
];

export const sections: PageSection[] = [
  /* ── Homepage ── */
  {
    id: 'sec-1', pageId: 'page-home', type: 'Hero', order: 1, visible: true, createdAt: now, updatedAt: now,
    title: 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai',
    subtitle: 'Hành trình tiếng Anh đẳng cấp quốc tế',
    description: 'Chương trình tiếng Anh hiện đại cho trẻ 3–18 tuổi. Chuẩn Cambridge, giáo viên bản ngữ, cam kết đầu ra rõ ràng.',
    imageUrl: '/brand/hero-classroom.png',
    buttonText: 'Đăng ký tư vấn miễn phí',
    buttonLink: '#lead-form',
    button2Text: 'Khám phá chương trình',
    button2Link: '#programs',
  },
  {
    id: 'sec-2', pageId: 'page-home', type: 'Stats', order: 2, visible: false, createdAt: now, updatedAt: now,
    title: 'METTA Academy trong những con số',
    extraData: JSON.stringify([
      { number: '5.000+', label: 'Học viên tốt nghiệp' },
      { number: '50+', label: 'Giáo viên chuyên môn' },
      { number: '10+', label: 'Năm kinh nghiệm' },
      { number: '95%', label: 'Phụ huynh hài lòng' },
    ]),
  },
  {
    id: 'sec-3', pageId: 'page-home', type: 'Courses', order: 3, visible: true, anchorId: 'programs', createdAt: now, updatedAt: now,
    title: 'Chương trình đào tạo',
    subtitle: 'Lộ trình cá nhân hóa cho từng độ tuổi',
    description: 'Ba chương trình trọng tâm thiết kế theo chuẩn Cambridge & Oxford, phù hợp từng giai đoạn phát triển của trẻ.',
  },
  {
    id: 'sec-4', pageId: 'page-home', type: 'Benefits', order: 4, visible: true, anchorId: 'about', createdAt: now, updatedAt: now,
    title: 'Tại sao ba mẹ chọn METTA Academy?',
    subtitle: 'Hơn 10 năm kiến tạo tương lai thế hệ trẻ',
    description: 'Chúng tôi không chỉ dạy tiếng Anh – chúng tôi xây dựng nền tảng tư duy, sự tự tin và kỹ năng lãnh đạo cho thế hệ kế thừa.',
    extraData: JSON.stringify([
      { icon: 'school', color: 'text-cta-orange', title: 'Giáo trình chuẩn quốc tế', desc: 'Chương trình Oxford & Cambridge, được thiết kế theo CEFR, tích hợp học liệu từ National Geographic Learning.' },
      { icon: 'groups', color: 'text-accent-cyan', title: 'Giáo viên bản ngữ & CELTA/TESOL', desc: '100% giáo viên có chứng chỉ quốc tế, tận tâm và có kinh nghiệm dạy trẻ em ở nhiều quốc gia.' },
      { icon: 'rocket_launch', color: 'text-cta-orange', title: 'Lớp học sĩ số nhỏ', desc: 'Tối đa 12–15 học viên/lớp để giáo viên có thể chú ý và cá nhân hóa từng học sinh.' },
      { icon: 'psychology', color: 'text-accent-cyan', title: 'Phương pháp tư duy phản biện', desc: 'Học sinh được khuyến khích đặt câu hỏi, phân tích và thuyết trình ý kiến bằng tiếng Anh.' },
      { icon: 'dashboard', color: 'text-cta-orange', title: 'Cơ sở hiện đại 5 sao', desc: 'Smart classroom, phòng lab STEM, thư viện học liệu và không gian học sáng tạo tiêu chuẩn quốc tế.' },
      { icon: 'monitoring', color: 'text-accent-cyan', title: 'Báo cáo tiến độ định kỳ', desc: 'Hệ thống theo dõi học tập thông minh, phụ huynh nhận báo cáo và phản hồi sau mỗi tháng học.' },
    ]),
  },
  {
    id: 'sec-5', pageId: 'page-home', type: 'Testimonials', order: 5, visible: true, createdAt: now, updatedAt: now,
    title: 'Phụ huynh & học viên nói gì về METTA?',
    subtitle: 'Hơn 5.000 gia đình đã tin tưởng lựa chọn',
    extraData: JSON.stringify([
      { name: 'Chị Nguyễn Thanh Hà', role: 'Phụ huynh bé Bảo An – Lớp Kiddies', quote: 'Sau 6 tháng học tại METTA, con tôi đã tự tin giao tiếp với người nước ngoài. Phương pháp giảng dạy rất phù hợp với độ tuổi của con và giáo viên cực kỳ tận tâm.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&auto=format&fit=crop' },
      { name: 'Anh Trần Văn Minh', role: 'Phụ huynh bé Gia Bảo – Lớp Young Learners', quote: 'METTA không chỉ dạy tiếng Anh mà còn giúp con học được kỹ năng tư duy và thuyết trình. Con tiến bộ rõ rệt chỉ sau 3 tháng, ngữ pháp và phát âm đều tốt hơn hẳn.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop' },
      { name: 'Chị Lê Thu Hương', role: 'Phụ huynh bé Khánh Vy – Lớp Phonics', quote: 'Con tôi từ không biết gì về phonics, giờ đã tự đọc được sách tiếng Anh! Giáo viên METTA dạy rất kiên nhẫn và có phương pháp riêng giúp trẻ tiếp thu nhanh.', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&q=80&auto=format&fit=crop' },
    ]),
  },
  {
    id: 'sec-6', pageId: 'page-home', type: 'Teachers', order: 6, visible: true, anchorId: 'teachers', createdAt: now, updatedAt: now,
    title: 'Đội ngũ giáo viên xuất sắc',
    subtitle: '100% giáo viên bản ngữ & chuyên gia TESOL/CELTA',
    description: 'Mỗi giáo viên tại METTA đều được tuyển chọn kỹ lưỡng về chuyên môn, kinh nghiệm và khả năng truyền cảm hứng cho trẻ em.',
    extraData: JSON.stringify([
      { name: 'Ms. Sarah Johnson', role: 'Head of Academics', exp: 'CELTA | 8 năm kinh nghiệm', nationality: '🇬🇧 British', photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&auto=format&fit=crop' },
      { name: 'Mr. David Kim', role: 'Senior Teacher', exp: 'TESOL | 6 năm kinh nghiệm', nationality: '🇦🇺 Australian', photo: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&q=80&auto=format&fit=crop' },
      { name: 'Ms. Linh Nguyễn', role: 'Academic Coordinator', exp: 'M.Ed | 7 năm kinh nghiệm', nationality: '🇻🇳 Vietnamese', photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80&auto=format&fit=crop' },
      { name: 'Mr. James Brown', role: 'Phonics Specialist', exp: 'DELTA | 5 năm kinh nghiệm', nationality: '🇺🇸 American', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80&auto=format&fit=crop' },
    ]),
  },
  {
    id: 'sec-7', pageId: 'page-home', type: 'News', order: 7, visible: true, createdAt: now, updatedAt: now,
    title: 'Tin tức & Sự kiện',
    subtitle: 'Cập nhật mới nhất từ METTA Academy',
    extraData: JSON.stringify([
      { title: 'Khai giảng lớp IELTS Foundation tháng 6/2026', date: '01/06/2026', category: 'Tin tức', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80&auto=format&fit=crop', excerpt: 'METTA Academy chính thức mở đăng ký lớp IELTS Foundation dành cho học sinh THCS và THPT, khai giảng ngày 01/06/2026.' },
      { title: 'Workshop tiếng Anh hè 2026 – Trải nghiệm thú vị cho bé', date: '20/05/2026', category: 'Sự kiện', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80&auto=format&fit=crop', excerpt: 'Chương trình hè đặc biệt với các hoạt động sáng tạo, STEM và English Camp dành cho trẻ 6–15 tuổi trong hè 2026.' },
      { title: 'METTA tham dự Hội thảo Giáo dục Quốc tế SEAMEO 2026', date: '10/05/2026', category: 'Thành tích', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80&auto=format&fit=crop', excerpt: 'Đại diện METTA Academy trình bày tham luận về ứng dụng AI trong giáo dục ngôn ngữ tại hội thảo SEAMEO 2026.' },
    ]),
  },
  {
    id: 'sec-facilities', pageId: 'page-home', type: 'Facilities', order: 8, visible: true, anchorId: 'facilities', createdAt: now, updatedAt: now,
    title: 'Cơ sở vật chất tại METTA Academy',
    subtitle: 'Không gian học tập',
    description: 'Không gian học tập hiện đại, chỉn chu và truyền cảm hứng, giúp học viên thoải mái phát triển mỗi ngày.',
    extraData: JSON.stringify([
      { src: '/images/facilities/facility-1.jpg', alt: 'Phòng học hiện đại tại METTA Academy', title: '' },
      { src: '/images/facilities/facility-2.jpg', alt: 'Toà nhà METTA Academy', title: '' },
      { src: '/images/facilities/facility-3.jpg', alt: 'Khu vực lễ tân METTA Academy', title: '' },
    ]),
  },
  {
    id: 'sec-9', pageId: 'page-home', type: 'Lead Form', order: 9, visible: true, createdAt: now, updatedAt: now,
    title: 'Đăng ký tư vấn miễn phí',
    formId: 'consultation-form',
  },
  {
    id: 'sec-8', pageId: 'page-home', type: 'CTA', order: 10, visible: false, createdAt: now, updatedAt: now,
    title: 'Sẵn sàng để con tỏa sáng cùng METTA Academy?',
    subtitle: 'Đăng ký ngay để nhận bài kiểm tra năng lực MIỄN PHÍ và lộ trình học tập chuyên biệt cho bé.',
    buttonText: 'ĐĂNG KÝ TƯ VẤN NGAY',
    buttonLink: '#lead-form',
    button2Text: 'HOTLINE: 1900 1234',
    button2Link: 'tel:19001234',
  },
  /* ── Phonics landing page ── */
  { id: 'sec-p1', pageId: 'page-phonics', type: 'Hero', title: 'Phonics tại METTA', subtitle: 'Nền tảng phát âm chuẩn bản xứ', description: 'Giúp học sinh nhận diện âm, ghép âm, đọc và phát âm tiếng Anh tự tin như người bản ngữ.', imageUrl: '/brand/hero-classroom.png', buttonText: 'Đăng ký học thử', buttonLink: '#lead-form', order: 1, visible: true, createdAt: now, updatedAt: now },
  { id: 'sec-p2', pageId: 'page-phonics', type: 'Lead Form', title: 'Nhận tư vấn khóa Phonics', formId: 'phonics-form', order: 2, visible: true, createdAt: now, updatedAt: now },
];

export const mediaItems: MediaItem[] = [
  { id: 'media-1', name: 'METTA Logo', fileUrl: '/brand/logo.png', fileType: 'image/jpeg', fileSize: 80499, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-2', name: 'Brand Banner', fileUrl: '/brand/brand-banner.jpg', fileType: 'image/jpeg', fileSize: 189260, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-3', name: 'Workshop Kids', fileUrl: '/brand/workshop-kids.jpg', fileType: 'image/jpeg', fileSize: 142258, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-4', name: 'Hero Classroom', fileUrl: '/brand/hero-classroom.png', fileType: 'image/png', fileSize: 1984372, uploadedBy: 'Admin', createdAt: now }
];

export const users: AdminUser[] = [
  { id: 'u1', fullName: 'METTA Admin', email: 'admin@mettaacademy.vn', role: 'admin', active: true, createdAt: now },
  { id: 'u2', fullName: 'Ms. Linh', email: 'linh@mettaacademy.vn', role: 'sales', active: true, createdAt: now },
  { id: 'u3', fullName: 'Teacher An', email: 'teacher@mettaacademy.vn', role: 'design', active: true, createdAt: now }
];

export const courses: Course[] = [
  { id: 'course-mg', name: 'METTA Kiddies', code: 'MAU-GIAO', description: 'Chương trình tiếng Anh nền tảng dành cho học sinh lứa tuổi mẫu giáo, tập trung vào nghe, nói, phát âm và phản xạ ngôn ngữ tự nhiên.', ageRange: '4-6 tuổi', level: 'Beginner', totalSessions: 48, sessionDuration: '75 phút', tuitionFee: 7200000, curriculum: 'Songs, stories, TPR, phonemic awareness', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-ph', name: 'METTA on Phonics', code: 'PHONICS', description: 'Chương trình phonics cho trẻ 5-7 tuổi, giúp học sinh giải mã âm chữ, đọc độc lập và phát âm chuẩn bản xứ.', ageRange: '5-7 tuổi', level: 'Early Primary', totalSessions: 60, sessionDuration: '90 phút', tuitionFee: 5600000, curriculum: 'Oxford Phonics World, blending, segmenting, songs and chants', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-tn', name: 'METTA Young Learner', code: 'YOUNG-LEARNER', description: 'Chương trình tiểu học 6-12 tuổi, phát triển tiếng Anh, tư duy, kỹ năng thế kỷ 21 và lộ trình Cambridge Starters - Movers - Flyers.', ageRange: '6-12 tuổi', level: 'Primary', totalSessions: 72, sessionDuration: '90 phút', tuitionFee: 9000000, curriculum: '3E, STEAM, Discovery Education, project-based learning', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-ij', name: 'IELTS Junior', code: 'IELTS-JUNIOR', description: 'Chương trình THCS 11-15 tuổi, xây nền IELTS học thuật từ sớm với mục tiêu 1.5 đến 3.0+ và cam kết đầu ra.', ageRange: '11-15 tuổi', level: 'Secondary', totalSessions: 72, sessionDuration: '90 phút', tuitionFee: 9800000, curriculum: 'AI-powered practice, CLIL, IELTS skills, Knowledge Chunking', status: 'Đang mở', createdAt: now, updatedAt: now }
];

export const classes: ClassItem[] = [
  { id: 'class-mg-01', name: 'MG-01', code: 'MG-01', courseId: 'course-mg', teacherId: 'Teacher An', assistantId: 'Ms. Linh', startDate: '2026-06-03', expectedEndDate: '2026-09-30', scheduleText: 'Thứ 3, Thứ 5 - 17:30', room: 'Room A1', maxStudents: 12, currentStudentCount: 4, status: 'Sắp khai giảng', notes: 'Lớp mẫu giáo mới', createdAt: now, updatedAt: now },
  { id: 'class-mg-02', name: 'MG-02', code: 'MG-02', courseId: 'course-mg', teacherId: 'Teacher An', startDate: '2026-05-10', expectedEndDate: '2026-08-30', scheduleText: 'Thứ 7, Chủ nhật - 09:00', room: 'Room A2', maxStudents: 12, currentStudentCount: 3, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-tn-01', name: 'TN-01', code: 'TN-01', courseId: 'course-tn', teacherId: 'Teacher Bình', startDate: '2026-05-15', expectedEndDate: '2026-10-15', scheduleText: 'Thứ 2, Thứ 4 - 18:00', room: 'Room B1', maxStudents: 16, currentStudentCount: 5, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-tn-02', name: 'TN-02', code: 'TN-02', courseId: 'course-tn', teacherId: 'Teacher Bình', startDate: '2026-06-08', expectedEndDate: '2026-11-08', scheduleText: 'Thứ 6 - 18:00, Chủ nhật - 15:00', room: 'Room B2', maxStudents: 16, currentStudentCount: 2, status: 'Sắp khai giảng', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-ph-01', name: 'PHONICS-01', code: 'PHONICS-01', courseId: 'course-ph', teacherId: 'Teacher Chi', startDate: '2026-05-12', expectedEndDate: '2026-08-12', scheduleText: 'Thứ 3, Thứ 5 - 18:30', room: 'Room C1', maxStudents: 14, currentStudentCount: 4, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-ph-02', name: 'PHONICS-02', code: 'PHONICS-02', courseId: 'course-ph', teacherId: 'Teacher Chi', startDate: '2026-06-20', expectedEndDate: '2026-09-20', scheduleText: 'Thứ 7 - 14:00', room: 'Room C2', maxStudents: 14, currentStudentCount: 2, status: 'Sắp khai giảng', notes: '', createdAt: now, updatedAt: now }
];

const studentNames = ['Nguyễn Minh Anh', 'Trần Gia Bảo', 'Lê Khánh Linh', 'Phạm Hà My', 'Đặng Quang Minh', 'Võ An Nhiên', 'Bùi Nhật Nam', 'Hoàng Tuệ Lâm', 'Đỗ Hoàng Phúc', 'Mai Ngọc Hân', 'Phan Đức Anh', 'Tạ Bảo Ngọc', 'Lý Minh Khang', 'Đinh Gia Huy', 'Cao Phương Thảo', 'Ngô Hải Nam', 'Trịnh Mai Chi', 'Vũ Quỳnh Anh', 'Hồ Tuấn Kiệt', 'Dương Bảo Châu'];
const courseCycle = ['METTA Kiddies', 'METTA on Phonics', 'METTA Young Learner', 'IELTS Junior'] as const;
const classCycle = ['class-mg-01', 'class-tn-01', 'class-ph-01', 'class-mg-02', 'class-tn-02', 'class-ph-02'];
export const students: Student[] = studentNames.map((name, i) => {
  const interestedCourse = courseCycle[i % courseCycle.length];
  const currentClassId = classCycle[i % classCycle.length];
  return {
    id: `stu-${i + 1}`,
    fullName: name,
    phone: `09${String(10000000 + i * 12345).slice(0, 8)}`,
    email: `student${i + 1}@example.com`,
    dateOfBirth: `201${i % 6}-0${(i % 9) + 1}-12`,
    age: `${4 + (i % 8)}`,
    school: i % 2 ? 'Tiểu học Nguyễn Du' : 'Mầm non Hoa Sen',
    currentClass: i % 3 === 0 ? 'Mẫu giáo lớn' : `Lớp ${1 + (i % 5)}`,
    parentName: `Phụ huynh ${name}`,
    parentPhone: `08${String(90000000 + i * 23456).slice(0, 8)}`,
    parentEmail: `parent${i + 1}@example.com`,
    sourceLeadId: i < 5 ? `lead-${i + 1}` : undefined,
    interestedCourse,
    currentCourseId: interestedCourse === 'METTA Kiddies' ? 'course-mg' : interestedCourse === 'METTA on Phonics' ? 'course-ph' : interestedCourse === 'METTA Young Learner' ? 'course-tn' : 'course-ij',
    currentClassId,
    currentLevel: i % 2 ? 'Starter' : 'Beginner',
    targetGoal: 'Tự tin nghe nói và phát âm chuẩn',
    status: ['Đang học', 'Đã đăng ký', 'Bảo lưu', 'Hoàn thành khóa', 'Tạm nghỉ'][i % 5] as Student['status'],
    assignedTo: i % 2 ? 'Ms. Linh' : 'Teacher An',
    notes: 'Seed student MVP',
    createdAt: `2026-05-${String(1 + (i % 25)).padStart(2, '0')}T09:00:00+07:00`,
    updatedAt: now
  };
});

export const classStudents: ClassStudent[] = students.slice(0, 18).map((student, i) => ({
  id: `cs-${i + 1}`,
  classId: student.currentClassId || classCycle[i % classCycle.length],
  studentId: student.id,
  joinedAt: '2026-05-20T09:00:00+07:00',
  status: 'Đang học',
  notes: ''
}));

export const classSessions: ClassSession[] = classes.flatMap((classItem, classIndex) =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `session-${classItem.id}-${i + 1}`,
    classId: classItem.id,
    sessionNumber: i + 1,
    title: `Buổi ${i + 1}: ${i === 0 ? 'Orientation' : 'Practice'}`,
    date: `2026-05-${String(26 + i).padStart(2, '0')}`,
    startTime: classItem.scheduleText.includes('18') ? '18:00' : '17:30',
    endTime: classItem.scheduleText.includes('18') ? '19:30' : '18:45',
    teacherId: classItem.teacherId,
    room: classItem.room,
    lessonContent: ['Warm-up, vocabulary, speaking practice', 'Phonics sounds and blending', 'Storytelling and role-play'][classIndex % 3],
    homework: 'Practice worksheet',
    status: i === 0 ? 'Đã hoàn thành' : 'Sắp diễn ra',
    createdAt: now,
    updatedAt: now
  }))
);

const demoLeadSources = [
  ['Meta Lead Form', 5],
  ['Referral', 5],
  ['Website', 4],
  ['Meta Ads', 4],
  ['Zalo OA', 4],
  ['Sales input', 3],
  ['TikTok Ads', 3],
  ['Walk-in', 3],
  ['Instagram Ads', 3],
  ['Khác', 1],
] as const;

const demoLeadCenters = ['METTA Quận 1', 'METTA Thảo Điền', 'METTA Phú Nhuận'] as const;
const demoPendingOptions = [
  pendingReasonOptions[0],
  pendingReasonOptions[6],
  pendingReasonOptions[9],
] as const;

const demoLeadNames = [
  ['Chị Hạnh Nguyễn', 'Bé Bảo An'],
  ['Anh Minh Trần', 'Minh Khang'],
  ['Chị Thu Hà', 'Gia Linh'],
  ['Anh Quốc Bảo', 'Bảo Châu'],
  ['Chị Mai Anh', 'Tuệ Lâm'],
  ['Chị Ngọc Diệp', 'Khánh An'],
  ['Anh Hải Nam', 'Nhật Minh'],
  ['Chị Phương Thảo', 'Hoàng Phúc'],
  ['Anh Đức Huy', 'Quỳnh Anh'],
  ['Chị Thanh Vân', 'Minh Quân'],
] as const;

const demoPriorityLeads: Lead[] = demoLeadNames.map(([parentName, studentName], index) => {
  const [source, priorityLevel] = demoLeadSources[index];
  const course = courseCycle[index % courseCycle.length];
  const statusCycle = ['Lead mới', 'Đã liên hệ', 'Chưa nghe máy', 'Đã hẹn tư vấn', 'Đã tư vấn/Đặt lịch test', 'Đã test/Học thử', DEAL_QUOTED_STATUS, DEAL_QUOTED_STATUS, WON_LEAD_STATUS, LOST_LEAD_STATUS] as Lead['status'][];
  const status = statusCycle[index % statusCycle.length];
  const pendingOption = status === DEAL_QUOTED_STATUS ? demoPendingOptions[index % demoPendingOptions.length] : undefined;
  const discountPercent = discountPercentOptions[index % discountPercentOptions.length];
  const expectedRevenue = expectedRevenueFrom(DEFAULT_COURSE_DEAL_SIZE, discountPercent);
  const isWon = status === WON_LEAD_STATUS;
  const hasFinance = Boolean(pendingOption || isWon);
  return {
    id: `lead-demo-priority-${index + 1}`,
    fullName: studentName,
    parentName,
    studentName,
    phone: `0988${String(100000 + index * 137).slice(0, 6)}`,
    email: `demo-lead-${index + 1}@example.com`,
    contactType: 'parent',
    age: `${5 + (index % 7)}`,
    school: index % 2 ? 'Tiểu học Nguyễn Du' : 'Trường quốc tế Việt Úc',
    currentClass: index % 3 === 0 ? 'Mẫu giáo lớn' : `Lớp ${1 + (index % 5)}`,
    interestedCourse: course,
    currentLevel: '',
    targetGoal: '',
    source,
    centerName: demoLeadCenters[index % demoLeadCenters.length],
    priorityLevel,
    status,
    assignedTo: index % 2 ? 'Teacher An' : 'Ms. Linh',
    assignedToName: index % 2 ? 'Teacher An' : 'Ms. Linh',
    followUpDate: `2026-06-${String(3 + (index % 8)).padStart(2, '0')}T${String(9 + (index % 7)).padStart(2, '0')}:30:00+07:00`,
    consultationDate: index % 3 === 0 ? `2026-06-${String(4 + index).padStart(2, '0')}T17:30:00+07:00` : '',
    ...(hasFinance ? {
      dealSize: DEFAULT_COURSE_DEAL_SIZE,
      dealCurrency: DEFAULT_DEAL_CURRENCY,
      discountPercent,
      dealPackage: `${course} demo package`,
      dealNote: isWon ? 'Demo lead đã đăng ký học, expected revenue đã chuyển thành revenue.' : 'Đã báo phí demo để kiểm tra discount, expected revenue và warmth trên Kanban.',
      expectedRevenue,
      ...(isWon ? { revenue: expectedRevenue, revenueAt: now, wonAt: now } : {}),
      expectedCloseDate: `2026-06-${String(12 + index).padStart(2, '0')}`,
      ...(pendingOption ? {
        pendingReason: pendingOption.reason,
        pendingReasonNote: pendingOption.defaultNote,
        pendingWarmthPercent: pendingOption.warmthPercent,
      } : {}),
    } : {}),
    ...(status === LOST_LEAD_STATUS ? { lostReason: 'Không phù hợp lịch học', lostNote: 'Demo lead mất để kiểm tra cột và báo cáo.' } : {}),
    initialNote: `Demo lead ưu tiên P${priorityLevel} từ ${source}.`,
    createdAt: `2026-06-${String(1 + index).padStart(2, '0')}T0${8 + (index % 2)}:00:00+07:00`,
    updatedAt: now,
  };
});

export const leads: Lead[] = [
  ...demoPriorityLeads,
  { id: 'lead-1', fullName: 'Nguyễn Hoàng Anh', phone: '0901234567', email: 'anh@example.com', contactType: 'parent', age: '8', school: 'Tiểu học Nguyễn Du', currentClass: 'Lớp 3', interestedCourse: 'METTA Young Learner', currentLevel: 'Beginner', targetGoal: 'Tự tin giao tiếp', source: 'Website', centerName: 'METTA Quận 1', status: 'Lead mới', assignedTo: 'Ms. Linh', followUpDate: '2026-05-26T15:00:00+07:00', consultationDate: '2026-05-27T09:00:00+07:00', initialNote: 'Muốn con phản xạ tốt hơn.', createdAt: '2026-05-26T08:10:00+07:00', updatedAt: now },
  { id: 'lead-2', fullName: 'Trần Minh Khoa', phone: '0912345678', email: 'khoa@example.com', contactType: 'student', age: '7', school: 'Tiểu học Lê Lợi', currentClass: 'Lớp 2', interestedCourse: 'METTA on Phonics', currentLevel: 'Starter', targetGoal: 'Phát âm chuẩn', source: 'Facebook Ads', centerName: 'METTA Thảo Điền', status: 'Đã hẹn tư vấn', assignedTo: 'Ms. Linh', followUpDate: '2026-05-26T16:30:00+07:00', consultationDate: '2026-05-28T18:00:00+07:00', initialNote: 'Quan tâm Phonics.', createdAt: '2026-05-25T10:20:00+07:00', updatedAt: now },
  { id: 'lead-3', fullName: 'Lê Thu Hà', phone: '0987654321', email: 'ha@example.com', contactType: 'parent', age: '5', school: 'Mầm non Hoa Sen', currentClass: 'Lá', interestedCourse: 'METTA Kiddies', currentLevel: 'Starter', targetGoal: 'Làm quen tiếng Anh', source: 'Landing Page', centerName: 'METTA Phú Nhuận', status: 'Đã liên hệ', assignedTo: 'Ms. Linh', followUpDate: '2026-05-27T10:00:00+07:00', initialNote: 'Cần lớp cuối tuần.', createdAt: '2026-05-24T14:10:00+07:00', updatedAt: now },
  { id: 'lead-4', fullName: 'Phạm Gia Bảo', phone: '0933333333', email: 'bao@example.com', contactType: 'parent', age: '10', school: 'Tiểu học Trần Phú', currentClass: 'Lớp 5', interestedCourse: 'METTA Young Learner', currentLevel: 'A1', targetGoal: 'Tăng phản xạ', source: 'Zalo', centerName: 'METTA Quận 1', status: DEAL_QUOTED_STATUS, assignedTo: 'Ms. Linh', consultationDate: '2026-05-26T11:00:00+07:00', dealSize: DEFAULT_COURSE_DEAL_SIZE, dealCurrency: DEFAULT_DEAL_CURRENCY, discountPercent: 15, dealPackage: 'Young Learner 48 buổi', expectedRevenue: expectedRevenueFrom(DEFAULT_COURSE_DEAL_SIZE, 15), expectedCloseDate: '2026-05-31', pendingReason: pendingReasonOptions[2].reason, pendingReasonNote: pendingReasonOptions[2].defaultNote, pendingWarmthPercent: pendingReasonOptions[2].warmthPercent, dealNote: 'Đã báo phí trọn khóa, phụ huynh đang cân nhắc lịch học.', initialNote: 'Đã tư vấn lớp TN-01.', createdAt: '2026-05-23T09:00:00+07:00', updatedAt: now },
  { id: 'lead-5', fullName: 'Đặng Quỳnh Như', phone: '0977777777', email: 'nhu@example.com', contactType: 'student', age: '6', school: 'Tiểu học Gia Định', currentClass: 'Lớp 1', interestedCourse: 'METTA on Phonics', currentLevel: 'Beginner', targetGoal: 'Ghép âm tốt', source: 'Referral', centerName: 'METTA Thảo Điền', status: WON_LEAD_STATUS, assignedTo: 'Ms. Linh', dealSize: DEFAULT_COURSE_DEAL_SIZE, dealCurrency: DEFAULT_DEAL_CURRENCY, discountPercent: 10, dealPackage: 'Phonics 36 buổi', expectedRevenue: expectedRevenueFrom(DEFAULT_COURSE_DEAL_SIZE, 10), revenue: expectedRevenueFrom(DEFAULT_COURSE_DEAL_SIZE, 10), revenueAt: '2026-05-20T17:30:00+07:00', wonAt: '2026-05-20T17:30:00+07:00', initialNote: 'Đã chuyển đổi học sinh.', createdAt: '2026-05-20T17:00:00+07:00', updatedAt: now, convertedToStudentId: 'stu-1' },
  ...Array.from({ length: 5 }, (_, i) => ({
    id: `lead-x${i}`,
    fullName: `Lead mẫu ${i + 1}`,
    phone: `09000000${i}${i}`,
    email: `lead${i + 1}@example.com`,
    contactType: 'parent' as const,
    age: `${5 + i}`,
    school: 'Trường quốc tế',
    currentClass: `Lớp ${1 + i}`,
    interestedCourse: courseCycle[i % courseCycle.length],
    currentLevel: 'Starter',
    targetGoal: 'Tăng phản xạ',
    source: ['Website', 'Landing Page', 'Facebook Ads', 'Zalo', 'Khác'][i] as Lead['source'],
    centerName: demoLeadCenters[i % demoLeadCenters.length],
    status: ['Chưa nghe máy', 'Đã test/Học thử', LOST_LEAD_STATUS, 'Lead mới', 'Đã liên hệ'][i] as Lead['status'],
    lostReason: i === 2 ? 'Không liên lạc được' : '',
    assignedTo: i % 2 ? 'Teacher An' : 'Ms. Linh',
    followUpDate: `2026-05-${26 + (i % 3)}T10:00:00+07:00`,
    initialNote: 'Seed lead cho CRM.',
    createdAt: `2026-05-${20 + i}T09:00:00+07:00`,
    updatedAt: now
  }))
];

export const leadActivities: LeadActivity[] = [
  { id: 'act-1', leadId: 'lead-1', type: 'call', content: 'Gọi lần 1, phụ huynh muốn nhận lịch học.', createdBy: 'Ms. Linh', createdAt: now },
  { id: 'act-2', leadId: 'lead-2', type: 'zalo', content: 'Đã gửi thông tin khóa Phonics qua Zalo.', createdBy: 'Ms. Linh', createdAt: now },
  { id: 'act-3', leadId: 'lead-4', type: 'consultation', content: 'Tư vấn lớp Thiếu Nhi.', createdBy: 'Ms. Linh', createdAt: now }
];

export const appointments: Appointment[] = [
  { id: 'ap-1', leadId: 'lead-1', title: 'Gọi tư vấn phụ huynh Hoàng Anh', type: 'Gọi lại', startTime: '2026-05-26T15:00:00+07:00', endTime: '2026-05-26T15:20:00+07:00', assignedTo: 'Ms. Linh', status: 'upcoming', notes: 'Chuẩn bị lịch lớp Thiếu Nhi.', createdAt: now, updatedAt: now },
  { id: 'ap-2', leadId: 'lead-2', title: 'Test đầu vào Phonics', type: 'Test đầu vào', startTime: '2026-05-26T16:30:00+07:00', endTime: '2026-05-26T17:00:00+07:00', assignedTo: 'Teacher An', status: 'upcoming', notes: 'Kiểm tra phát âm.', createdAt: now, updatedAt: now },
  { id: 'ap-3', leadId: 'lead-3', title: 'Follow-up lớp cuối tuần', type: 'Gọi lại', startTime: '2026-05-25T10:30:00+07:00', endTime: '2026-05-25T10:45:00+07:00', assignedTo: 'Ms. Linh', status: 'overdue', notes: 'Chưa xử lý.', createdAt: now, updatedAt: now },
  { id: 'ap-4', leadId: 'lead-4', title: 'Tư vấn lớp TN-01', type: 'Tư vấn', startTime: '2026-05-27T14:00:00+07:00', endTime: '2026-05-27T15:00:00+07:00', assignedTo: 'Ms. Linh', status: 'upcoming', notes: '', createdAt: now, updatedAt: now },
  { id: 'ap-5', studentId: 'stu-1', title: 'Nhắc đóng phí kỳ 2', type: 'Nhắc đóng phí', startTime: '2026-05-28T09:00:00+07:00', endTime: '2026-05-28T09:10:00+07:00', assignedTo: 'Ms. Linh', status: 'upcoming', notes: 'Student active.', createdAt: now, updatedAt: now }
];

export const capiSettings: CapiSettings = { id: 'capi-main', pixelId: '123456789000000', accessToken: 'mock-token-hidden-in-production', testEventCode: 'TEST12345', defaultSourceUrl: 'https://mettaacademy.vn', enableBrowserPixel: true, enableServerCapi: true, enableDeduplication: true, updatedAt: now };

export const capiMappings: CapiMapping[] = [
  { id: 'map-1', formId: 'phonics-form', formName: 'Landing Page Phonics Form', eventName: 'Lead', landingPageSlug: 'landing-page-phonics', enabled: true, sendBrowserEvent: true, sendServerEvent: true, customDataFields: ['course', 'source'], updatedAt: now },
  { id: 'map-2', formId: 'consultation-form', formName: 'Form tư vấn khóa học', eventName: 'CompleteRegistration', landingPageSlug: 'homepage', enabled: true, sendBrowserEvent: true, sendServerEvent: true, customDataFields: ['course', 'lead_status'], updatedAt: now },
  { id: 'map-3', formId: 'contact-form', formName: 'Contact Form', eventName: 'Contact', landingPageSlug: 'contact', enabled: true, sendBrowserEvent: true, sendServerEvent: false, customDataFields: ['source'], updatedAt: now }
];

export const capiEventLogs: CapiEventLog[] = Array.from({ length: 10 }, (_, i) => ({
  id: `capi-${i + 1}`,
  eventName: ['Lead', 'Contact', 'CompleteRegistration'][i % 3],
  eventId: `metta_${Date.now() - i * 100000}_${i}`,
  source: i % 2 ? 'server' : 'browser',
  sourceUrl: `https://mettaacademy.vn/${i % 2 ? 'landing-page-phonics' : ''}`,
  leadId: i < 5 ? `lead-${i + 1}` : undefined,
  formId: ['phonics-form', 'contact-form', 'consultation-form'][i % 3],
  status: i === 3 || i === 8 ? 'failed' : 'success',
  responseMessage: i === 3 || i === 8 ? 'Invalid access token mock error' : 'Event accepted by Meta mock API',
  createdAt: `2026-05-26T0${Math.min(i + 1, 9)}:15:00+07:00`,
  payloadPreview: { event_name: ['Lead', 'Contact', 'CompleteRegistration'][i % 3], action_source: 'website', course: courseCycle[i % courseCycle.length] }
}));
