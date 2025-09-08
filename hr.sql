-- --------------------------------------------------------
-- Host:                         localhost
-- Server version:               10.4.32-MariaDB - mariadb.org binary distribution
-- Server OS:                    Win64
-- HeidiSQL Version:             12.8.0.6908
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for employee_system
CREATE DATABASE IF NOT EXISTS `employee_system` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;
USE `employee_system`;

-- Dumping structure for table employee_system.attendance
CREATE TABLE IF NOT EXISTS `attendance` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL COMMENT 'รหัสพนักงาน',
  `date` date NOT NULL COMMENT 'วันที่',
  `check_in_time` time DEFAULT NULL COMMENT 'เวลาเข้างาน',
  `check_out_time` time DEFAULT NULL COMMENT 'เวลาออกงาน',
  `check_in_location` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'ตำแหน่งที่เข้างาน' CHECK (json_valid(`check_in_location`)),
  `check_out_location` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'ตำแหน่งที่ออกงาน' CHECK (json_valid(`check_out_location`)),
  `work_hours` decimal(4,2) DEFAULT 0.00 COMMENT 'ชั่วโมงทำงาน',
  `overtime_hours` decimal(4,2) DEFAULT 0.00 COMMENT 'ชั่วโมงล่วงเวลา',
  `break_start_time` time DEFAULT NULL COMMENT 'เวลาเริ่มพัก',
  `break_end_time` time DEFAULT NULL COMMENT 'เวลาสิ้นสุดพัก',
  `status` enum('present','late','absent','half_day','holiday') DEFAULT 'present' COMMENT 'สถานะการมาทำงาน',
  `notes` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `approved_by` int(11) DEFAULT NULL COMMENT 'ผู้อนุมัติ',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_date` (`employee_id`,`date`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_date` (`date`),
  KEY `idx_status` (`status`),
  KEY `idx_attendance_employee_date` (`employee_id`,`date`),
  CONSTRAINT `attendance_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `attendance_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางการเข้า-ออกงาน';

-- Dumping data for table employee_system.attendance: ~0 rows (approximately)

-- Dumping structure for table employee_system.departments
CREATE TABLE IF NOT EXISTS `departments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL COMMENT 'ชื่อแผนก',
  `description` text DEFAULT NULL COMMENT 'คำอธิบายแผนก',
  `manager_id` int(11) DEFAULT NULL COMMENT 'หัวหน้าแผนก',
  `budget` decimal(15,2) DEFAULT NULL COMMENT 'งบประมาณแผนก',
  `location` varchar(255) DEFAULT NULL COMMENT 'ที่ตั้งแผนก',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT 'สถานะแผนก',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `manager_id` (`manager_id`),
  KEY `idx_name` (`name`),
  KEY `idx_status` (`status`),
  CONSTRAINT `departments_ibfk_1` FOREIGN KEY (`manager_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางแผนกงาน';

-- Dumping data for table employee_system.departments: ~8 rows (approximately)
INSERT INTO `departments` (`id`, `name`, `description`, `manager_id`, `budget`, `location`, `status`, `created_at`, `updated_at`) VALUES
	(1, 'ขาย', 'แผนกขายและการตลาด', NULL, NULL, 'ชั้น 1', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(2, 'การเงิน', 'แผนกการเงินและบัญชี', NULL, NULL, 'ชั้น 2', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(3, 'ทรัพยากรบุคคล', 'แผนกทรัพยากรบุคคล', NULL, NULL, 'ชั้น 2', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(4, 'IT', 'แผนกเทคโนโลยีสารสนเทศ', NULL, NULL, 'ชั้น 3', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(5, 'โกดัง', 'แผนกจัดเก็บและขนส่ง', NULL, NULL, 'ชั้นล่าง', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(6, 'ฝ่ายผลิต', 'แผนกการผลิต', NULL, NULL, 'โรงงาน', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(7, 'ควบคุมคุณภาพ', 'แผนกควบคุมคุณภาพสินค้า', NULL, NULL, 'โรงงาน', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(8, 'บริการลูกค้า', 'แผนกบริการลูกค้า', NULL, NULL, 'ชั้น 1', 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51');

-- Dumping structure for table employee_system.employees
CREATE TABLE IF NOT EXISTS `employees` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `line_user_id` varchar(255) NOT NULL COMMENT 'LINE User ID',
  `employee_code` varchar(50) NOT NULL COMMENT 'รหัสพนักงาน',
  `name` varchar(255) NOT NULL COMMENT 'ชื่อ-นามสกุล',
  `position` varchar(255) DEFAULT NULL COMMENT 'ตำแหน่งงาน',
  `department` varchar(255) DEFAULT NULL COMMENT 'แผนก',
  `salary` decimal(10,2) DEFAULT NULL COMMENT 'เงินเดือน',
  `hire_date` date DEFAULT NULL COMMENT 'วันที่เริ่มงาน',
  `phone` varchar(20) DEFAULT NULL COMMENT 'เบอร์โทรศัพท์',
  `email` varchar(255) DEFAULT NULL COMMENT 'อีเมล',
  `profile_image_url` text DEFAULT NULL COMMENT 'URL รูปโปรไฟล์',
  `status` enum('pending','active','inactive') NOT NULL DEFAULT 'pending',
  `rejection_reason` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp() COMMENT 'วันที่สร้างข้อมูล',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp() COMMENT 'วันที่แก้ไขล่าสุด',
  PRIMARY KEY (`id`),
  UNIQUE KEY `line_user_id` (`line_user_id`),
  UNIQUE KEY `employee_code` (`employee_code`),
  KEY `idx_line_user_id` (`line_user_id`),
  KEY `idx_employee_code` (`employee_code`),
  KEY `idx_status` (`status`),
  KEY `idx_employees_line_user_id` (`line_user_id`),
  KEY `idx_employees_status` (`status`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางข้อมูลพนักงาน';

-- Dumping data for table employee_system.employees: ~6 rows (approximately)
INSERT INTO `employees` (`id`, `line_user_id`, `employee_code`, `name`, `position`, `department`, `salary`, `hire_date`, `phone`, `email`, `profile_image_url`, `status`, `rejection_reason`, `created_at`, `updated_at`) VALUES
	(1, 'U12345678901234567', 'EMP001', 'นายสมชาย ใจดี', 'พนักงานขาย', 'ขาย', 18000.00, '2024-01-15', '0812345678', 'somchai@company.com', NULL, 'active', NULL, '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(2, 'U23456789012345678', 'EMP002', 'นางสาวมาลี สวยงาม', 'นักบัญชี', 'การเงิน', 22000.00, '2024-02-01', '0823456789', 'mali@company.com', NULL, 'active', NULL, '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(3, 'U34567890123456789', 'EMP003', 'นายประเสริฐ รวยเงิน', 'หัวหน้าแผนกขาย', 'ขาย', 42000.00, '2023-08-10', '0834567890', 'prasert@company.com', NULL, 'active', NULL, '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(4, 'U45678901234567890', 'EMP004', 'นางสาวสุดา ทำงาน', 'HR Officer', 'ทรัพยากรบุคคล', 25000.00, '2023-11-20', '0845678901', 'suda@company.com', NULL, 'active', NULL, '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(5, 'U56789012345678901', 'EMP005', 'นายเจษฎา โปรแกรม', 'นักพัฒนาระบบ', 'IT', 35000.00, '2024-03-05', '0856789012', 'jetsada@company.com', NULL, 'active', NULL, '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(6, 'U5b62342b997c4d220af16bd17aed76dc', 'EMP006', 'B E 三 R 🕊', 'พนักงานขาย', 'พนักงานขาย', 18000.00, NULL, '0828293015', 'beer-nattapon-pus@hotmail.co.th', NULL, 'active', NULL, '2025-09-07 11:36:50', '2025-09-07 12:47:29');

-- Dumping structure for table employee_system.employee_benefits
CREATE TABLE IF NOT EXISTS `employee_benefits` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL COMMENT 'รหัสพนักงาน',
  `vacation_days_total` int(11) DEFAULT 10 COMMENT 'วันลาพักผ่อนทั้งหมดต่อปี',
  `vacation_days_used` int(11) DEFAULT 0 COMMENT 'วันลาพักผ่อนที่ใช้แล้ว',
  `sick_days_total` int(11) DEFAULT 30 COMMENT 'วันลาป่วยทั้งหมดต่อปี',
  `sick_days_used` int(11) DEFAULT 0 COMMENT 'วันลาป่วยที่ใช้แล้ว',
  `personal_days_total` int(11) DEFAULT 5 COMMENT 'วันลาธุระส่วนตัวทั้งหมดต่อปี',
  `personal_days_used` int(11) DEFAULT 0 COMMENT 'วันลาธุระส่วนตัวที่ใช้แล้ว',
  `social_security_number` varchar(50) DEFAULT NULL COMMENT 'เลขประกันสังคม',
  `insurance_policy` varchar(100) DEFAULT NULL COMMENT 'เลขกรมธรรม์ประกัน',
  `health_insurance_provider` varchar(255) DEFAULT NULL COMMENT 'บริษัทประกันสุขภาพ',
  `bonus_current_month` decimal(10,2) DEFAULT 0.00 COMMENT 'โบนัสเดือนปัจจุบัน',
  `overtime_current_month` decimal(10,2) DEFAULT 0.00 COMMENT 'ค่าล่วงเวลาเดือนปัจจุบัน',
  `commission_current_month` decimal(10,2) DEFAULT 0.00 COMMENT 'ค่าคอมมิชชั่นเดือนปัจจุบัน',
  `provident_fund_employee` decimal(5,2) DEFAULT 0.00 COMMENT 'เปอร์เซ็นต์เงินสมทบกองทุนพนักงาน',
  `provident_fund_company` decimal(5,2) DEFAULT 0.00 COMMENT 'เปอร์เซ็นต์เงินสมทบกองทุนบริษัท',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_benefits` (`employee_id`),
  CONSTRAINT `employee_benefits_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางสวัสดิการพนักงาน';

-- Dumping data for table employee_system.employee_benefits: ~5 rows (approximately)
INSERT INTO `employee_benefits` (`id`, `employee_id`, `vacation_days_total`, `vacation_days_used`, `sick_days_total`, `sick_days_used`, `personal_days_total`, `personal_days_used`, `social_security_number`, `insurance_policy`, `health_insurance_provider`, `bonus_current_month`, `overtime_current_month`, `commission_current_month`, `provident_fund_employee`, `provident_fund_company`, `updated_at`) VALUES
	(1, 1, 10, 2, 30, 1, 5, 0, '1234567890123', NULL, NULL, 2000.00, 1500.00, 0.00, 0.00, 0.00, '2025-09-06 19:02:51'),
	(2, 2, 10, 1, 30, 0, 5, 0, '2345678901234', NULL, NULL, 1800.00, 800.00, 0.00, 0.00, 0.00, '2025-09-06 19:02:51'),
	(3, 3, 15, 3, 30, 2, 5, 0, '3456789012345', NULL, NULL, 5000.00, 2200.00, 0.00, 0.00, 0.00, '2025-09-06 19:02:51'),
	(4, 4, 12, 1, 30, 1, 5, 0, '4567890123456', NULL, NULL, 2500.00, 1200.00, 0.00, 0.00, 0.00, '2025-09-06 19:02:51'),
	(5, 5, 10, 0, 30, 0, 5, 0, '5678901234567', NULL, NULL, 3000.00, 1800.00, 0.00, 0.00, 0.00, '2025-09-06 19:02:51');

-- Dumping structure for table employee_system.leave_requests
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL COMMENT 'รหัสพนักงาน',
  `leave_type` enum('sick','personal','vacation','emergency','maternity','paternity','annual') NOT NULL COMMENT 'ประเภทการลา',
  `start_date` date NOT NULL COMMENT 'วันเริ่มลา',
  `end_date` date NOT NULL COMMENT 'วันสิ้นสุดลา',
  `days_count` int(11) NOT NULL COMMENT 'จำนวนวันลา',
  `reason` text NOT NULL COMMENT 'เหตุผลการลา',
  `status` enum('pending','approved','rejected','cancelled') DEFAULT 'pending' COMMENT 'สถานะคำขอ',
  `approved_by` int(11) DEFAULT NULL COMMENT 'ผู้อนุมัติ',
  `approved_at` timestamp NULL DEFAULT NULL COMMENT 'วันที่อนุมัติ',
  `rejection_reason` text DEFAULT NULL COMMENT 'เหตุผลปฏิเสธ',
  `document_url` text DEFAULT NULL COMMENT 'URL เอกสารแนบ',
  `emergency_contact` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'ข้อมูลติดต่อฉุกเฉิน' CHECK (json_valid(`emergency_contact`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `approved_by` (`approved_by`),
  KEY `idx_employee_date` (`employee_id`,`start_date`),
  KEY `idx_status` (`status`),
  KEY `idx_leave_type` (`leave_type`),
  CONSTRAINT `leave_requests_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `leave_requests_ibfk_2` FOREIGN KEY (`approved_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางคำขอลา';

-- Dumping data for table employee_system.leave_requests: ~0 rows (approximately)
INSERT INTO `leave_requests` (`id`, `employee_id`, `leave_type`, `start_date`, `end_date`, `days_count`, `reason`, `status`, `approved_by`, `approved_at`, `rejection_reason`, `document_url`, `emergency_contact`, `created_at`, `updated_at`) VALUES
	(1, 6, 'sick', '2025-09-08', '2025-09-08', 0, 'test', 'pending', NULL, NULL, NULL, NULL, NULL, '2025-09-07 15:26:56', '2025-09-07 15:26:56');

-- Dumping structure for table employee_system.payroll
CREATE TABLE IF NOT EXISTS `payroll` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL COMMENT 'รหัสพนักงาน',
  `pay_period_start` date NOT NULL COMMENT 'วันเริ่มต้นรอบจ่าย',
  `pay_period_end` date NOT NULL COMMENT 'วันสิ้นสุดรอบจ่าย',
  `base_salary` decimal(10,2) NOT NULL COMMENT 'เงินเดือนพื้นฐาน',
  `overtime_pay` decimal(10,2) DEFAULT 0.00 COMMENT 'ค่าล่วงเวลา',
  `bonus` decimal(10,2) DEFAULT 0.00 COMMENT 'โบนัส',
  `commission` decimal(10,2) DEFAULT 0.00 COMMENT 'ค่าคอมมิชชั่น',
  `allowances` decimal(10,2) DEFAULT 0.00 COMMENT 'เบี้ยเลี้ยง',
  `deductions` decimal(10,2) DEFAULT 0.00 COMMENT 'รายการหัก',
  `tax` decimal(10,2) DEFAULT 0.00 COMMENT 'ภาษี',
  `social_security` decimal(10,2) DEFAULT 0.00 COMMENT 'ประกันสังคม',
  `provident_fund` decimal(10,2) DEFAULT 0.00 COMMENT 'กองทุนสำรองเลี้ยงชีพ',
  `net_pay` decimal(10,2) NOT NULL COMMENT 'เงินสุทธิ',
  `pay_date` date DEFAULT NULL COMMENT 'วันที่จ่าย',
  `status` enum('draft','approved','paid') DEFAULT 'draft' COMMENT 'สถานะการจ่าย',
  `notes` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `processed_by` int(11) DEFAULT NULL COMMENT 'ผู้ประมวลผล',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `processed_by` (`processed_by`),
  KEY `idx_employee_period` (`employee_id`,`pay_period_start`),
  KEY `idx_pay_date` (`pay_date`),
  KEY `idx_status` (`status`),
  CONSTRAINT `payroll_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `payroll_ibfk_2` FOREIGN KEY (`processed_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางการจ่ายเงินเดือน';

-- Dumping data for table employee_system.payroll: ~0 rows (approximately)

-- Dumping structure for table employee_system.positions
CREATE TABLE IF NOT EXISTS `positions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL COMMENT 'ชื่อตำแหน่ง',
  `department_id` int(11) DEFAULT NULL COMMENT 'แผนกที่สังกัด',
  `description` text DEFAULT NULL COMMENT 'คำอธิบายงาน',
  `min_salary` decimal(10,2) DEFAULT NULL COMMENT 'เงินเดือนขั้นต่ำ',
  `max_salary` decimal(10,2) DEFAULT NULL COMMENT 'เงินเดือนสูงสุด',
  `required_skills` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL COMMENT 'ทักษะที่ต้องการ' CHECK (json_valid(`required_skills`)),
  `status` enum('active','inactive') DEFAULT 'active' COMMENT 'สถานะตำแหน่ง',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_title` (`title`),
  KEY `idx_department` (`department_id`),
  CONSTRAINT `positions_ibfk_1` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=11 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางตำแหน่งงาน';

-- Dumping data for table employee_system.positions: ~10 rows (approximately)
INSERT INTO `positions` (`id`, `title`, `department_id`, `description`, `min_salary`, `max_salary`, `required_skills`, `status`, `created_at`, `updated_at`) VALUES
	(1, 'พนักงานขาย', 1, 'ขายสินค้าและบริการให้กับลูกค้า', 15000.00, 25000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(2, 'หัวหน้าแผนกขาย', 1, 'บริหารจัดการทีมขายและกำหนดกลยุทธ์', 35000.00, 50000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(3, 'นักบัญชี', 2, 'จัดทำบัญชีและรายงานทางการเงิน', 18000.00, 30000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(4, 'หัวหน้าบัญชี', 2, 'บริหารจัดการงานบัญชีและการเงิน', 40000.00, 60000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(5, 'HR Officer', 3, 'จัดการทรัพยากรบุคคลและสวัสดิการ', 20000.00, 35000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(6, 'นักพัฒนาระบบ', 4, 'พัฒนาและดูแลระบบคอมพิวเตอร์', 25000.00, 45000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(7, 'คนงานโกดัง', 5, 'จัดเก็บและขนย้ายสินค้า', 12000.00, 18000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(8, 'พนักงานผลิต', 6, 'ปฏิบัติงานในสายการผลิต', 13000.00, 20000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(9, 'เจ้าหน้าที่ QC', 7, 'ตรวจสอบคุณภาพสินค้า', 16000.00, 25000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51'),
	(10, 'เจ้าหน้าที่บริการลูกค้า', 8, 'ให้บริการและแก้ไขปัญหาลูกค้า', 14000.00, 22000.00, NULL, 'active', '2025-09-06 19:02:51', '2025-09-06 19:02:51');

-- Dumping structure for table employee_system.shift_schedules
CREATE TABLE IF NOT EXISTS `shift_schedules` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL COMMENT 'รหัสพนักงาน',
  `date` date NOT NULL COMMENT 'วันที่',
  `shift_start` time NOT NULL COMMENT 'เวลาเริ่มกะ',
  `shift_end` time NOT NULL COMMENT 'เวลาสิ้นสุดกะ',
  `break_start` time DEFAULT NULL COMMENT 'เวลาเริ่มพัก',
  `break_end` time DEFAULT NULL COMMENT 'เวลาสิ้นสุดพัก',
  `shift_type` enum('morning','afternoon','night','full_day') DEFAULT 'full_day' COMMENT 'ประเภทกะ',
  `notes` text DEFAULT NULL COMMENT 'หมายเหตุ',
  `created_by` int(11) DEFAULT NULL COMMENT 'ผู้สร้างตาราง',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_employee_date_shift` (`employee_id`,`date`),
  KEY `created_by` (`created_by`),
  KEY `idx_date` (`date`),
  KEY `idx_shift_type` (`shift_type`),
  CONSTRAINT `shift_schedules_ibfk_1` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  CONSTRAINT `shift_schedules_ibfk_2` FOREIGN KEY (`created_by`) REFERENCES `employees` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางกะงาน';

-- Dumping data for table employee_system.shift_schedules: ~0 rows (approximately)

-- Dumping structure for table employee_system.system_settings
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL COMMENT 'คีย์การตั้งค่า',
  `setting_value` text NOT NULL COMMENT 'ค่าการตั้งค่า',
  `setting_type` enum('string','number','boolean','json') DEFAULT 'string' COMMENT 'ประเภทข้อมูล',
  `description` text DEFAULT NULL COMMENT 'คำอธิบาย',
  `is_active` tinyint(1) DEFAULT 1 COMMENT 'สถานะการใช้งาน',
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`),
  KEY `idx_setting_key` (`setting_key`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB AUTO_INCREMENT=22 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางการตั้งค่าระบบ';

-- Dumping data for table employee_system.system_settings: ~21 rows (approximately)
INSERT INTO `system_settings` (`id`, `setting_key`, `setting_value`, `setting_type`, `description`, `is_active`, `updated_at`) VALUES
	(1, 'work_start_time', '09:00:00', 'string', 'เวลาเริ่มงานมาตรฐาน', 1, '2025-09-06 19:02:50'),
	(2, 'work_end_time', '18:00:00', 'string', 'เวลาเลิกงานมาตรฐาน', 1, '2025-09-06 19:02:50'),
	(3, 'lunch_start_time', '12:00:00', 'string', 'เวลาเริ่มพักกลางวัน', 1, '2025-09-06 19:02:50'),
	(4, 'lunch_end_time', '13:00:00', 'string', 'เวลาสิ้นสุดพักกลางวัน', 1, '2025-09-06 19:02:50'),
	(5, 'late_threshold_minutes', '15', 'number', 'จำนวนนาทีที่ถือว่าสาย', 1, '2025-09-06 19:02:50'),
	(6, 'office_location_lat', '13.7563', 'number', 'ละติจูดของสำนักงาน (กรุงเทพฯ)', 1, '2025-09-06 19:02:50'),
	(7, 'office_location_lng', '100.5018', 'number', 'ลองจิจูดของสำนักงาน (กรุงเทพฯ)', 1, '2025-09-06 19:02:50'),
	(8, 'checkin_radius_meters', '100', 'number', 'รัศมีที่อนุญาตให้เช็คอิน (เมตร)', 1, '2025-09-06 19:02:50'),
	(9, 'overtime_rate', '1.5', 'number', 'อัตราค่าล่วงเวลา (เท่า)', 1, '2025-09-06 19:02:50'),
	(10, 'working_days_per_week', '5', 'number', 'จำนวนวันทำงานต่อสัปดาห์', 1, '2025-09-06 19:02:50'),
	(11, 'annual_leave_days', '10', 'number', 'วันลาพักผ่อนต่อปี', 1, '2025-09-06 19:02:50'),
	(12, 'sick_leave_days', '30', 'number', 'วันลาป่วยต่อปี', 1, '2025-09-06 19:02:50'),
	(13, 'personal_leave_days', '5', 'number', 'วันลาธุระส่วนตัวต่อปี', 1, '2025-09-06 19:02:50'),
	(14, 'company_name', 'บริษัท ตัวอย่าง จำกัด', 'string', 'ชื่อบริษัท', 1, '2025-09-06 19:02:50'),
	(15, 'company_address', '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110', 'string', 'ที่อยู่บริษัท', 1, '2025-09-06 19:02:50'),
	(16, 'payroll_day', '25', 'number', 'วันที่จ่ายเงินเดือนของทุกเดือน', 1, '2025-09-06 19:02:50'),
	(17, 'min_work_hours_per_day', '8', 'number', 'ชั่วโมงทำงานขั้นต่ำต่อวัน', 1, '2025-09-06 19:02:50'),
	(18, 'max_overtime_hours_per_day', '4', 'number', 'ชั่วโมงล่วงเวลาสูงสุดต่อวัน', 1, '2025-09-06 19:02:50'),
	(19, 'social_security_rate_employee', '5', 'number', 'อัตราประกันสังคมพนักงาน (%)', 1, '2025-09-06 19:02:50'),
	(20, 'social_security_rate_company', '5', 'number', 'อัตราประกันสังคมบริษัท (%)', 1, '2025-09-06 19:02:50'),
	(21, 'tax_exemption_amount', '60000', 'number', 'ยอดยกเว้นภาษีต่อปี (บาท)', 1, '2025-09-06 19:02:50');

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
