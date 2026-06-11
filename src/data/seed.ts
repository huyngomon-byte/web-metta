import type { CapiEventLog, CapiMapping, CapiSettings } from '@/types/capi';
import type { ClassItem, ClassSession, ClassStudent, Course, Student } from '@/types/academic';
import type { CmsPage, MediaItem, PageSection, ProgramCms, SiteSettings } from '@/types/cms';
import type { Appointment, Lead, LeadActivity } from '@/types/crm';
import type { AdminUser } from '@/types/user';
import { DEAL_QUOTED_STATUS, DEFAULT_COURSE_DEAL_SIZE, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, discountPercentOptions, pendingReasonOptions } from '@/lib/constants';
import { expectedRevenueFrom } from '@/lib/leadFinance';
import { stageDemoLeads } from '@/data/stageDemoLeads';

const now = '2026-05-26T09:00:00+07:00';

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

const DEFAULT_PRIVACY_POLICY = `<h2>CHÍNH SÁCH BẢO MẬT</h2>
<p><em>Cập nhật lần cu�i: 03/06/2026</em></p>
<p>METTA Academy tôn trọng quyền riêng tư và cam kết bảo v�! thông tin cá nhân của phụ huynh, học viên và người dùng khi truy cập website <a href="https://www.metta.edu.vn/">https://www.metta.edu.vn/</a>.</p>
<p>Chính sách này giải thích cách METTA Academy thu thập, sử dụng, lưu trữ, bảo v�! và xử lý thông tin cá nhân khi người dùng truy cập website, �iền form �Ēng ký tư vấn, liên h�! hoặc sử dụng các d�9ch vụ liên quan.</p>

<h3>1. Đơn v�9 quản lý thông tin</h3>
<p>Website này �ược vận hành b�xi:</p>
<ul>
<li>[Tên công ty/Trung tâm]</li>
<li>Mã s� thuế: [MST]</li>
<li>Đ�9a ch�0: [Đ�9a ch�0 công ty/trung tâm]</li>
<li>Email liên h�!: [Email]</li>
<li>Hotline: [S� �i�!n thoại]</li>
</ul>
<p>Trong chính sách này, "METTA Academy", "chúng tôi" hoặc "bên vận hành" �ược hiỒu là �ơn v�9 quản lý và vận hành website nêu trên.</p>

<h3>2. Thông tin chúng tôi có thỒ thu thập</h3>
<p>Khi người dùng truy cập hoặc �iền thông tin trên website, chúng tôi có thỒ thu thập các nhóm thông tin sau:</p>
<p><strong>Thông tin do người dùng cung cấp trực tiếp, bao g�m:</strong></p>
<ul>
<li>Họ và tên phụ huynh hoặc người �Ēng ký;</li>
<li>S� �i�!n thoại;</li>
<li>Email;</li>
<li>Tên học viên;</li>
<li>Đ�" tu�"i/l�:p học của học viên;</li>
<li>Nhu cầu học tập, chương trình quan tâm;</li>
<li>N�"i dung cần tư vấn hoặc các thông tin khác do người dùng tự nguy�!n cung cấp.</li>
</ul>
<p><strong>Thông tin kỹ thuật khi truy cập website, bao g�m:</strong></p>
<ul>
<li>Đ�9a ch�0 IP;</li>
<li>Loại thiết b�9, trình duy�!t, h�! �iều hành;</li>
<li>Thời gian truy cập;</li>
<li>Trang �ã xem, hành vi tương tác trên website;</li>
<li>Cookies, pixel hoặc công ngh�! theo dõi tương tự.</li>
</ul>

<h3>3. Mục �ích sử dụng thông tin</h3>
<p>Thông tin cá nhân �ược thu thập nhằm các mục �ích sau:</p>
<ul>
<li>Liên h�! tư vấn chương trình học phù hợp;</li>
<li>Xác nhận nhu cầu học tập của phụ huynh/học viên;</li>
<li>Gửi thông tin về khóa học, l�9ch học, ưu �ãi hoặc sự ki�!n của METTA Academy;</li>
<li>ChĒm sóc khách hàng và h� trợ người dùng;</li>
<li>Quản lý dữ li�!u �Ēng ký, phân công tư vấn viên, theo dõi trạng thái liên h�!;</li>
<li>Cải thi�!n n�"i dung, giao di�!n và trải nghi�!m người dùng trên website;</li>
<li>Đo lường hi�!u quả quảng cáo, truyền thông và t�i ưu chiến d�9ch marketing;</li>
<li>Đáp ứng yêu cầu của cơ quan nhà nư�:c có thẩm quyền khi pháp luật yêu cầu.</li>
</ul>
<p>Chúng tôi không bán, trao ��"i hoặc chuyỒn nhượng thông tin cá nhân của người dùng cho bên thứ ba vì mục �ích thương mại ��"c lập nếu không có sự ��ng ý của người dùng, trừ trường hợp pháp luật có quy ��9nh khác.</p>

<h3>4. Thông tin của trẻ em/học viên</h3>
<p>Do METTA Academy hoạt ��"ng trong lĩnh vực giáo dục, website có thỒ thu thập m�"t s� thông tin liên quan �ến học viên là trẻ em như tên, ��" tu�"i, l�:p học, nhu cầu học tập.</p>
<p>Vi�!c cung cấp thông tin học viên trên website �ược hiỒu là do phụ huynh, người giám h�" hoặc người có quyền hợp pháp thực hi�!n �Ồ phục vụ mục �ích tư vấn, �Ēng ký học hoặc chĒm sóc học viên.</p>
<p>METTA Academy ch�0 sử dụng thông tin của học viên trong phạm vi cần thiết cho hoạt ��"ng tư vấn, �ào tạo, chĒm sóc và quản lý học tập. Chúng tôi không c� ý thu thập thông tin cá nhân của trẻ em nếu không có sự ��ng ý hoặc xác nhận từ phụ huynh/người giám h�".</p>

<h3>5. Cookies, pixel và công cụ phân tích</h3>
<p>Website có thỒ sử dụng cookies, pixel, thẻ theo dõi hoặc công cụ phân tích từ bên thứ ba như Google, Meta/Facebook hoặc các nền tảng quảng cáo khác �Ồ:</p>
<ul>
<li>Ghi nh�: lựa chọn của người dùng;</li>
<li>Phân tích lượng truy cập;</li>
<li>Đo lường hi�!u quả quảng cáo;</li>
<li>HiỒn th�9 n�"i dung hoặc quảng cáo phù hợp hơn;</li>
<li>Cải thi�!n trải nghi�!m người dùng trên website.</li>
</ul>
<p>Người dùng có thỒ chủ ��"ng tắt cookies trong phần cài �ặt trình duy�!t. Tuy nhiên, vi�!c tắt cookies có thỒ ảnh hư�xng �ến m�"t s� chức nĒng hoặc trải nghi�!m trên website.</p>

<h3>6. Chia sẻ thông tin v�:i bên thứ ba</h3>
<p>METTA Academy có thỒ chia sẻ thông tin cá nhân trong phạm vi cần thiết v�:i các bên sau:</p>
<ul>
<li>Nhân sự n�"i b�" phụ trách tư vấn, chĒm sóc khách hàng, �ào tạo hoặc quản lý l�:p học;</li>
<li>Đơn v�9 cung cấp hạ tầng website, lưu trữ dữ li�!u, CRM, email, SMS, t�"ng �ài hoặc công cụ quản lý khách hàng;</li>
<li>Đ�i tác quảng cáo, phân tích dữ li�!u hoặc �o lường hi�!u quả truyền thông;</li>
<li>Đơn v�9 thanh toán, kế toán hoặc pháp lý nếu phát sinh giao d�9ch;</li>
<li>Cơ quan nhà nư�:c có thẩm quyền theo quy ��9nh pháp luật.</li>
</ul>
<p>Các bên thứ ba khi tiếp cận dữ li�!u phải sử dụng thông tin �úng mục �ích �ược ch�0 ��9nh và có trách nhi�!m bảo mật thông tin theo thỏa thuận hoặc quy ��9nh pháp luật liên quan.</p>

<h3>7. Thời gian lưu trữ thông tin</h3>
<p>Thông tin cá nhân sẽ �ược lưu trữ trong thời gian cần thiết �Ồ phục vụ mục �ích �ã nêu tại Chính sách này, bao g�m tư vấn, chĒm sóc khách hàng, quản lý học viên, thực hi�!n nghĩa vụ pháp lý, giải quyết tranh chấp hoặc khi người dùng yêu cầu xóa dữ li�!u hợp l�!.</p>
<p>Khi thông tin không còn cần thiết hoặc khi người dùng yêu cầu xóa theo quy ��9nh, METTA Academy sẽ tiến hành xóa, ẩn danh hoặc hạn chế xử lý dữ li�!u, trừ trường hợp pháp luật yêu cầu phải tiếp tục lưu trữ.</p>

<h3>8. Bảo mật thông tin</h3>
<p>METTA Academy áp dụng các bi�!n pháp phù hợp nhằm bảo v�! thông tin cá nhân khỏi truy cập trái phép, mất mát, rò r�0, thay ��"i hoặc sử dụng sai mục �ích.</p>
<p>Các bi�!n pháp có thỒ bao g�m:</p>
<ul>
<li>Gi�:i hạn quyền truy cập dữ li�!u theo vai trò;</li>
<li>Sử dụng tài khoản quản tr�9 có phân quyền;</li>
<li>Lưu trữ dữ li�!u trên h�! th�ng có kiỒm soát;</li>
<li>Theo dõi, rà soát và xử lý sự c� bảo mật khi phát sinh;</li>
<li>Yêu cầu nhân sự, ��i tác liên quan tuân thủ nghĩa vụ bảo mật.</li>
</ul>
<p>Tuy nhiên, không có phương thức truyền tải hoặc lưu trữ dữ li�!u qua Internet nào an toàn tuy�!t ��i. Người dùng cần tự bảo v�! thông tin tài khoản, thiết b�9 và không chia sẻ thông tin nhạy cảm cho các ngu�n không �áng tin cậy.</p>

<h3>9. Quyền của người dùng ��i v�:i dữ li�!u cá nhân</h3>
<p>Người dùng có quyền:</p>
<ul>
<li>Yêu cầu �ược biết về vi�!c xử lý dữ li�!u cá nhân của mình;</li>
<li>Yêu cầu truy cập, ch�0nh sửa hoặc cập nhật thông tin cá nhân;</li>
<li>Rút lại sự ��ng ý cho m�"t hoặc nhiều mục �ích xử lý dữ li�!u;</li>
<li>Yêu cầu xóa hoặc hạn chế xử lý dữ li�!u trong phạm vi pháp luật cho phép;</li>
<li>Phản ánh, khiếu nại nếu cho rằng thông tin cá nhân b�9 sử dụng sai mục �ích.</li>
</ul>
<p>ĐỒ thực hi�!n các quyền trên, người dùng có thỒ liên h�! METTA Academy qua:</p>
<ul>
<li>Email: [Email liên h�!]</li>
<li>Hotline: [S� �i�!n thoại]</li>
</ul>
<p>Chúng tôi sẽ tiếp nhận và xử lý yêu cầu trong thời gian hợp lý theo quy ��9nh pháp luật và quy trình n�"i b�".</p>

<h3>10. Liên kết �ến website bên thứ ba</h3>
<p>Website có thỒ chứa liên kết �ến Facebook, Zalo, YouTube, TikTok, Google Maps hoặc các website/d�9ch vụ của bên thứ ba.</p>
<p>METTA Academy không ch�9u trách nhi�!m ��i v�:i n�"i dung, chính sách bảo mật hoặc cách thức xử lý dữ li�!u của các website/d�9ch vụ bên thứ ba. Người dùng nên �ọc kỹ chính sách riêng tư của các nền tảng �ó trư�:c khi cung cấp thông tin.</p>

<h3>11. Thay ��"i Chính sách bảo mật</h3>
<p>METTA Academy có thỒ cập nhật Chính sách bảo mật này theo từng thời �iỒm �Ồ phù hợp v�:i hoạt ��"ng thực tế, thay ��"i công ngh�! hoặc yêu cầu pháp luật.</p>
<p>Phiên bản m�:i nhất sẽ �ược �Ēng tải trên website. Vi�!c người dùng tiếp tục truy cập hoặc sử dụng website sau khi Chính sách �ược cập nhật �ược hiỒu là người dùng �ã �ọc và ��ng ý v�:i các thay ��"i �ó.</p>`;

const DEFAULT_TERMS_OF_USE = `<h2>ĐIỬU KHOẢN SỬ DỤNG</h2>
<p><em>Cập nhật lần cu�i: 03/06/2026</em></p>
<p>Chào mừng bạn �ến v�:i website <a href="https://www.metta.edu.vn/">https://www.metta.edu.vn/</a> của METTA Academy.</p>
<p>Khi truy cập, sử dụng website, �iền form �Ēng ký tư vấn hoặc tương tác v�:i các n�"i dung trên website, người dùng �ược hiỒu là �ã �ọc, hiỒu và ��ng ý tuân thủ các Điều khoản sử dụng dư�:i �ây.</p>

<h3>1. Phạm vi áp dụng</h3>
<p>Điều khoản này áp dụng cho toàn b�" người dùng truy cập website METTA Academy, bao g�m phụ huynh, học viên, khách hàng tiềm nĒng, ��i tác, nhân sự n�"i b�" hoặc bất kỳ cá nhân/t�" chức nào sử dụng website.</p>
<p>Nếu người dùng không ��ng ý v�:i bất kỳ n�"i dung nào trong Điều khoản này, vui lòng ngừng truy cập và sử dụng website.</p>

<h3>2. Mục �ích của website</h3>
<p>Website METTA Academy �ược xây dựng nhằm:</p>
<ul>
<li>Gi�:i thi�!u thông tin về METTA Academy;</li>
<li>Cung cấp thông tin về chương trình học, khóa học, phương pháp �ào tạo và hoạt ��"ng giáo dục;</li>
<li>Tiếp nhận �Ēng ký tư vấn từ phụ huynh/học viên;</li>
<li>H� trợ liên h�!, chĒm sóc khách hàng và quản lý thông tin �Ēng ký;</li>
<li>Cung cấp các n�"i dung truyền thông, học thuật hoặc thông tin liên quan �ến giáo dục.</li>
</ul>
<p>Thông tin trên website ch�0 mang tính gi�:i thi�!u, tham khảo và có thỒ �ược cập nhật theo từng thời �iỒm.</p>

<h3>3. ĐĒng ký tư vấn và cung cấp thông tin</h3>
<p>Khi �iền form �Ēng ký tư vấn, người dùng cam kết:</p>
<ul>
<li>Cung cấp thông tin trung thực, chính xác và hợp pháp;</li>
<li>Có quyền cung cấp thông tin của học viên nếu học viên là trẻ em hoặc người phụ thu�"c;</li>
<li>Không sử dụng thông tin của người khác �Ồ �Ēng ký nếu chưa �ược cho phép;</li>
<li>Ch�9u trách nhi�!m v�:i n�"i dung thông tin mình cung cấp.</li>
</ul>
<p>METTA Academy có quyền từ ch�i xử lý các thông tin �Ēng ký không �ầy �ủ, không chính xác, có dấu hi�!u giả mạo, spam hoặc vi phạm pháp luật.</p>

<h3>4. Liên h�! tư vấn và chĒm sóc khách hàng</h3>
<p>Sau khi người dùng gửi thông tin �Ēng ký, METTA Academy có thỒ liên h�! qua �i�!n thoại, email, Zalo, SMS hoặc các phương thức phù hợp khác �Ồ tư vấn chương trình học, xác nhận nhu cầu hoặc h� trợ thông tin liên quan.</p>
<p>Người dùng có thỒ từ ch�i nhận thông tin tư vấn/marketing bất kỳ lúc nào bằng cách thông báo trực tiếp v�:i nhân sự tư vấn hoặc liên h�! qua thông tin h� trợ của METTA Academy.</p>

<h3>5. Tài khoản quản tr�9 và h�! th�ng n�"i b�"</h3>
<p>Trong trường hợp website có khu vực �Ēng nhập dành cho nhân sự, giáo viên, quản lý hoặc người dùng �ược cấp quyền, người dùng tài khoản có trách nhi�!m:</p>
<ul>
<li>Bảo mật thông tin �Ēng nhập;</li>
<li>Không chia sẻ tài khoản cho người không có thẩm quyền;</li>
<li>Ch�0 sử dụng h�! th�ng �úng phạm vi công vi�!c �ược phân quyền;</li>
<li>Không tự ý sao chép, trích xuất, chuyỒn giao hoặc sử dụng dữ li�!u ngoài mục �ích �ược phép;</li>
<li>Thông báo ngay cho quản tr�9 viên khi phát hi�!n rò r�0 tài khoản hoặc truy cập bất thường.</li>
</ul>
<p>METTA Academy có quyền tạm khóa, thu h�i hoặc gi�:i hạn quyền truy cập nếu phát hi�!n tài khoản có dấu hi�!u vi phạm bảo mật, sử dụng sai mục �ích hoặc gây ảnh hư�xng �ến h�! th�ng.</p>

<h3>6. Quyền s�x hữu trí tu�!</h3>
<p>Toàn b�" n�"i dung trên website, bao g�m nhưng không gi�:i hạn �x tên thương hi�!u, logo, hình ảnh, bài viết, thiết kế giao di�!n, biỒu tượng, video, tài li�!u học tập, n�"i dung khóa học và b� cục website thu�"c quyền s�x hữu hoặc quyền sử dụng hợp pháp của METTA Academy.</p>
<p>Người dùng không �ược tự ý:</p>
<ul>
<li>Sao chép, ch�0nh sửa, phân ph�i hoặc �Ēng tải lại n�"i dung website;</li>
<li>Sử dụng hình ảnh, logo, tài li�!u hoặc n�"i dung của METTA Academy cho mục �ích thương mại;</li>
<li>Gỡ bỏ thông tin bản quyền hoặc dấu hi�!u nhận di�!n thương hi�!u;</li>
<li>Sử dụng n�"i dung website �Ồ gây nhầm lẫn về quan h�! hợp tác, �ại di�!n hoặc bảo trợ từ METTA Academy.</li>
</ul>
<p>Vi�!c trích dẫn n�"i dung ch�0 �ược thực hi�!n khi có sự ��ng ý của METTA Academy hoặc khi tuân thủ �úng quy ��9nh pháp luật về s�x hữu trí tu�!.</p>

<h3>7. Hành vi b�9 cấm</h3>
<p>Người dùng không �ược thực hi�!n các hành vi sau khi sử dụng website:</p>
<ul>
<li>Cung cấp thông tin giả mạo, sai sự thật hoặc mạo danh người khác;</li>
<li>Gửi spam, n�"i dung quảng cáo trái phép hoặc thông tin gây r�i;</li>
<li>Can thi�!p, tấn công, dò quét, khai thác l� h�"ng hoặc làm gián �oạn h�! th�ng;</li>
<li>Tải lên hoặc phát tán mã ��"c, virus, phần mềm gây hại;</li>
<li>Thu thập dữ li�!u người dùng, học viên, phụ huynh hoặc nhân sự khi chưa �ược phép;</li>
<li>Sử dụng website cho mục �ích lừa �ảo, vi phạm pháp luật hoặc xâm phạm quyền lợi của bên thứ ba;</li>
<li>ĐĒng tải, truyền gửi n�"i dung xúc phạm, �e dọa, phân bi�!t ��i xử, phản cảm hoặc trái thuần phong mỹ tục.</li>
</ul>
<p>METTA Academy có quyền chặn truy cập, xóa dữ li�!u, tạm ngưng tài khoản hoặc chuyỒn thông tin cho cơ quan có thẩm quyền nếu phát hi�!n hành vi vi phạm.</p>

<h3>8. Thông tin khóa học và kết quả học tập</h3>
<p>METTA Academy n� lực cung cấp thông tin chính xác về chương trình học, giáo viên, l�9ch học, học phí, ưu �ãi và n�"i dung �ào tạo. Tuy nhiên, các thông tin này có thỒ thay ��"i theo từng thời �iỒm tùy theo kế hoạch vận hành thực tế.</p>
<p>Kết quả học tập của học viên phụ thu�"c vào nhiều yếu t� như nĒng lực nền tảng, mức ��" tham gia, sự ��ng hành của phụ huynh, phương pháp học tập và quá trình rèn luy�!n cá nhân. Vì vậy, METTA Academy không cam kết tuy�!t ��i m�"t kết quả cụ thỒ nếu không �ược thỒ hi�!n rõ bằng vĒn bản chính thức.</p>

<h3>9. Học phí, ưu �ãi và thanh toán</h3>
<p>Nếu website có hiỒn th�9 học phí, chương trình ưu �ãi hoặc thông tin thanh toán, các n�"i dung này ch�0 có giá tr�9 tại thời �iỒm �ược công b� và có thỒ �ược �iều ch�0nh theo chính sách của METTA Academy.</p>
<p>Vi�!c �Ēng ký học, thanh toán, hoàn phí, bảo lưu hoặc chuyỒn l�:p sẽ �ược thực hi�!n theo chính sách riêng, thỏa thuận �Ēng ký học hoặc hợp ��ng/phiếu xác nhận giữa METTA Academy và phụ huynh/học viên.</p>
<p>Trong trường hợp có sự khác bi�!t giữa thông tin trên website và vĒn bản xác nhận chính thức, n�"i dung tại vĒn bản xác nhận chính thức sẽ �ược ưu tiên áp dụng.</p>

<h3>10. Gi�:i hạn trách nhi�!m</h3>
<p>METTA Academy c� gắng duy trì website hoạt ��"ng �"n ��9nh, chính xác và an toàn. Tuy nhiên, chúng tôi không cam kết website sẽ luôn không b�9 gián �oạn, không có l�i kỹ thuật hoặc không b�9 ảnh hư�xng b�xi các sự ki�!n ngoài khả nĒng kiỒm soát.</p>
<p>METTA Academy không ch�9u trách nhi�!m ��i v�:i:</p>
<ul>
<li>Thi�!t hại phát sinh do người dùng cung cấp thông tin sai;</li>
<li>Vi�!c người dùng tự ý sử dụng thông tin trên website không �úng mục �ích;</li>
<li>L�i kết n�i Internet, thiết b�9, trình duy�!t hoặc nền tảng bên thứ ba;</li>
<li>N�"i dung, chính sách hoặc hoạt ��"ng của website/d�9ch vụ bên thứ ba �ược liên kết từ website;</li>
<li>Các sự ki�!n bất khả kháng như thiên tai, sự c� kỹ thuật di�!n r�"ng, tấn công mạng, thay ��"i chính sách từ nền tảng thứ ba hoặc yêu cầu của cơ quan nhà nư�:c.</li>
</ul>

<h3>11. Bảo mật thông tin cá nhân</h3>
<p>Vi�!c thu thập, sử dụng và bảo v�! thông tin cá nhân của người dùng �ược thực hi�!n theo Chính sách bảo mật �ược công b� trên website.</p>
<p>Bằng vi�!c sử dụng website và cung cấp thông tin, người dùng xác nhận �ã �ọc, hiỒu và ��ng ý v�:i Chính sách bảo mật của METTA Academy.</p>

<h3>12. Tạm ngưng hoặc thay ��"i website</h3>
<p>METTA Academy có quyền cập nhật, thay ��"i, tạm ngưng hoặc chấm dứt m�"t phần/toàn b�" website, tính nĒng, n�"i dung hoặc d�9ch vụ trên website mà không cần thông báo trư�:c trong trường hợp cần thiết.</p>
<p>Chúng tôi có thỒ cập nhật giao di�!n, n�"i dung khóa học, biỒu mẫu �Ēng ký, h�! th�ng quản lý, chính sách vận hành hoặc các tài li�!u liên quan �Ồ phù hợp v�:i hoạt ��"ng thực tế.</p>

<h3>13. Giải quyết khiếu nại và tranh chấp</h3>
<p>Nếu có bất kỳ thắc mắc, phản ánh hoặc khiếu nại nào liên quan �ến vi�!c sử dụng website, người dùng vui lòng liên h�!:</p>
<ul>
<li>Email: [Email liên h�!]</li>
<li>Hotline: [S� �i�!n thoại]</li>
<li>Đ�9a ch�0: [Đ�9a ch�0 công ty/trung tâm]</li>
</ul>
<p>METTA Academy sẽ tiếp nhận và xử lý phản ánh trên tinh thần thi�!n chí, hợp tác và phù hợp v�:i quy ��9nh pháp luật Vi�!t Nam.</p>
<p>Trường hợp phát sinh tranh chấp không thỒ giải quyết thông qua thương lượng, tranh chấp sẽ �ược giải quyết tại cơ quan có thẩm quyền theo quy ��9nh của pháp luật Vi�!t Nam.</p>

<h3>14. Thay ��"i Điều khoản sử dụng</h3>
<p>METTA Academy có thỒ sửa ��"i, cập nhật Điều khoản sử dụng này theo từng thời �iỒm. Phiên bản m�:i nhất sẽ �ược �Ēng tải trên website.</p>
<p>Vi�!c người dùng tiếp tục truy cập hoặc sử dụng website sau khi Điều khoản �ược cập nhật �ược hiỒu là người dùng �ã ��ng ý v�:i các thay ��"i �ó.</p>`;

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
    { label: 'Gi�:i thi�!u', href: '/#about' },
    {
      label: 'Chương trình học', href: '/#programs',
      children: [
        { label: 'METTA Kiddies', href: '/programs/metta-kiddies' },
        { label: 'METTA on Phonics', href: '/programs/metta-on-phonics' },
        { label: 'METTA Young Learner', href: '/programs/metta-young-learner' },
        { label: 'IELTS Junior', href: '/programs/ielts-junior' },
      ],
    },
    { label: 'Đ�"i ngũ giáo viên', href: '/#teachers' },
    { label: 'Tin tức', href: '/tin-tuc' },
    { label: 'Liên h�!', href: '/#lead-form' },
  ],
  headerCtaText: 'ĐĒng ký tư vấn',
  headerCtaLink: '/#lead-form',
  programs: [
    {
      slug: 'metta-kiddies',
      title: 'METTA Kiddies',
      eyebrow: 'Tiếng Anh mầm non thế h�! m�:i',
      ageRange: '3-6 tu�"i',
      duration: '75 phút/bu�"i',
      courseName: 'Mẫu giáo',
      image: '/brand/workshop-kids.jpg',
      summary: 'Khơi m�x tiềm nĒng vàng và ��9nh hình tư duy ngôn ngữ tự nhiên cho trẻ mầm non.',
      description: 'METTA Kiddies tạo môi trường học không áp lực, nơi trẻ �ược s�ng trong tiếng Anh qua trò chơi, hoạt ��"ng tương tác, câu chuy�!n, âm nhạc và trải nghi�!m �a giác quan.',
      highlights: [
        'Thẩm thấu ngôn ngữ tự nhiên trong giai �oạn vàng 3-6 tu�"i',
        'Triết lý giáo dục khai phóng, ưu tiên well-being và sự tự tin của trẻ',
        'Học li�!u mầm non hi�!n �ại, tích hợp kỹ nĒng s�ng và cảm xúc',
        'Smart classroom, video stories và creative zone tĒng hứng thú học tập',
      ],
      methodology: ['Học qua chơi', 'Active Learning', 'CLIL', 'Đa giác quan', 'Well-being'],
      outcomes: [
        'Hình thành ngữ �i�!u và phản xạ tiếng Anh tự nhiên',
        'TĒng sự tự tin khi nghe, nói và tham gia hoạt ��"ng nhóm',
        'Phát triỒn trí thông minh �a dạng, kỹ nĒng xã h�"i và tự �iều ch�0nh',
        'Có nền tảng sẵn sàng bư�:c vào tiếng Anh tiỒu học',
      ],
      roadmap: [
        'Làm quen âm thanh, nh�9p �i�!u và từ vựng qua bài hát, hình ảnh',
        'Tương tác bằng câu ngắn, phản h�i qua trò chơi và vận ��"ng',
        'KỒ chuy�!n, �óng vai, hoạt ��"ng sáng tạo theo chủ �ề',
        'T�"ng kết nĒng lực nghe nói và tư vấn l�" trình tiếp theo',
      ],
    } as ProgramCms,
    {
      slug: 'metta-young-learners',
      title: 'METTA Young Learners',
      eyebrow: 'Tiếng Anh thiếu nhi qu�c tế',
      ageRange: '7-12 tu�"i',
      duration: '90 phút x 2 bu�"i/tuần',
      courseName: 'Thiếu Nhi',
      image: '/brand/brand-banner.jpg',
      summary: 'Kh�xi �ầu vững chắc cho hành trình công dân toàn cầu v�:i l�" trình Cambridge rõ ràng.',
      description: 'METTA Young Learners �ược thiết kế theo CEFR, dùng học li�!u từ các nhà xuất bản uy tín như Oxford và Cambridge, giúp học sinh phát triỒn ��ng �ều nghe, nói, �ọc, viết.',
      highlights: [
        'L�" trình theo Cambridge YLE, hư�:ng �ến Starters, Movers, Flyers, KET và PET',
        'Oxford Discover v�:i phương pháp Inquiry-based Learning',
        'Tích hợp CLIL, activity-based learning và student-centered approach',
        'Phát triỒn future skills: thuyết trình, làm vi�!c nhóm, tư duy sáng tạo',
      ],
      methodology: ['Inquiry-based', 'CLIL', 'Project-based', 'Student-centered', 'Visual approach'],
      outcomes: [
        'Xây nền tiếng Anh học thuật và giao tiếp cho bậc tiỒu học',
        'Phát triỒn nĒng lực nghe, nói, �ọc, viết theo chuẩn qu�c tế',
        'Biết �ặt câu hỏi, khám phá và trình bày ý tư�xng bằng tiếng Anh',
        'Sẵn sàng cho các m�c chứng ch�0 Cambridge phù hợp ��" tu�"i',
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
      ageRange: '4-10 tu�"i',
      duration: '75 phút/bu�"i',
      courseName: 'Phonics',
      image: '/brand/workshop-pattern.jpg',
      summary: 'Làm chủ nền tảng �ọc viết tiếng Anh thông qua quy tắc âm, chữ và �ánh vần như trẻ bản xứ.',
      description: 'METTA on Phonics sử dụng Oxford Phonics World 1-5, giúp trẻ kết n�i âm thanh v�:i chữ cái, �ọc từ m�:i ��"c lập và viết chính tả tự tin hơn.',
      highlights: [
        'Giáo trình Oxford Phonics World 1-5',
        'Học thông qua chơi v�:i bài hát, câu ��, hoạt hình và nhân vật sinh ��"ng',
        'Dạy trẻ tư duy về m�i liên h�! giữa âm thanh và ký tự',
        'Trang b�9 quy tắc giải mã �Ồ trẻ tự �ọc từ m�:i, không học vẹt mặt chữ',
      ],
      methodology: ['Phonics Friends', 'Blending', 'Segmenting', 'Songs & chants', 'Decoding rules'],
      outcomes: [
        'Nhận di�!n âm, ghép âm và tách âm chính xác hơn',
        'Đọc từ m�:i tự tin nhờ hiỒu quy tắc phát âm',
        'Viết chính tả t�t hơn qua liên kết âm và chữ',
        'Có nền tảng �ọc viết vững chắc trư�:c và trong bậc tiỒu học',
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
    title: 'Cơ s�x vật chất tại METTA Academy',
    description: 'Không gian học tập hi�!n �ại, ch�0n chu và truyền cảm hứng, giúp học viên thoải mái phát triỒn m�i ngày.',
    images: [
      { src: '/images/facilities/facility-1.jpg', alt: 'Phòng học hi�!n �ại tại METTA Academy', title: '' },
      { src: '/images/facilities/facility-2.jpg', alt: 'Toà nhà METTA Academy', title: '' },
      { src: '/images/facilities/facility-3.jpg', alt: 'Khu vực l�& tân METTA Academy', title: '' },
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
  { id: 'page-ebook', title: 'Landing Page Ebook', slug: 'landing-page-ebook', metaTitle: 'Ebook học tiếng Anh', metaDescription: 'Tải ebook mi�&n phí.', status: 'draft', createdAt: now, updatedAt: now }
  ,
  { id: 'page-metta-plus', title: 'Metta+ Pass', slug: 'metta-plus', metaTitle: 'Metta+ Pass | METTA Academy', metaDescription: 'Dang ky tu van CLB he Metta+ voi Tieng Anh, Ky nang va STEM Robotics tai METTA Academy.', status: 'published', createdAt: now, updatedAt: now }
];

export const sections: PageSection[] = [
  /* ���� Homepage ���� */
  {
    id: 'sec-1', pageId: 'page-home', type: 'Hero', order: 1, visible: true, createdAt: now, updatedAt: now,
    title: 'Giỏi ngoại ngữ, giàu kỹ nĒng, lãnh �ạo tương lai',
    subtitle: 'Hành trình tiếng Anh �ẳng cấp qu�c tế',
    description: 'Chương trình tiếng Anh hi�!n �ại cho trẻ 3�18 tu�"i. Chuẩn Cambridge, giáo viên bản ngữ, cam kết �ầu ra rõ ràng.',
    imageUrl: '/brand/hero-classroom.png',
    buttonText: 'ĐĒng ký tư vấn mi�&n phí',
    buttonLink: '#lead-form',
    button2Text: 'Khám phá chương trình',
    button2Link: '#programs',
  },
  {
    id: 'sec-2', pageId: 'page-home', type: 'Stats', order: 2, visible: false, createdAt: now, updatedAt: now,
    title: 'METTA Academy trong những con s�',
    extraData: JSON.stringify([
      { number: '5.000+', label: 'Học viên t�t nghi�!p' },
      { number: '50+', label: 'Giáo viên chuyên môn' },
      { number: '10+', label: 'NĒm kinh nghi�!m' },
      { number: '95%', label: 'Phụ huynh hài lòng' },
    ]),
  },
  {
    id: 'sec-3', pageId: 'page-home', type: 'Courses', order: 3, visible: true, anchorId: 'programs', createdAt: now, updatedAt: now,
    title: 'Chương trình �ào tạo',
    subtitle: 'L�" trình cá nhân hóa cho từng ��" tu�"i',
    description: 'Ba chương trình trọng tâm thiết kế theo chuẩn Cambridge & Oxford, phù hợp từng giai �oạn phát triỒn của trẻ.',
  },
  {
    id: 'sec-4', pageId: 'page-home', type: 'Benefits', order: 4, visible: true, anchorId: 'about', createdAt: now, updatedAt: now,
    title: 'Tại sao ba mẹ chọn METTA Academy?',
    subtitle: 'Hơn 10 nĒm kiến tạo tương lai thế h�! trẻ',
    description: 'Chúng tôi không ch�0 dạy tiếng Anh � chúng tôi xây dựng nền tảng tư duy, sự tự tin và kỹ nĒng lãnh �ạo cho thế h�! kế thừa.',
    extraData: JSON.stringify([
      { icon: 'school', color: 'text-cta-orange', title: 'Giáo trình chuẩn qu�c tế', desc: 'Chương trình Oxford & Cambridge, �ược thiết kế theo CEFR, tích hợp học li�!u từ National Geographic Learning.' },
      { icon: 'groups', color: 'text-accent-cyan', title: 'Giáo viên bản ngữ & CELTA/TESOL', desc: '100% giáo viên có chứng ch�0 qu�c tế, tận tâm và có kinh nghi�!m dạy trẻ em �x nhiều qu�c gia.' },
      { icon: 'rocket_launch', color: 'text-cta-orange', title: 'L�:p học sĩ s� nhỏ', desc: 'T�i �a 12�15 học viên/l�:p �Ồ giáo viên có thỒ chú ý và cá nhân hóa từng học sinh.' },
      { icon: 'psychology', color: 'text-accent-cyan', title: 'Phương pháp tư duy phản bi�!n', desc: 'Học sinh �ược khuyến khích �ặt câu hỏi, phân tích và thuyết trình ý kiến bằng tiếng Anh.' },
      { icon: 'dashboard', color: 'text-cta-orange', title: 'Cơ s�x hi�!n �ại 5 sao', desc: 'Smart classroom, phòng lab STEM, thư vi�!n học li�!u và không gian học sáng tạo tiêu chuẩn qu�c tế.' },
      { icon: 'monitoring', color: 'text-accent-cyan', title: 'Báo cáo tiến ��" ��9nh kỳ', desc: 'H�! th�ng theo dõi học tập thông minh, phụ huynh nhận báo cáo và phản h�i sau m�i tháng học.' },
    ]),
  },
  {
    id: 'sec-5', pageId: 'page-home', type: 'Testimonials', order: 5, visible: true, createdAt: now, updatedAt: now,
    title: 'Phụ huynh & học viên nói gì về METTA?',
    subtitle: 'Hơn 5.000 gia �ình �ã tin tư�xng lựa chọn',
    extraData: JSON.stringify([
      { name: 'Ch�9 Nguy�&n Thanh Hà', role: 'Phụ huynh bé Bảo An � L�:p Kiddies', quote: 'Sau 6 tháng học tại METTA, con tôi �ã tự tin giao tiếp v�:i người nư�:c ngoài. Phương pháp giảng dạy rất phù hợp v�:i ��" tu�"i của con và giáo viên cực kỳ tận tâm.', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&auto=format&fit=crop' },
      { name: 'Anh Trần VĒn Minh', role: 'Phụ huynh bé Gia Bảo � L�:p Young Learners', quote: 'METTA không ch�0 dạy tiếng Anh mà còn giúp con học �ược kỹ nĒng tư duy và thuyết trình. Con tiến b�" rõ r�!t ch�0 sau 3 tháng, ngữ pháp và phát âm �ều t�t hơn hẳn.', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop' },
      { name: 'Ch�9 Lê Thu Hương', role: 'Phụ huynh bé Khánh Vy � L�:p Phonics', quote: 'Con tôi từ không biết gì về phonics, giờ �ã tự �ọc �ược sách tiếng Anh! Giáo viên METTA dạy rất kiên nhẫn và có phương pháp riêng giúp trẻ tiếp thu nhanh.', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&q=80&auto=format&fit=crop' },
    ]),
  },
  {
    id: 'sec-6', pageId: 'page-home', type: 'Teachers', order: 6, visible: true, anchorId: 'teachers', createdAt: now, updatedAt: now,
    title: 'Đ�"i ngũ giáo viên xuất sắc',
    subtitle: '100% giáo viên bản ngữ & chuyên gia TESOL/CELTA',
    description: 'M�i giáo viên tại METTA �ều �ược tuyỒn chọn kỹ lưỡng về chuyên môn, kinh nghi�!m và khả nĒng truyền cảm hứng cho trẻ em.',
    extraData: JSON.stringify([
      { name: 'Ms. Sarah Johnson', role: 'Head of Academics', exp: 'CELTA | 8 nĒm kinh nghi�!m', nationality: '�x!��x!� British', photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&q=80&auto=format&fit=crop' },
      { name: 'Mr. David Kim', role: 'Senior Teacher', exp: 'TESOL | 6 nĒm kinh nghi�!m', nationality: '�x!��x!� Australian', photo: 'https://images.unsplash.com/photo-1566492031773-4f4e44671857?w=400&q=80&auto=format&fit=crop' },
      { name: 'Ms. Linh Nguy�&n', role: 'Academic Coordinator', exp: 'M.Ed | 7 nĒm kinh nghi�!m', nationality: '�x!��x!� Vietnamese', photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&q=80&auto=format&fit=crop' },
      { name: 'Mr. James Brown', role: 'Phonics Specialist', exp: 'DELTA | 5 nĒm kinh nghi�!m', nationality: '�x!��x!� American', photo: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&q=80&auto=format&fit=crop' },
    ]),
  },
  {
    id: 'sec-7', pageId: 'page-home', type: 'News', order: 7, visible: true, createdAt: now, updatedAt: now,
    title: 'Tin tức & Sự ki�!n',
    subtitle: 'Cập nhật m�:i nhất từ METTA Academy',
    extraData: JSON.stringify([
      { title: 'Khai giảng l�:p IELTS Foundation tháng 6/2026', date: '01/06/2026', category: 'Tin tức', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80&auto=format&fit=crop', excerpt: 'METTA Academy chính thức m�x �Ēng ký l�:p IELTS Foundation dành cho học sinh THCS và THPT, khai giảng ngày 01/06/2026.' },
      { title: 'Workshop tiếng Anh hè 2026 � Trải nghi�!m thú v�9 cho bé', date: '20/05/2026', category: 'Sự ki�!n', image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80&auto=format&fit=crop', excerpt: 'Chương trình hè �ặc bi�!t v�:i các hoạt ��"ng sáng tạo, STEM và English Camp dành cho trẻ 6�15 tu�"i trong hè 2026.' },
      { title: 'METTA tham dự H�"i thảo Giáo dục Qu�c tế SEAMEO 2026', date: '10/05/2026', category: 'Thành tích', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80&auto=format&fit=crop', excerpt: 'Đại di�!n METTA Academy trình bày tham luận về ứng dụng AI trong giáo dục ngôn ngữ tại h�"i thảo SEAMEO 2026.' },
    ]),
  },
  {
    id: 'sec-facilities', pageId: 'page-home', type: 'Facilities', order: 8, visible: true, anchorId: 'facilities', createdAt: now, updatedAt: now,
    title: 'Cơ s�x vật chất tại METTA Academy',
    subtitle: 'Không gian học tập',
    description: 'Không gian học tập hi�!n �ại, ch�0n chu và truyền cảm hứng, giúp học viên thoải mái phát triỒn m�i ngày.',
    extraData: JSON.stringify([
      { src: '/images/facilities/facility-1.jpg', alt: 'Phòng học hi�!n �ại tại METTA Academy', title: '' },
      { src: '/images/facilities/facility-2.jpg', alt: 'Toà nhà METTA Academy', title: '' },
      { src: '/images/facilities/facility-3.jpg', alt: 'Khu vực l�& tân METTA Academy', title: '' },
    ]),
  },
  {
    id: 'sec-9', pageId: 'page-home', type: 'Lead Form', order: 9, visible: true, createdAt: now, updatedAt: now,
    title: 'ĐĒng ký tư vấn mi�&n phí',
    formId: 'consultation-form',
  },
  {
    id: 'sec-8', pageId: 'page-home', type: 'CTA', order: 10, visible: false, createdAt: now, updatedAt: now,
    title: 'Sẵn sàng �Ồ con tỏa sáng cùng METTA Academy?',
    subtitle: 'ĐĒng ký ngay �Ồ nhận bài kiỒm tra nĒng lực MI�N PHÍ và l�" trình học tập chuyên bi�!t cho bé.',
    buttonText: 'Đ�NG KÝ TƯ VẤN NGAY',
    buttonLink: '#lead-form',
    button2Text: 'HOTLINE: 1900 1234',
    button2Link: 'tel:19001234',
  },
  /* ���� Phonics landing page ���� */
  { id: 'sec-p1', pageId: 'page-phonics', type: 'Hero', title: 'Phonics tại METTA', subtitle: 'Nền tảng phát âm chuẩn bản xứ', description: 'Giúp học sinh nhận di�!n âm, ghép âm, �ọc và phát âm tiếng Anh tự tin như người bản ngữ.', imageUrl: '/brand/hero-classroom.png', buttonText: 'ĐĒng ký học thử', buttonLink: '#lead-form', order: 1, visible: true, createdAt: now, updatedAt: now },
  { id: 'sec-p2', pageId: 'page-phonics', type: 'Lead Form', title: 'Nhận tư vấn khóa Phonics', formId: 'phonics-form', order: 2, visible: true, createdAt: now, updatedAt: now },
  { id: 'sec-metta-plus-1', pageId: 'page-metta-plus', type: 'Metta+ Landing', title: 'Landing Metta+ Pass', imageUrl: '/brand/hero-classroom.png', formId: 'metta-plus-pass', extraData: '', order: 1, visible: true, createdAt: now, updatedAt: now },
];

export const mediaItems: MediaItem[] = [
  { id: 'media-1', name: 'METTA Logo', fileUrl: '/brand/logo.png', fileType: 'image/jpeg', fileSize: 80499, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-2', name: 'Brand Banner', fileUrl: '/brand/brand-banner.jpg', fileType: 'image/jpeg', fileSize: 189260, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-3', name: 'Workshop Kids', fileUrl: '/brand/workshop-kids.jpg', fileType: 'image/jpeg', fileSize: 142258, uploadedBy: 'Admin', createdAt: now },
  { id: 'media-4', name: 'Hero Classroom', fileUrl: '/brand/hero-classroom.png', fileType: 'image/png', fileSize: 1984372, uploadedBy: 'Admin', createdAt: now }
];

export const users: AdminUser[] = [
  { id: 'u1', fullName: 'METTA Admin', email: 'admin@mettaacademy.vn', role: 'admin', active: true, createdAt: now },
  { id: 'u2', fullName: 'Linh', email: 'linh@mettaacademy.vn', role: 'sales', active: true, createdAt: now },
  { id: 'u3', fullName: 'Chi', email: 'chi@mettaacademy.vn', role: 'sales', active: true, createdAt: now }
];

export const courses: Course[] = [
  { id: 'course-mg', name: 'METTA Kiddies', code: 'MAU-GIAO', description: 'Chương trình tiếng Anh nền tảng dành cho học sinh lứa tu�"i mẫu giáo, tập trung vào nghe, nói, phát âm và phản xạ ngôn ngữ tự nhiên.', ageRange: '4-6 tu�"i', level: 'Beginner', totalSessions: 48, sessionDuration: '75 phút', tuitionFee: 7200000, curriculum: 'Songs, stories, TPR, phonemic awareness', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-ph', name: 'METTA on Phonics', code: 'PHONICS', description: 'Chương trình phonics cho trẻ 5-7 tu�"i, giúp học sinh giải mã âm chữ, �ọc ��"c lập và phát âm chuẩn bản xứ.', ageRange: '5-7 tu�"i', level: 'Early Primary', totalSessions: 60, sessionDuration: '90 phút', tuitionFee: 5600000, curriculum: 'Oxford Phonics World, blending, segmenting, songs and chants', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-tn', name: 'METTA Young Learner', code: 'YOUNG-LEARNER', description: 'Chương trình tiỒu học 6-12 tu�"i, phát triỒn tiếng Anh, tư duy, kỹ nĒng thế kỷ 21 và l�" trình Cambridge Starters - Movers - Flyers.', ageRange: '6-12 tu�"i', level: 'Primary', totalSessions: 72, sessionDuration: '90 phút', tuitionFee: 9000000, curriculum: '3E, STEAM, Discovery Education, project-based learning', status: 'Đang mở', createdAt: now, updatedAt: now },
  { id: 'course-ij', name: 'IELTS Junior', code: 'IELTS-JUNIOR', description: 'Chương trình THCS 11-15 tu�"i, xây nền IELTS học thuật từ s�:m v�:i mục tiêu 1.5 �ến 3.0+ và cam kết �ầu ra.', ageRange: '11-15 tu�"i', level: 'Secondary', totalSessions: 72, sessionDuration: '90 phút', tuitionFee: 9800000, curriculum: 'AI-powered practice, CLIL, IELTS skills, Knowledge Chunking', status: 'Đang mở', createdAt: now, updatedAt: now }
];

export const classes: ClassItem[] = [
  { id: 'class-mg-01', name: 'MG-01', code: 'MG-01', courseId: 'course-mg', teacherId: 'Teacher An', assistantId: 'Ms. Linh', startDate: '2026-06-03', expectedEndDate: '2026-09-30', scheduleText: 'Thứ 3, Thứ 5 - 17:30', room: 'Room A1', maxStudents: 12, currentStudentCount: 4, status: 'Sắp khai giảng', notes: 'L�:p mẫu giáo m�:i', createdAt: now, updatedAt: now },
  { id: 'class-mg-02', name: 'MG-02', code: 'MG-02', courseId: 'course-mg', teacherId: 'Teacher An', startDate: '2026-05-10', expectedEndDate: '2026-08-30', scheduleText: 'Thứ 7, Chủ nhật - 09:00', room: 'Room A2', maxStudents: 12, currentStudentCount: 3, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-tn-01', name: 'TN-01', code: 'TN-01', courseId: 'course-tn', teacherId: 'Teacher Bình', startDate: '2026-05-15', expectedEndDate: '2026-10-15', scheduleText: 'Thứ 2, Thứ 4 - 18:00', room: 'Room B1', maxStudents: 16, currentStudentCount: 5, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-tn-02', name: 'TN-02', code: 'TN-02', courseId: 'course-tn', teacherId: 'Teacher Bình', startDate: '2026-06-08', expectedEndDate: '2026-11-08', scheduleText: 'Thứ 6 - 18:00, Chủ nhật - 15:00', room: 'Room B2', maxStudents: 16, currentStudentCount: 2, status: 'Sắp khai giảng', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-ph-01', name: 'PHONICS-01', code: 'PHONICS-01', courseId: 'course-ph', teacherId: 'Teacher Chi', startDate: '2026-05-12', expectedEndDate: '2026-08-12', scheduleText: 'Thứ 3, Thứ 5 - 18:30', room: 'Room C1', maxStudents: 14, currentStudentCount: 4, status: 'Đang học', notes: '', createdAt: now, updatedAt: now },
  { id: 'class-ph-02', name: 'PHONICS-02', code: 'PHONICS-02', courseId: 'course-ph', teacherId: 'Teacher Chi', startDate: '2026-06-20', expectedEndDate: '2026-09-20', scheduleText: 'Thứ 7 - 14:00', room: 'Room C2', maxStudents: 14, currentStudentCount: 2, status: 'Sắp khai giảng', notes: '', createdAt: now, updatedAt: now }
];

const studentNames = ['Nguy�&n Minh Anh', 'Trần Gia Bảo', 'Lê Khánh Linh', 'Phạm Hà My', 'Đặng Quang Minh', 'Võ An Nhiên', 'Bùi Nhật Nam', 'Hoàng Tu�! Lâm', 'Đ� Hoàng Phúc', 'Mai Ngọc Hân', 'Phan Đức Anh', 'Tạ Bảo Ngọc', 'Lý Minh Khang', 'Đinh Gia Huy', 'Cao Phương Thảo', 'Ngô Hải Nam', 'Tr�9nh Mai Chi', 'Vũ Quỳnh Anh', 'H� Tuấn Ki�!t', 'Dương Bảo Châu'];
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
    school: i % 2 ? 'TiỒu học Nguy�&n Du' : 'Mầm non Hoa Sen',
    currentClass: i % 3 === 0 ? 'Mẫu giáo l�:n' : `L�:p ${1 + (i % 5)}`,
    parentName: `Phụ huynh ${name}`,
    parentPhone: `08${String(90000000 + i * 23456).slice(0, 8)}`,
    parentEmail: `parent${i + 1}@example.com`,
    sourceLeadId: i < 5 ? `lead-${i + 1}` : undefined,
    interestedCourse,
    currentCourseId: interestedCourse === 'METTA Kiddies' ? 'course-mg' : interestedCourse === 'METTA on Phonics' ? 'course-ph' : interestedCourse === 'METTA Young Learner' ? 'course-tn' : 'course-ij',
    currentClassId,
    currentLevel: i % 2 ? 'Starter' : 'Beginner',
    targetGoal: 'Tự tin nghe nói và phát âm chuẩn',
    status: ['Đang học', 'Đã �Ēng ký', 'Bảo lưu', 'Hoàn thành khóa', 'Tạm ngh�0'][i % 5] as Student['status'],
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
    title: `Bu�"i ${i + 1}: ${i === 0 ? 'Orientation' : 'Practice'}`,
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
  ['Ch�9 Hạnh Nguy�&n', 'Bé Bảo An'],
  ['Anh Minh Trần', 'Minh Khang'],
  ['Ch�9 Thu Hà', 'Gia Linh'],
  ['Anh Qu�c Bảo', 'Bảo Châu'],
  ['Ch�9 Mai Anh', 'Tu�! Lâm'],
  ['Ch�9 Ngọc Di�!p', 'Khánh An'],
  ['Anh Hải Nam', 'Nhật Minh'],
  ['Ch�9 Phương Thảo', 'Hoàng Phúc'],
  ['Anh Đức Huy', 'Quỳnh Anh'],
  ['Ch�9 Thanh Vân', 'Minh Quân'],
] as const;

const demoPriorityLeads: Lead[] = demoLeadNames.map(([parentName, studentName], index) => {
  const [source, priorityLevel] = demoLeadSources[index];
  const course = courseCycle[index % courseCycle.length];
  const statusCycle = ['Lead m?i', '?? li?n h?', 'Ch?a nghe m?y', '?? h?n t? v?n', '?? t? v?n/??t l?ch test', '?? test/H?c th?', DEAL_QUOTED_STATUS, DEAL_QUOTED_STATUS, WON_LEAD_STATUS, LOST_LEAD_STATUS] as Lead['status'][];
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
    school: index % 2 ? 'TiỒu học Nguy�&n Du' : 'Trường qu�c tế Vi�!t �ac',
    currentClass: index % 3 === 0 ? 'Mẫu giáo l�:n' : `L�:p ${1 + (index % 5)}`,
    interestedCourse: course,
    currentLevel: '',
    targetGoal: '',
    source,
    centerName: demoLeadCenters[index % demoLeadCenters.length],
    priorityLevel,
    status,
    assignedTo: index % 2 ? 'u3' : 'u2',
    assignedToName: index % 2 ? 'Chi' : 'Linh',
    followUpDate: `2026-06-${String(3 + (index % 8)).padStart(2, '0')}T${String(9 + (index % 7)).padStart(2, '0')}:30:00+07:00`,
    consultationDate: index % 3 === 0 ? `2026-06-${String(4 + index).padStart(2, '0')}T17:30:00+07:00` : '',
    ...(hasFinance ? {
      dealSize: DEFAULT_COURSE_DEAL_SIZE,
      dealCurrency: DEFAULT_DEAL_CURRENCY,
      discountPercent,
      dealPackage: `${course} demo package`,
      dealNote: isWon ? 'Demo lead �ã �Ēng ký học, expected revenue �ã chuyỒn thành revenue.' : 'Đã báo phí demo �Ồ kiỒm tra discount, expected revenue và warmth trên Kanban.',
      expectedRevenue,
      ...(isWon ? { revenue: expectedRevenue, revenueAt: now, wonAt: now } : {}),
      expectedCloseDate: `2026-06-${String(12 + index).padStart(2, '0')}`,
      ...(pendingOption ? {
        pendingReason: pendingOption.reason,
        pendingReasonNote: pendingOption.defaultNote,
        pendingWarmthPercent: pendingOption.warmthPercent,
      } : {}),
    } : {}),
    ...(status === LOST_LEAD_STATUS ? { lostReason: 'L�9ch học không phù hợp', lostNote: 'Demo lead mất vì l�9ch học chưa phù hợp �Ồ kiỒm tra c�"t và báo cáo.' } : {}),
    initialNote: `Demo lead ưu tiên P${priorityLevel} từ ${source}.`,
    createdAt: `2026-06-${String(1 + index).padStart(2, '0')}T0${8 + (index % 2)}:00:00+07:00`,
    updatedAt: now,
  };
});

const demoPriorityConsultationAppointments: Appointment[] = demoPriorityLeads
  .filter((lead) => lead.status === 'Đã hẹn tư vấn' && lead.consultationDate)
  .map((lead) => ({
    id: `ap-demo-priority-consultation-${lead.id}`,
    leadId: lead.id,
    title: `${lead.studentName || lead.fullName} - ${lead.phone}`,
    type: 'Tư vấn',
    startTime: lead.consultationDate!,
    endTime: addMinutes(lead.consultationDate!, 45),
    assignedTo: lead.assignedTo || '',
    assignedToName: lead.assignedToName || '',
    status: 'upcoming',
    notes: 'Demo appointment bắt bu�"c khi lead �x trạng thái Đã hẹn tư vấn.',
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  }));

export const leads: Lead[] = [];

export const leadActivities: LeadActivity[] = [];

const stageDemoConsultationAppointments: Appointment[] = stageDemoLeads
  .filter((lead) => lead.consultationDate || lead.followUpDate)
  .map((lead) => ({
    id: `ap-demo-stage-consultation-${lead.id}`,
    leadId: lead.id,
    title: `${lead.studentName || lead.fullName} - ${lead.phone}`,
    type: lead.status === 'Đã tư vấn/Đặt lịch test' || lead.status === 'Đã test/Học thử' ? 'Test đầu vào' : lead.consultationDate ? 'Tư vấn' : 'Gọi lại',
    startTime: lead.consultationDate || lead.followUpDate!,
    endTime: addMinutes(lead.consultationDate || lead.followUpDate!, 45),
    assignedTo: lead.assignedTo || '',
    assignedToName: lead.assignedToName || '',
    status: 'upcoming',
    notes: 'Demo appointment ��ng b�" từ lead �Ồ test Appointments và rule stage bắt bu�"c.',
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
  }));

export const appointments: Appointment[] = [];

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
