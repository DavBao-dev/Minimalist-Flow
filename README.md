# Minimalist Flow

Minimalist Flow là một ứng dụng quản lý công việc cá nhân theo phương pháp Goal → Planning → Execution, được xây dựng bằng React.

## Tính năng

- Board View (Kanban)
- Timeline View
- Focus Day
- Task Management
- Material Gallery
  - Import tài liệu bằng URL
  - Đặt tiêu đề tài liệu
  - Xóa tài liệu
- Statistics
- Tự động lưu dữ liệu bằng LocalStorage

---

## Yêu cầu

- Node.js >= 18
- npm >= 9

Kiểm tra:

```bash
node -v
npm -v
```

---

## Cài đặt

Clone project:

```bash
git clone <repository-url>
```

Di chuyển vào thư mục:

```bash
cd Minimalist-Flow
```

Cài đặt dependencies:

```bash
npm install
```

hoặc

```bash
npm i
```

---

## Chạy ở môi trường local

```bash
npm run dev
```

Sau khi chạy thành công, mở trình duyệt:

```
http://localhost:5173
```

---

## Build Production

```bash
npm run build
```

Preview bản build:

```bash
npm run preview
```

---

## Cấu trúc chính

```
src/
│
├── App.jsx
├── main.jsx
├── components/
├── assets/
└── ...
```

---

## Lưu dữ liệu

Ứng dụng sử dụng **LocalStorage** để lưu:

- Tasks
- Materials
- Focus Blocks

Dữ liệu sẽ tự động được lưu sau mỗi lần chỉnh sửa và vẫn còn sau khi reload trình duyệt.

---

## Công nghệ sử dụng

- React
- Vite
- Tailwind CSS
- Lucide React

---

## License

Dự án được phát triển phục vụ mục đích học tập và quản lý công việc cá nhân.