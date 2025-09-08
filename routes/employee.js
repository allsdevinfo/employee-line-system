// routes/employee.js - เพิ่ม endpoints ใหม่
const express = require('express');
const router = express.Router();
const openRouter = express.Router();

const dbConfig = require('../config/database');
const { responseHelpers, dateHelpers, textHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');

// ใช้ auth กับทุก endpoint ของ router หลัก
router.use(authenticateUser);

/**
 * GET /api/employee/attendance/today
 * สถานะการเข้างานของวันนี้
 */
router.get('/attendance/today', asyncHandler(async (req, res) => {
  const e = req.employee;
  const today = dateHelpers.getCurrentDate();

  const [rows] = await dbConfig.execute(
    `SELECT id, date, check_in_time, check_out_time, work_hours, overtime_hours, status, notes
     FROM attendance
     WHERE employee_id = ? AND date = ? LIMIT 1`,
    [e.id, today]
  );

  if (!rows.length) {
    return res.json(responseHelpers.success({ hasData: false }, 'ไม่มีข้อมูลวันนี้'));
  }

  const r = rows[0];
  const hasIn = !!r.check_in_time;
  const hasOut = !!r.check_out_time;

  const payload = {
    hasData: true,
    checkInTime: hasIn ? dateHelpers.formatTime(r.check_in_time) : null,
    checkOutTime: hasOut ? dateHelpers.formatTime(r.check_out_time) : null,
    currentWorkHours: r.work_hours ?? 0,
    finalWorkHours: hasOut ? (r.work_hours ?? 0) : null,
    isWorkingNow: hasIn && !hasOut,
    isComplete: hasIn && hasOut,
    status: r.status,
    statusText: textHelpers.getStatusText(r.status),
    notes: r.notes || null
  };

  res.json(responseHelpers.success(payload, 'สถานะวันนี้'));
}));

/**
 * GET /api/employee
 * ข้อมูลพนักงานปัจจุบัน (จาก middleware)
 */
router.get('/', asyncHandler(async (req, res) => {
  const e = req.employee;
  res.json(responseHelpers.success({
    id: e.id,
    lineUserId: e.line_user_id,
    employeeCode: e.employee_code,
    name: e.name,
    department: e.department,
    position: e.position,
    salary: e.salary,
    status: e.status,
    phone: e.phone,
    email: e.email,
    hireDate: e.hire_date ? dateHelpers.formatDate(e.hire_date) : null
  }, 'ข้อมูลพนักงาน'));
}));

/**
 * GET /api/employee/overview
 * ภาพรวม + เช็คอินวันนี้
 */
router.get('/overview', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;
  const today = dateHelpers.getCurrentDate();

  const [rows] = await dbConfig.execute(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
    [employeeId, today]
  );
  const a = rows[0] || null;

  res.json(responseHelpers.success({
    id: req.employee.id,
    employeeCode: req.employee.employee_code,
    name: req.employee.name,
    position: req.employee.position,
    department: req.employee.department,
    hireDate: req.employee.hire_date,
    status: req.employee.status,
    checkedIn: !!a?.check_in_time,
    checkedOut: !!a?.check_out_time,
    checkInTime: a?.check_in_time || null,
    checkOutTime: a?.check_out_time || null,
    workHours: a?.work_hours || 0,
    attendanceStatus: a?.status || null
  }, 'ข้อมูลพนักงาน (overview)'));
}));

/**
 * GET /api/employee/profile
 */
router.get('/profile', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;

  const [detail] = await dbConfig.execute(`
    SELECT e.*, eb.vacation_days_total, eb.vacation_days_used,
           eb.sick_days_total, eb.sick_days_used,
           eb.personal_days_total, eb.personal_days_used,
           eb.social_security_number, eb.bonus_current_month
    FROM employees e
    LEFT JOIN employee_benefits eb ON e.id = eb.employee_id
    WHERE e.id = ?
  `, [employeeId]);

  if (!detail.length) {
    return res.status(404).json(responseHelpers.error('ไม่พบข้อมูลพนักงาน', 'EMPLOYEE_NOT_FOUND'));
  }

  const e = detail[0];
  const workingYears = dateHelpers.calculateWorkingYears(e.hire_date);

  res.json(responseHelpers.success({
    personal: {
      employeeCode: e.employee_code,
      name: e.name,
      position: e.position,
      department: e.department,
      hireDate: e.hire_date,
      workingYears,
      phone: e.phone,
      email: e.email,
      status: e.status
    },
    benefits: {
      salary: e.salary,
      vacationDaysTotal: e.vacation_days_total || 10,
      vacationDaysUsed: e.vacation_days_used || 0,
      vacationDaysRemaining: (e.vacation_days_total || 10) - (e.vacation_days_used || 0),
      sickDaysTotal: e.sick_days_total || 30,
      sickDaysUsed: e.sick_days_used || 0,
      sickDaysRemaining: (e.sick_days_total || 30) - (e.sick_days_used || 0),
      personalDaysTotal: e.personal_days_total || 5,
      personalDaysUsed: e.personal_days_used || 0,
      personalDaysRemaining: (e.personal_days_total || 5) - (e.personal_days_used || 0),
      socialSecurityNumber: e.social_security_number,
      bonusCurrentMonth: e.bonus_current_month || 0
    }
  }, 'ข้อมูลโปรไฟล์'));
}));

/**
 * PUT /api/employee/profile
 */
router.put('/profile', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;
  const { phone, email } = req.body;

  const updates = {};
  if (phone) updates.phone = phone;
  if (email) updates.email = email;

  if (!Object.keys(updates).length) {
    return res.status(400).json(responseHelpers.error('ไม่มีข้อมูลที่ต้องอัปเดต', 'NO_UPDATE_DATA'));
  }

  const set = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), employeeId];

  await dbConfig.execute(`UPDATE employees SET ${set}, updated_at = NOW() WHERE id = ?`, vals);
  res.json(responseHelpers.success(null, 'อัปเดตข้อมูลโปรไฟล์เรียบร้อย'));
}));

/**
 * GET /api/employee/welfare - สวัสดิการ
 */
router.get('/welfare', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;

  // ดึงข้อมูลสวัสดิการ
  const [benefits] = await dbConfig.execute(
    'SELECT * FROM employee_benefits WHERE employee_id = ?',
    [employeeId]
  );

  let b = benefits[0];
  if (!b) {
    // สร้างข้อมูลสวัสดิการเริ่มต้นถ้าไม่มี
    await dbConfig.execute('INSERT INTO employee_benefits (employee_id) VALUES (?)', [employeeId]);
    b = {
      vacation_days_total: 10,
      vacation_days_used: 0,
      sick_days_total: 30,
      sick_days_used: 0,
      personal_days_total: 5,
      personal_days_used: 0,
      social_security_number: null,
      bonus_current_month: 0
    };
  }

  // คำนวณ OT ในเดือนปัจจุบัน
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [ot] = await dbConfig.execute(`
    SELECT SUM(overtime_hours) AS total_overtime
    FROM attendance
    WHERE employee_id = ? AND DATE_FORMAT(date, '%Y-%m') = ?
  `, [employeeId, currentMonth]);

  const overtimeHours = ot[0]?.total_overtime || 0;
  const hourlyRate = req.employee.salary ? (req.employee.salary / 240) : 0; // สมมติ 30 วัน x 8 ชม = 240 ชม/เดือน
  const overtimePay = Math.round(overtimeHours * hourlyRate * 1.5);

  // ดึงข้อมูลคำขอลาที่ pending
  const [pendingLeaves] = await dbConfig.execute(`
    SELECT COUNT(*) AS pending_count,
           SUM(CASE WHEN leave_type = 'vacation' THEN DATEDIFF(end_date, start_date) + 1 ELSE 0 END) AS pending_vacation_days
    FROM leave_requests 
    WHERE employee_id = ? AND status = 'pending'
  `, [employeeId]);

  const pendingInfo = pendingLeaves[0] || { pending_count: 0, pending_vacation_days: 0 };

  res.json(responseHelpers.success({
    salary: {
      monthly: req.employee.salary,
      payDate: '25 ของทุกเดือน',
      nextPayDate: getNextPayDate()
    },
    socialSecurity: {
      number: b.social_security_number || 'ยังไม่ได้ระบุ',
      rate: '5% ของเงินเดือน',
      monthlyContribution: req.employee.salary ? Math.round(req.employee.salary * 0.05) : 0
    },
    leaveDays: {
      vacation: {
        total: b.vacation_days_total || 10,
        used: b.vacation_days_used || 0,
        remaining: (b.vacation_days_total || 10) - (b.vacation_days_used || 0),
        pending: pendingInfo.pending_vacation_days || 0
      },
      sick: {
        total: b.sick_days_total || 30,
        used: b.sick_days_used || 0,
        remaining: (b.sick_days_total || 30) - (b.sick_days_used || 0)
      },
      personal: {
        total: b.personal_days_total || 5,
        used: b.personal_days_used || 0,
        remaining: (b.personal_days_total || 5) - (b.personal_days_used || 0)
      }
    },
    overtime: {
      hoursThisMonth: overtimeHours,
      estimatedPay: overtimePay,
      rate: '1.5 เท่าของค่าจ้างต่อชั่วโมง'
    },
    bonus: {
      currentMonth: b.bonus_current_month || 0,
      description: 'โบนัสประจำเดือน'
    },
    pendingRequests: {
      leaveRequests: pendingInfo.pending_count || 0
    }
  }, 'ข้อมูลสวัสดิการ'));
}));

/**
 * GET /api/employee/attendance/history - ประวัติการทำงาน
 */
router.get('/attendance/history', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;
  const { limit = 30, page = 1, month, year } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE employee_id = ?';
  let params = [employeeId];

  // ถ้าระบุเดือน/ปี
  if (month && year) {
    whereClause += ' AND YEAR(date) = ? AND MONTH(date) = ?';
    params.push(parseInt(year), parseInt(month));
  } else if (year) {
    whereClause += ' AND YEAR(date) = ?';
    params.push(parseInt(year));
  }

  const [records] = await dbConfig.execute(`
    SELECT date, check_in_time, check_out_time, work_hours, overtime_hours, status, notes
    FROM attendance
    ${whereClause}
    ORDER BY date DESC
    LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const [cnt] = await dbConfig.execute(
    `SELECT COUNT(*) AS count FROM attendance ${whereClause}`,
    params
  );

  const history = records.map(r => ({
    date: dateHelpers.formatDate(r.date),
    dateObject: r.date,
    checkIn: r.check_in_time ? dateHelpers.formatTime(r.check_in_time) : null,
    checkOut: r.check_out_time ? dateHelpers.formatTime(r.check_out_time) : null,
    workHours: parseFloat(r.work_hours || 0),
    overtimeHours: parseFloat(r.overtime_hours || 0),
    status: r.status,
    statusText: textHelpers.getStatusText(r.status),
    notes: r.notes
  }));

  res.json(responseHelpers.paginated(history, {
    page: parseInt(page),
    limit: parseInt(limit),
    total: cnt[0].count,
    totalPages: Math.ceil(cnt[0].count / parseInt(limit))
  }, 'ประวัติการทำงาน'));
}));

/**
 * GET /api/employee/attendance/summary - สรุปการทำงาน
 */
router.get('/attendance/summary', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;
  const { year, month } = req.query;

  const now = new Date();
  const y = parseInt(year || now.getFullYear());
  const m = parseInt(month || (now.getMonth() + 1));

  const start = `${y}-${String(m).padStart(2, '0')}-01`;
  const end = new Date(y, m, 0).toISOString().split('T')[0]; // วันสุดท้ายของเดือน

  const [summary] = await dbConfig.execute(`
    SELECT 
      COUNT(*) AS total_days,
      SUM(CASE WHEN status IN ('present','late') THEN 1 ELSE 0 END) AS present_days,
      SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) AS late_days,
      SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) AS absent_days,
      SUM(work_hours) AS total_work_hours,
      SUM(overtime_hours) AS total_overtime_hours,
      AVG(work_hours) AS avg_work_hours,
      MIN(check_in_time) AS earliest_checkin,
      MAX(check_out_time) AS latest_checkout
    FROM attendance
    WHERE employee_id = ? AND date BETWEEN ? AND ?`,
    [employeeId, start, end]
  );

  const s = summary[0] || {};
  const attendanceRate = (s.total_days || 0) > 0
    ? parseFloat(((s.present_days / s.total_days) * 100).toFixed(1))
    : 0;

  // คำนวณค่าจ้าง OT
  const hourlyRate = req.employee.salary ? (req.employee.salary / 240) : 0;
  const overtimePay = Math.round((s.total_overtime_hours || 0) * hourlyRate * 1.5);

  res.json(responseHelpers.success({
    period: {
      year: y,
      month: m,
      monthName: new Intl.DateTimeFormat('th-TH', { 
        year: 'numeric', 
        month: 'long' 
      }).format(new Date(y, m - 1, 1)),
      startDate: start,
      endDate: end
    },
    statistics: {
      totalDays: s.total_days || 0,
      presentDays: s.present_days || 0,
      lateDays: s.late_days || 0,
      absentDays: s.absent_days || 0,
      totalWorkHours: parseFloat(s.total_work_hours || 0),
      totalOvertimeHours: parseFloat(s.total_overtime_hours || 0),
      averageWorkHours: parseFloat(s.avg_work_hours || 0),
      attendanceRate,
      estimatedOvertimePay: overtimePay,
      earliestCheckIn: s.earliest_checkin ? dateHelpers.formatTime(s.earliest_checkin) : null,
      latestCheckOut: s.latest_checkout ? dateHelpers.formatTime(s.latest_checkout) : null
    }
  }, 'สรุปการทำงานรายเดือน'));
}));

/**
 * GET /api/employee/leaves - ประวัติการลา
 */
router.get('/leaves', asyncHandler(async (req, res) => {
  const employeeId = req.employee.id;
  const { limit = 20, page = 1, status } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let whereClause = 'WHERE employee_id = ?';
  let params = [employeeId];

  if (status && ['pending', 'approved', 'rejected'].includes(status)) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  const [leaves] = await dbConfig.execute(`
    SELECT id, leave_type, start_date, end_date, reason, status, 
           rejection_reason, created_at, approved_at,
           DATEDIFF(end_date, start_date) + 1 AS days_count
    FROM leave_requests
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?`,
    [...params, parseInt(limit), offset]
  );

  const [cnt] = await dbConfig.execute(
    `SELECT COUNT(*) AS count FROM leave_requests ${whereClause}`,
    params
  );

  const leaveHistory = leaves.map(leave => ({
    id: leave.id,
    leaveType: leave.leave_type,
    leaveTypeText: getLeaveTypeText(leave.leave_type),
    startDate: dateHelpers.formatDate(leave.start_date),
    endDate: dateHelpers.formatDate(leave.end_date),
    daysCount: leave.days_count,
    reason: leave.reason,
    status: leave.status,
    statusText: textHelpers.getStatusText(leave.status),
    rejectionReason: leave.rejection_reason,
    submittedAt: dateHelpers.formatDateTime(leave.created_at),
    approvedAt: leave.approved_at ? dateHelpers.formatDateTime(leave.approved_at) : null
  }));

  res.json(responseHelpers.paginated(leaveHistory, {
    page: parseInt(page),
    limit: parseInt(limit),
    total: cnt[0].count,
    totalPages: Math.ceil(cnt[0].count / parseInt(limit))
  }, 'ประวัติการลา'));
}));

// Helper functions
function getNextPayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // วันที่ 25 ของเดือนนี้
  let payDate = new Date(year, month, 25);
  
  // ถ้าผ่านวันที่ 25 แล้ว ให้เป็นเดือนหน้า
  if (now.getDate() > 25) {
    payDate = new Date(year, month + 1, 25);
  }
  
  return dateHelpers.formatDate(payDate);
}

function getLeaveTypeText(type) {
  const map = {
    'sick': 'ลาป่วย',
    'personal': 'ลาธุระส่วนตัว', 
    'vacation': 'ลาพักผ่อน',
    'emergency': 'ลาฉุกเฉิน',
    'maternity': 'ลาคลอด',
    'paternity': 'ลาบิดา'
  };
  return map[type] || type;
}

/**
 * -------- Public Open Routes (ไม่ต้อง auth) --------
 * POST /api/employee/register
 */
openRouter.post('/register', asyncHandler(async (req, res) => {
  const lineUserId = req.headers['x-user-id'];
  if (!lineUserId) {
    return res.status(400).json(responseHelpers.error('ต้องมี X-User-ID', 'MISSING_USER_ID'));
  }

  const { name, email, phone, pictureUrl } = req.body || {};

  const [exist] = await dbConfig.execute('SELECT id, status FROM employees WHERE line_user_id = ?', [lineUserId]);
  if (exist.length > 0) {
    const st = exist[0].status;
    return res.json(responseHelpers.success({ state: st === 'active' ? 'active' : 'pending' }, 'คุณลงทะเบียนไว้แล้ว'));
  }

  const code = 'EMP' + String(Math.floor(Math.random() * 100000)).padStart(5, '0');
  await dbConfig.execute(`
    INSERT INTO employees (line_user_id, employee_code, name, position, department, status, profile_image_url, created_at, updated_at)
    VALUES (?, ?, ?, NULL, NULL, 'pending', ?, NOW(), NOW())
  `, [lineUserId, code, name || 'ไม่ระบุ', pictureUrl || null]);

  res.status(201).json(responseHelpers.success({ state: 'pending' }, 'ลงทะเบียนสำเร็จ รอ HR อนุมัติ'));
}));

// ===== exports =====
module.exports = router;               // ใช้กับ /api/employee
module.exports.openRouter = openRouter; // ใช้กับ /api/employee (public)