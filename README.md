# 🏢 ระบบพนักงานร้านค้า - LINE LIFF Employee System

ระบบจัดการพนักงานที่ทำงานผ่าน LINE Official Account และ LIFF (LINE Front-end Framework) สำหรับร้านค้าขนาดเล็กถึงกลาง

## ✨ คุณสมบัติหลัก

- 🕐 **เช็คอิน/เช็คเอาท์** - พร้อมระบุตำแหน่งที่ตั้ง
- 📝 **แจ้งการลาหยุด** - ลาป่วย, ลาพักผ่อน, ลาธุระส่วนตัว
- 🎁 **ตรวจสอบสวัสดิการ** - เงินเดือน, วันลา, โบนัส
- 📊 **ประวัติการทำงาน** - ดูข้อมูลย้อนหลัง 30 วัน
- 📱 **ใช้งานผ่าน LINE** - สะดวก ไม่ต้องติดตั้งแอพเพิ่ม
- 🌐 **Responsive Design** - รองรับทุกอุปกรณ์

## 🛠️ เทคโนโลยีที่ใช้

### Backend
- **Node.js** + **Express.js** - API Server
- **MySQL** - ฐานข้อมูล
- **LINE Bot SDK** - เชื่อมต่อ LINE Official Account
- **Moment.js** - จัดการเวลา

### Frontend
- **HTML5** + **CSS3** + **JavaScript ES6+**
- **LINE LIFF SDK** - เชื่อมต่อกับ LINE
- **Responsive Design** - รองรับมือถือ

## 📋 ข้อกำหนดระบบ

- **Node.js** 16.0.0 หรือสูงกว่า
- **MySQL** 8.0 หรือสูงกว่า
- **LINE Developer Account**
- **SSL Certificate** (สำหรับ Production)

## 🚀 การติดตั้ง

### 1. Clone Repository

```bash
git clone https://github.com/your-username/employee-liff-system.git
cd employee-liff-system
```

### 2. ติดตั้ง Dependencies

```bash
npm install
```

### 3. ตั้งค่าฐานข้อมูล MySQL

```sql
CREATE DATABASE employee_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'employee_user'@'localhost' IDENTIFIED BY 'your_password';
GRANT ALL PRIVILEGES ON employee_system.* TO 'employee_user'@'localhost';
FLUSH PRIVILEGES;
```

### 4. ตั้งค่า Environment Variables

คัดลอกไฟล์ `.env.example` เป็น `.env`:

```bash
cp .env.example .env
```

แก้ไขไฟล์ `.env`:

```env
# Database
DB_HOST=localhost
DB_USER=employee_user
DB_PASSWORD=your_password
DB_NAME=employee_system

# LINE Configuration
LINE_CHANNEL_ACCESS_TOKEN=your_channel_access_token
LINE_CHANNEL_SECRET=your_channel_secret
LIFF_ID=your_liff_id
```

### 5. สร้างตารางฐานข้อมูล

```bash
npm run db:create
```

### 6. เพิ่มข้อมูลทดสอบ (ไม่บังคับ)

```bash
npm run db:seed
```

## 🔧 การตั้งค่า LINE Developer

### 1. สร้าง LINE Official Account

1. ไปที่ [LINE Official Account Manager](https://manager.line.biz/)
2. สร้างบัญชีใหม่
3. บันทึก Channel ID และ Channel Secret

### 2. สร้าง LINE Bot

1. ไปที่ [LINE Developers Console](https://developers.line.biz/)
2. สร้าง Provider ใหม่
3. สร้าง Channel ประเภท "Messaging API"
4. ตั้งค่า Webhook URL: `https://your-domain.com/webhook/line`
5. บันทึก Channel Access Token

### 3. สร้าง LIFF App

1. ในหน้า Channel เดียวกัน ไปที่แท็บ "LIFF"
2. คลิก "Add" เพื่อสร้าง LIFF App ใหม่
3. กำหนด:
   - **LIFF app name**: Employee System
   - **Size**: Full
   - **Endpoint URL**: `https://your-domain.com`
   - **Scope**: `profile`, `openid`
4. บันทึก LIFF ID

### 4. ตั้งค่า Rich Menu (ไม่บังคับ)

สร้าง Rich Menu สำหรับง่ายต่อการใช้งาน:

```json
{
  "size": {
    "width": 2500,
    "height": 1686
  },
  "selected": false,
  "name": "Employee Menu",
  "chatBarText": "เมนู",
  "areas": [
    {
      "bounds": {
        "x": 0,
        "y": 0,
        "width": 1250,
        "height": 843
      },
      "action": {
        "type": "uri",
        "uri": "https://liff.line.me/your_liff_id"
      }
    },
    {
      "bounds": {
        "x": 1250,
        "y": 0,
        "width": 1250,
        "height": 843
      },
      "action": {
        "type": "text",
        "text": "สถานะ"
      }
    }
  ]
}
```

## 🏃‍♂️ การรันระบบ

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

ระบบจะทำงานที่ `http://localhost:3000`

