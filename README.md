# Minimalist Flow

Minimalist Flow là một ứng dụng quản lý công việc cá nhân theo phương pháp:

**Goal → Planning → Execution**

Ứng dụng tập trung vào việc biến mục tiêu dài hạn thành kế hoạch cụ thể, sau đó đưa các task vào lịch làm việc thực tế.

## ✨ Tính năng

### 📋 Task Management

- Tạo, chỉnh sửa và xóa task.
- Phân loại task theo **Eisenhower Matrix**:
  - Q1 — Urgent & Important
  - Q2 — Not Urgent & Important
  - Q3 — Urgent & Not Important
  - Q4 — Not Urgent & Not Important
- Thiết lập:
  - Estimate
  - Horizon
  - Status
  - Category
- Horizon hỗ trợ:
  - Day
  - Week
  - Month
  - Quarter
  - Year
- Sắp xếp task theo Horizon.
- Theo dõi trạng thái:
  - Goal
  - This Week
  - Today
  - Done
  - Dropped

### 🗂️ Task View

Task View cung cấp hai chế độ:

- **Matrix View** — quản lý task theo Eisenhower Matrix.
- **List View** — xem và chỉnh sửa task dưới dạng bảng.

List View cho phép chỉnh trực tiếp:

- Title
- Matrix
- Estimate
- Horizon
- Status
- Category
- Materials

### 📅 Board View

Board View tập trung vào việc lập kế hoạch cho tuần.

- Quản lý **Backlog trong tuần**.
- Quản lý **Today**.
- Kéo thả task để lên lịch.
- Theo dõi task đã hoàn thành.
- Theo dõi tổng thời gian đã schedule.
- Quản lý capacity.
- Task thuộc Horizon dài hạn như **Month / Quarter / Year** được xem là Goal và không tự động đưa vào lịch thực thi.

### 🎯 Focus Day

Focus Day chuyển kế hoạch trong ngày thành lịch làm việc thực tế.

- Hiển thị các task `Today`.
- Tạo **Free Time Blocks**.
- Kéo task vào từng block.
- Tự động tính thời lượng đã sử dụng.
- Cảnh báo khi block bị quá tải.
- Cho phép đưa task quá tải trở lại `This Week`.
- Đồng bộ với **Fixed Calendar**.

### 📌 Fixed Calendar

Fixed Calendar dùng để quản lý các lịch cố định được lên trước, ví dụ:

- School
- Class
- Meeting
- Training
- Appointment
- Các hoạt động có thời gian cố định.

Calendar hiển thị các fixed event theo ngày.

Các event trong Fixed Calendar được đồng bộ với **Focus Day**, giúp tạo các khoảng thời gian tương ứng để lên kế hoạch cho task.

### 📚 Material Gallery

Quản lý tài liệu liên quan đến task.

- Import tài liệu bằng URL.
- Đặt title cho tài liệu.
- Gắn material vào task.
- Xóa material.
- Hiển thị số lượng material trên task.

### 📊 Statistics

Theo dõi hoạt động và tiến độ công việc thông qua các thống kê của hệ thống.

### 💾 LocalStorage

Ứng dụng sử dụng **LocalStorage** để lưu dữ liệu cục bộ trên trình duyệt.

Các dữ liệu chính bao gồm:

- Tasks
- Materials
- Focus Blocks
- Fixed Calendar Events

Dữ liệu được tự động lưu sau khi có thay đổi và được khôi phục khi reload ứng dụng.

> **Lưu ý:** Dữ liệu hiện được lưu trên trình duyệt/local machine, chưa sử dụng database hoặc backend để đồng bộ giữa nhiều thiết bị.

---

## 🧠 Workflow

Minimalist Flow được thiết kế theo quy trình:

```text
GOAL
 │
 │ Year / Quarter / Month
 ▼
PLANNING
 │
 │ Week
 ▼
EXECUTION
 │
 │ Today
 ▼
FOCUS DAY
 │
 │ Free Time Blocks
 ▼
DO THE WORK
