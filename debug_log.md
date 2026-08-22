# Debug log: Minimalist Flow (Streamlit) — trang trắng sau đăng nhập

Repo: DavBao-dev/Minimalist-Flow (branch main)
App: minimalist-flow-developforcommunity.streamlit.app

## Bối cảnh
- App dùng Streamlit bidirectional component (`components.declare_component`)
  để nhúng một React app đã build sẵn (KHÔNG rebuild bằng npm/Vite — README
  ghi rõ file `static/index.html` là bundle final).
- Backend Python (`app.py` + `db.py`) dùng Turso (libSQL) khi có secrets
  `[database] url/auth_token`, fallback SQLite khi không có.
- Đăng nhập/đăng ký hoạt động, state có lưu được vào Turso, NHƯNG sau khi
  đăng nhập, khu vực component (giữa trang) hiện trắng — sidebar Streamlit
  (nút đăng xuất, tên user) vẫn hiện bình thường.

## Đã loại trừ (KHÔNG phải nguyên nhân)
1. Lỗi 404 `/api/v2/user/details` trong console — vô hại, thuộc hạ tầng
   Streamlit Community Cloud, không liên quan code của app.
2. File chưa được deploy — đã kiểm tra khớp 100% với bản trên GitHub.
3. Component không được nhúng / lỗi Python phía app.py — đã loại trừ:
   `<iframe class="stCustomComponentV1 ...">` tồn tại thật trong DOM,
   log Python sạch.

## Vòng 1 — Đã tìm và sửa: đè biến We/Ge/Ke
File `static/index.html` là kết quả GHÉP THỦ CÔNG 2 bundle JS độc lập
(vendor/React-DOM + app code) vào chung MỘT `<script type="module">`, nên
chúng chia sẻ chung 1 scope. Cả hai bundle minify riêng biệt nên chọn
trùng tên biến ngắn `We`, `Ge`, `Ke` (React internal scheduler vs. app
localStorage key / default state / date formatter).
**Đã fix**: đổi tên phía app thành `MFKEY/MFDEFAULT/MFFMT`. Verify bằng
`node --check` + Playwright headless (render ra ~43,000 ký tự trong
`#root`, không lỗi) → tưởng đã xong, push lên GitHub.

**Kết quả sau khi deploy bản này: VẪN TRẮNG** ở production.

## Vòng 2 (chat này) — Tìm thêm: đè HÀM xt/St/Ct/wt/Tt (nghiêm trọng hơn nhiều)
Nghi ngờ vòng 1 chưa quét hết, nên quét lại TOÀN BỘ file để tìm mọi tên
hàm top-level bị khai báo 2 lần (`function NAME(` xuất hiện >1 lần ở
cùng scope module, một lần trong phần React, một lần trong phần app).

Kết quả: ngoài We/Ge/Ke (đã fix), phát hiện **5 hàm nội bộ cốt lõi của
React-DOM cũng bị đè bởi component của app**, do cùng cơ chế ghép thủ
công 2 bundle vào chung 1 scope:

| Tên (minified) | Vai trò gốc trong React-DOM                          | Bị đè bởi (app code)                        |
|---|---|---|
| `xt` | dọn con trỏ fiber khi unmount DOM node | component `Capacity` (`{used, capacity}`) |
| `St` | tra fiber từ 1 DOM node (dùng khi xử lý event) | component chính chứa scheduler (`{tasks, setTasks, freeBlocks, ...}`) |
| `Ct` | lấy fiber/instance từ node (dùng khi xử lý event) | component "Stats" (`{tasks}`) |
| `wt` | lấy `stateNode` của fiber (dùng trong autofocus, xử lý event `focusin/focusout`...) | **component App gốc** (chứa toàn bộ state qua `useState`) |
| `Tt` | cache `hoistableStyles`/`hoistableScripts` cho `<style precedence>`, `<link>`, `<script>` | wrapper render App (`function Tt(){return jsx(wt,{})}`) |

Vì khai báo hàm (`function NAME(){}`) ở cùng scope thì **bản khai báo
sau đè bản trước** (hoisting), nên sau khi parse xong file, `xt/St/Ct/
wt/Tt` không còn là hàm nội bộ của React nữa — mọi chỗ React gọi
`Tt(container)`, `St(domNode)`, v.v. thực chất đang gọi nhầm sang
component của app. Đây là bug nặng hơn hẳn We/Ge/Ke vì đụng tới đường
xử lý event (click/focus/input) và cơ chế hoist style/script — những
thứ vòng 1 chưa chạm tới.

**Đã fix** (`streamlit_app_fixed_v2.zip`): đổi tên 5 hàm phía app thành
`MFCAP, MFSCHED, MFSTATS, MFAPP, MFROOT` — chỉ sửa đúng 2 vị trí mỗi tên
(khai báo + nơi dùng trong JSX), KHÔNG đụng vào bất kỳ chỗ nào React
dùng tên gốc. Verify:
- `node --check` → cú pháp hợp lệ.
- Quét lại toàn file: xác nhận các lần dùng gốc của React (4/7/7/6/7 lần
  cho `xt/St/Ct/wt/Tt`) không đổi; mỗi tên mới `MFCAP/MFSCHED/MFSTATS/
  MFAPP/MFROOT` xuất hiện đúng 2 lần (khai báo + dùng).
- Playwright headless, giả lập postMessage `streamlit:render` y hệt
  Streamlit gửi → render ra 43,185 ký tự trong `#root`, **0 page error**.

### ⚠️ Lưu ý quan trọng — vì sao vòng 2 CÓ THỂ chưa phải nguyên nhân của
### trang trắng hiện tại
Bài test Playwright headless ở vòng 1 (chỉ fix We/Ge/Ke) **cũng đã ra
kết quả y hệt** (~43,000 ký tự, 0 lỗi) — nhưng production vẫn trắng sau
đó. Nghĩa là bài test headless này KHÔNG đủ nhạy để phát hiện bug loại
xt/St/Ct/wt/Tt, vì:
- 4/5 hàm (`xt/St/Ct/wt`) chỉ được React gọi khi **xử lý sự kiện DOM
  thật** (click, focus, input...) — không xảy ra trong lần render tĩnh
  ban đầu mà Playwright test mô phỏng (không có tương tác chuột/bàn
  phím).
- `Tt` chỉ được gọi khi có phần tử dùng **resource API có `precedence`**
  (`<link precedence>`, `<style precedence>`, `<script async precedence>`)
  — nội dung hiện tại chỉ có `<style>` thường (không có `precedence`),
  nên nhánh gọi `Tt()` của React có thể chưa từng chạy tới trong lần
  render đầu.

→ Bug xt/St/Ct/wt/Tt là **có thật và cần fix** (đè hẳn 5 hàm lõi của
React-DOM là điều không thể chấp nhận trong bất kỳ bundle nào), nhưng
**chưa chắc là nguyên nhân của trang trắng đang thấy** — vì trang trắng
xảy ra ngay từ lần render đầu tiên (không cần tương tác), còn bug này
chủ yếu ảnh hưởng tới các đường xử lý sự kiện xảy ra SAU khi đã render.

## Hiện trạng / vấn đề còn tồn tại
Nghi vấn chính vẫn là **`streamlit:render` message chưa từng tới được
iframe** trong môi trường production thật:
- Thẻ iframe thật trên trang có `height="0"` — đúng như giá trị khởi
  tạo mặc định, CHƯA từng được cập nhật bởi dòng `post(HEIGHT,{height:
  1000})` trong code. Dòng này chỉ chạy **bên trong** listener của
  message `streamlit:render` — nếu message đó chưa từng đến, toàn bộ
  logic sau `post(READY,...)` (kể cả việc mount React) chưa từng chạy,
  và điều này giải thích trắng trang mà KHÔNG cần bug xt/St/Ct/wt/Tt.
- `src` đầy đủ của iframe (đã lấy được từ DOM):
  `https://minimalist-flow-developforcommunity.streamlit.app/~/+/component/app.minimalist_flow/index.html?streamlitUrl=https%3A%2F%2Fminimalist-flow-developforcommunity.streamlit.app%2F~%2F%2B%2F`
- KHÔNG thể fetch URL này từ môi trường debug hiện tại (bị chặn bởi
  robots.txt của Streamlit Cloud) → chưa xác minh được liệu:
  (a) parent Streamlit Cloud có thực sự gửi `streamlit:render` xuống
      không, hay
  (b) script phía component gửi `streamlit:componentReady` nhưng theo
      format/timing mà parent không nhận diện được, hay
  (c) còn lỗi JS khác chặn code chạy tới đoạn `post(READY,...)`.

## Việc cần làm tiếp (ưu tiên theo thứ tự)
1. **Redeploy `streamlit_app_fixed_v2.zip`** (đã fix cả We/Ge/Ke lẫn
   xt/St/Ct/wt/Tt) — cần thiết dù chưa chắc đủ, vì đây vẫn là bug thật.
2. Mở THẲNG url `src` của iframe (liệt kê ở trên) trong tab trình duyệt
   MỚI (không phải qua F12 > Elements) — đây là bước then chốt còn
   thiếu từ vòng 1, dùng để xem:
   - Ctrl+U / view-source có thấy `MFROOT` (tên hàm mới) không → xác
     nhận Streamlit đang serve đúng bản mới, không phải cache cũ.
   - Console của tab đó (console THẬT của file JS, không lẫn noise của
     trang Streamlit ngoài) có lỗi gì không, và height của `#root` /
     `document.body` sau vài giây có > 0 không.
   - Trong tab Network của DevTools ở URL đó, xem tab này (chạy độc
     lập, `window.parent` là chính cửa sổ hiện tại) — postMessage
     `streamlit:componentReady` gửi đi `window.parent.postMessage(...,
     '*')` nhưng vì mở trực tiếp (không nằm trong iframe), `window.
     parent === window`, nên chính script sẽ tự nhận lại message
     `componentReady` của mình chứ KHÔNG nhận được `streamlit:render`
     nào (vì không có Streamlit host thật ở đó) → PHẢI nhớ: mở thẳng
     src như này sẽ luôn trắng do thiếu người gửi RENDER, đây là bình
     thường, mục đích chỉ là xem console có lỗi JS runtime nào không
     TRƯỚC khi message listener kịp chạy.
3. Nếu bước 2 sạch lỗi, quay lại xem trang Streamlit thật (đã đăng
   nhập), mở DevTools ngay từ đầu (trước khi trang load xong) và lọc
   Network theo "postMessage" hoặc đặt breakpoint trên
   `window.postMessage`/`addEventListener('message')` để xem message
   `streamlit:render` có thực sự được parent gửi xuống iframe con hay
   không, và nếu có, `event.origin`/`event.source` là gì.
4. Nếu xác nhận `streamlit:render` không bao giờ tới: khả năng cao do
   cách `components.declare_component(..., path=...)` phía `app.py`
   khai báo (ví dụ thiếu tham số, dùng sai `key`, hoặc gọi component
   trước khi `st.session_state` cần thiết đã có) khiến Streamlit
   backend không hoàn tất handshake với đúng iframe. Xem lại đoạn code
   Python gọi component này trong `app.py`.
5. Nếu source gốc (trước khi build) của React app còn giữ được, nên
   rebuild lại bằng Vite/esbuild xuất ra 2 file `<script type="module"
   src="...">` riêng biệt (mặc định của Vite) thay vì gộp thủ công vào
   1 thẻ — để loại bỏ TOÀN BỘ lớp bug đè biến/hàm này một lần và mãi
   mãi, thay vì phải rà từng cặp tên một như 2 vòng vừa rồi.

## File đính kèm quan trọng
- `streamlit_app_fixed_v2.zip` — bản vá mới nhất (We/Ge/Ke + xt/St/Ct/
  wt/Tt), đã verify bằng `node --check` và Playwright headless.
- Repo GitHub: DavBao-dev/Minimalist-Flow, thư mục `streamlit_app/static/`
  chứa `index.html` và `minimalist_flow.html` (2 file giống hệt nhau).

## Vòng 3 — Bằng chứng quyết định + fix triệt để (chat này)

### Bằng chứng mới từ ảnh chụp production
Người dùng đã làm đúng bước 2 còn thiếu ở cuối vòng 2: mở THẲNG `src` của
iframe trong tab mới, rồi tự tay chạy trong console:
```js
window.postMessage({isStreamlitMessage: true, type: 'streamlit:render',
  args: {username: 'test', initial_state: null}}, '*');
```
→ **Toàn bộ UI (Day Excution, Deep Work, Meetings buffer, các task...) hiện
ra đầy đủ, đúng, không lỗi.** Điều này xác nhận dứt điểm:
1. Bundle JS đã fix đúng ở vòng 1 + vòng 2 (đã re-scan lại toàn bộ file lần
   nữa bằng scanner tự viết theo dõi độ sâu ngoặc `{}` — không còn tên hàm
   top-level nào bị đè thêm).
2. `React-DOM` + component chính hoạt động hoàn hảo MỘT KHI nhận được đúng
   message `streamlit:render`.
3. Vậy nguyên nhân trang trắng KHÔNG còn nằm ở phía JS bundle nữa — nó nằm
   ở chỗ **Streamlit host (parent) không bao giờ gửi `streamlit:render`
   xuống iframe này trong môi trường production thật**, đúng như nghi vấn
   cuối vòng 2.

Các lỗi khác thấy trong console ảnh chụp (`Unchecked runtime.lastError:
Could not establish connection...`, và loạt `SyntaxError: Unexpected
identifier 'pasting'`) là nhiễu không liên quan: lỗi đầu là noise từ
extension của Chrome (không phải code của app), lỗi sau là do paste
nhiều lệnh liên tiếp vào console dính chữ "allow pasting" của Chrome —
không phải bug thật.

### Nguyên nhân gốc rễ nhiều khả năng nhất
Trình tự cũ: script đăng ký `message` listener rồi gọi `post(READY,...)`
**đúng một lần duy nhất**. Đây là điểm yếu cổ điển của việc tự cài đặt lại
Streamlit Component protocol bằng tay (thay vì dùng gói npm
`streamlit-component-lib`): nếu vì bất kỳ lý do gì (WebSocket/registry
phía host chưa init xong, độ trễ mạng, cache CDN...) mà listener phía
Streamlit host CHƯA sẵn sàng đúng thời điểm `componentReady` đầu tiên bay
tới, thì message đó bị bỏ lỡ vĩnh viễn — vì host chỉ gửi `streamlit:render`
để phản hồi cho `componentReady`, và code cũ không bao giờ gửi lại lần 2.

### Fix đã áp dụng (bản đính kèm trong chat này)
Trong `static/index.html` (và đồng bộ `static/minimalist_flow.html`), khối
protocol ở cuối file được viết lại theo 3 lớp phòng thủ:
1. **Resend `componentReady`**: gửi lại `streamlit:componentReady` mỗi
   500ms, tối đa 12 lần (~6s), dừng ngay khi đã nhận được `streamlit:render`
   thật. Vô hại nếu host đã nhận lần đầu.
2. **Fallback sau 6s**: nếu vẫn không có `streamlit:render` nào tới, tự
   mount UI bằng dữ liệu đang có trong `localStorage` (hoặc state demo mặc
   định của bundle nếu localStorage trống) — trang KHÔNG BAO GIỜ trắng
   vĩnh viễn nữa, kể cả khi handshake với Streamlit host thất bại hoàn
   toàn. Có `console.warn` rõ ràng khi rơi vào nhánh này để dễ chẩn đoán
   tiếp trên production thật.
3. **Không mất dữ liệu nếu render thật đến muộn**: nếu sau khi đã fallback
   mà `streamlit:render` thật (mang state đã lưu trong DB) mới đến, code
   sẽ remount lại đúng MỘT lần với state thật từ server (ưu tiên dữ liệu
   server hơn fallback). Các `streamlit:render` lặp lại sau đó (do
   Streamlit rerun bình thường, args không đổi) bị bỏ qua như cũ, để không
   xoá mất state người dùng đang thao tác dở trên UI.
4. Thêm `console.info('[MinimalistFlow] ...')` ở từng bước handshake
   (gửi READY, nhận RENDER, mount, fallback...) để lần sau debug trên
   production thật chỉ cần mở Console, không cần đặt breakpoint thủ công
   như bước 3 còn tồn đọng ở vòng 2.
5. Bonus: thêm `ResizeObserver` để tự báo `streamlit:setFrameHeight` đúng
   theo chiều cao thật của nội dung, thay vì hardcode `height:1000` cố
   định như cũ (tránh bị cắt/thừa khoảng trắng khi nội dung dài/ngắn hơn
   1000px).

### Verify đã làm (offline, không có mạng để test app thật trên
Streamlit Cloud)
- `node --check` trên JS đã tách ra từ `index.html`: cú pháp hợp lệ.
- Playwright headless, 3 kịch bản:
  a. Gửi `streamlit:render` ngay lập tức (giả lập handshake bình thường)
     → render ra 43,185 ký tự trong `#root`, 0 lỗi (y hệt kết quả cũ,
     KHÔNG bị regressions).
  b. **Không gửi `streamlit:render` bao giờ** (giả lập đúng bug đang gặp)
     → tại t=1s vẫn trắng (`#root` rỗng, đúng hành vi cũ), nhưng đến t≈6s
     tự động fallback và render ra đầy đủ 43,185 ký tự, 0 lỗi.
  c. Không gửi gì tới quá 6s (fallback kích hoạt), sau đó mới gửi
     `streamlit:render` thật với `initial_state` hợp lệ khác dữ liệu demo
     → app tự remount đúng 1 lần sang state thật (12,354 ký tự, khác với
     43,185 ký tự của fallback, xác nhận đã áp dụng đúng state mới); gửi
     thêm một `streamlit:render` trùng lặp ngay sau đó → không remount
     lại lần nữa (giữ nguyên 12,354 ký tự, không crash) — xác nhận không
     có vòng lặp mount vô hạn hay mất dữ liệu.
- File `static/index.html` và `static/minimalist_flow.html` đã đồng bộ lại
  (giống hệt nhau, `md5sum` khớp) sau khi vá.

### Việc CÓ THỂ vẫn cần làm trên production thật (không kiểm tra được từ
môi trường offline này)
Fix ở vòng 3 làm cho trang **không còn trắng vĩnh viễn** trong mọi trường
hợp, kể cả khi handshake Streamlit thật sự bị hỏng — nhưng nếu handshake
vẫn hỏng, người dùng sẽ luôn thấy state demo/localStorage cache trong ~6
giây đầu thay vì state thật lưu trên Turso ngay lập tức (rồi mới nhảy
sang state thật khi/nếu `streamlit:render` đến muộn). Nếu sau khi deploy
bản vá này mà Console vẫn thấy dòng cảnh báo
`streamlit:render was not received within 6s`, nghĩa là handshake với
Streamlit host thật sự chưa bao giờ thành công, và cần điều tra tiếp theo
đúng hướng bước 3/4 cũ của vòng 2 (xem `event.origin`/`event.source` của
message thật trên trang Streamlit đã đăng nhập, và rà lại
`components.declare_component(...)` trong `app.py`).
