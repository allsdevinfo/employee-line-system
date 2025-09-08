
const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const dbConfig = require('../config/database');
const lineMessaging = require('../utils/lineMessaging');
const timeCalculator = require('../utils/timeCalculator');
const { responseHelpers, dateHelpers, textHelpers, dataHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateAdmin } = require('../middleware/auth');
const { validationMiddleware } = require('../middleware/validation');

// ใช้ middleware admin authentication สำหรับทุก route
router.use(authenticateAdmin);

// GET / - ข้อมูลแดชบอร์ดแอดมิน
router.get('/', asyncHandler(async (req, res) => {
    const today = dateHelpers.getCurrentDate();
    const currentMonth = dateHelpers.formatDate(new Date(), 'YYYY-MM');

    // สถิติพื้นฐาน
    const [
        totalEmployees,
        activeEmployees,
        todayAttendance,
        pendingLeaves,
        monthlyStats,
        recentAttendance
    ] = await Promise.all([
        dbConfig.execute('SELECT COUNT(*) as count FROM employees'),
        dbConfig.execute('SELECT COUNT(*) as count FROM employees WHERE status = "active"'),
        dbConfig.execute('SELECT COUNT(*) as count FROM attendance WHERE date = ?', [today]),
        dbConfig.execute('SELECT COUNT(*) as count FROM leave_requests WHERE status = "pending"'),
        dbConfig.execute(`
            SELECT 
                COUNT(DISTINCT employee_id) as working_employees,
                SUM(work_hours) as total_work_hours,
                SUM(overtime_hours) as total_overtime_hours,
                AVG(work_hours) as avg_work_hours
            FROM attendance 
            WHERE DATE_FORMAT(date, '%Y-%m') = ?
        `, [currentMonth]),
        dbConfig.execute(`
            SELECT e.name, a.check_in_time, a.check_out_time, a.status
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            WHERE a.date = ?
            ORDER BY a.check_in_time DESC
            LIMIT 10
        `, [today])
    ]);

    const dashboardData = {
        overview: {
            totalEmployees: totalEmployees[0].count,
            activeEmployees: activeEmployees[0].count,
            todayAttendance: todayAttendance[0].count,
            pendingLeaves: pendingLeaves[0].count,
            attendanceRate: activeEmployees[0].count > 0 ? 
                ((todayAttendance[0].count / activeEmployees[0].count) * 100).toFixed(1) : 0
        },
        monthly: {
            workingEmployees: monthlyStats[0].working_employees || 0,
            totalWorkHours: parseFloat(monthlyStats[0].total_work_hours || 0),
            totalOvertimeHours: parseFloat(monthlyStats[0].total_overtime_hours || 0),
            averageWorkHours: parseFloat(monthlyStats[0].avg_work_hours || 0)
        },
        recentActivity: recentAttendance.map(record => ({
            employeeName: record.name,
            checkIn: record.check_in_time ? dateHelpers.formatTime(record.check_in_time) : null,
            checkOut: record.check_out_time ? dateHelpers.formatTime(record.check_out_time) : null,
            status: textHelpers.getStatusText(record.status)
        }))
    };

    res.json(responseHelpers.success(dashboardData, 'ข้อมูลแดชบอร์ดแอดมิน'));
}));

// === NEW: ดึงตำแหน่งทั้งหมด (ใช้ในหน้าอนุมัติ) ===
router.get('/positions', asyncHandler(async (req, res) => {
  const [rows] = await dbConfig.execute(`
    SELECT id, title, department_id, min_salary, max_salary
    FROM positions
    WHERE status = 'active'
    ORDER BY id
  `);
  res.json(responseHelpers.success(rows, 'รายการตำแหน่ง'));
}));


// GET /employees - รายการพนักงานทั้งหมด
router.get('/employees', asyncHandler(async (req, res) => {
    const { status, department, position, page = 1, limit = 20, search } = req.query;
    
    let whereClause = 'WHERE 1=1';
    let params = [];
    
    if (status) {
        whereClause += ' AND e.status = ?';
        params.push(status);
    }
    
    if (department) {
        whereClause += ' AND e.department = ?';
        params.push(department);
    }
    
    if (position) {
        whereClause += ' AND e.position = ?';
        params.push(position);
    }
    
    if (search) {
        whereClause += ' AND (e.name LIKE ? OR e.employee_code LIKE ? OR e.email LIKE ?)';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    const offset = (page - 1) * limit;
    
    const [employees] = await dbConfig.execute(`
        SELECT e.*, eb.vacation_days_used, eb.sick_days_used,
               DATEDIFF(NOW(), e.hire_date) as days_employed
        FROM employees e
        LEFT JOIN employee_benefits eb ON e.id = eb.employee_id
        ${whereClause}
        ORDER BY e.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [totalCount] = await dbConfig.execute(`
        SELECT COUNT(*) as count FROM employees e ${whereClause}
    `, params);

    const employeeList = employees.map(emp => ({
        id: emp.id,
        employeeCode: emp.employee_code,
        name: emp.name,
        position: emp.position,
        department: emp.department,
        salary: emp.salary,
        hireDate: dateHelpers.formatDate(emp.hire_date),
        workingYears: Math.floor(emp.days_employed / 365),
        status: emp.status,
        statusText: textHelpers.getStatusText(emp.status),
        phone: emp.phone,
        email: emp.email,
        vacationDaysUsed: emp.vacation_days_used || 0,
        sickDaysUsed: emp.sick_days_used || 0
    }));

    const pagination = dataHelpers.createPagination(page, totalCount[0].count, limit);

    res.json(responseHelpers.paginated(employeeList, pagination, 'รายการพนักงาน'));
}));

// POST /employees - เพิ่มพนักงานใหม่
router.post('/employees', validationMiddleware('employee'), asyncHandler(async (req, res) => {
    const { lineUserId, employeeCode, name, position, department, salary, hireDate, phone, email } = req.body;
    
    // ตรวจสอบ LINE User ID และรหัสพนักงานซ้ำ
    const [existing] = await dbConfig.execute(
        'SELECT id FROM employees WHERE line_user_id = ? OR employee_code = ?',
        [lineUserId, employeeCode]
    );

    if (existing.length > 0) {
        return res.status(400).json(responseHelpers.error(
            'LINE User ID หรือรหัสพนักงานซ้ำ',
            'DUPLICATE_EMPLOYEE_DATA'
        ));
    }

    // เพิ่มพนักงานใหม่
    const [result] = await dbConfig.execute(`
        INSERT INTO employees 
        (line_user_id, employee_code, name, position, department, salary, hire_date, phone, email)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [lineUserId, employeeCode, name, position, department, salary, hireDate, phone, email]);

    const employeeId = result.insertId;

    // สร้างข้อมูลสวัสดิการเริ่มต้น
    await dbConfig.execute(
        'INSERT INTO employee_benefits (employee_id) VALUES (?)',
        [employeeId]
    );

    res.status(201).json(responseHelpers.success({
        id: employeeId,
        employeeCode,
        name
    }, 'เพิ่มพนักงานใหม่เรียบร้อย'));
}));

router.put('/employees/:id', authenticateAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, position, salary } = req.body;

  const [result] = await dbConfig.execute(
    `UPDATE employees SET status = ?, position = ?, salary = ? WHERE id = ?`,
    [status, position, salary, id]
  );

  res.json({
    success: true,
    message: 'อัปเดตข้อมูลพนักงานเรียบร้อยแล้ว',
    data: { id, status, position, salary }
  });
}));


// PUT /employees/:id - อัปเดตข้อมูลพนักงาน
router.put('/employees/:id', validationMiddleware('employeeUpdate'), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updateData = req.body;
    
    // ลบข้อมูลที่ไม่อนุญาตให้แก้ไข
    delete updateData.id;
    delete updateData.line_user_id;
    delete updateData.employee_code;
    delete updateData.created_at;
    delete updateData.updated_at;

    if (Object.keys(updateData).length === 0) {
        return res.status(400).json(responseHelpers.error('ไม่มีข้อมูลที่ต้องอัปเดต', 'NO_UPDATE_DATA'));
    }

    // ก่อนทำ UPDATE
    if (updateData.salary && Number(updateData.salary) < 0) {
    return res.status(400).json(responseHelpers.error('เงินเดือนไม่ถูกต้อง', 'INVALID_SALARY'));
    }
    if (updateData.position && !String(updateData.position).trim()) {
    return res.status(400).json(responseHelpers.error('ตำแหน่งห้ามว่าง', 'INVALID_POSITION'));
    }


    const setClause = Object.keys(updateData).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updateData), id];


    const [result] = await dbConfig.execute(
        `UPDATE employees SET ${setClause}, updated_at = NOW() WHERE id = ?`,
        values
    );

    if (result.affectedRows === 0) {
        return res.status(404).json(responseHelpers.error('ไม่พบพนักงานที่ระบุ', 'EMPLOYEE_NOT_FOUND'));
    }

    res.json(responseHelpers.success(null, 'อัปเดตข้อมูลพนักงานเรียบร้อย'));
}));

// DELETE /employees/:id - ลบพนักงาน (เปลี่ยนสถานะเป็น inactive)
router.put('/employees/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  let { status, positionId, salary, phone, email, position } = req.body;

  // เบอร์โทรบังคับ
  if (!phone || String(phone).trim() === '') {
    return res.status(400).json(responseHelpers.error('กรุณากรอกเบอร์โทรศัพท์', 'PHONE_REQUIRED'));
  }

  // หากส่ง positionId มา ให้ map เป็นชื่อ position และตรวจช่วงเงินเดือน
  let positionTitle = position || null;
  let min = null, max = null;

  if (positionId) {
    const [ps] = await dbConfig.execute(
      `SELECT id, title, min_salary, max_salary FROM positions WHERE id = ? AND status='active'`,
      [positionId]
    );
    if (!ps.length) {
      return res.status(400).json(responseHelpers.error('ตำแหน่งไม่ถูกต้อง', 'INVALID_POSITION'));
    }
    positionTitle = ps[0].title;
    min = Number(ps[0].min_salary);
    max = Number(ps[0].max_salary);

    if (salary == null || Number.isNaN(Number(salary))) {
      return res.status(400).json(responseHelpers.error('เงินเดือนไม่ถูกต้อง', 'INVALID_SALARY'));
    }
    const s = Number(salary);
    if (s < min || s > max) {
      return res.status(400).json(
        responseHelpers.error(`เงินเดือนต้องอยู่ระหว่าง ${min.toLocaleString()} - ${max.toLocaleString()} บาท`, 'SALARY_OUT_OF_RANGE')
      );
    }
  } else {
    // ไม่มี positionId ก็ยังอนุญาตให้อัปเดตฟิลด์อื่นได้ (แต่ถ้าจะอนุมัติ ควรส่ง positionId + salary มาด้วย)
    if (salary != null && Number(salary) < 0) {
      return res.status(400).json(responseHelpers.error('เงินเดือนไม่ถูกต้อง', 'INVALID_SALARY'));
    }
  }

  // สร้างชุดอัปเดตแบบไดนามิก
  const sets = [];
  const vals = [];

  if (status) { sets.push('status = ?'); vals.push(status); }
  if (positionTitle) { sets.push('position = ?'); vals.push(positionTitle); }
  if (salary != null) { sets.push('salary = ?'); vals.push(Number(salary)); }
  if (phone != null) { sets.push('phone = ?'); vals.push(phone); }
  if (email != null) { sets.push('email = ?'); vals.push(email || null); }

  // ต้องมีอย่างน้อย 1 ฟิลด์
  if (!sets.length) {
    return res.status(400).json(responseHelpers.error('ไม่มีข้อมูลสำหรับอัปเดต', 'NO_UPDATE_DATA'));
  }

  sets.push('updated_at = NOW()');
  vals.push(id);

  const [result] = await dbConfig.execute(
    `UPDATE employees SET ${sets.join(', ')} WHERE id = ?`,
    vals
  );

  if (result.affectedRows === 0) {
    return res.status(404).json(responseHelpers.error('ไม่พบพนักงานที่ระบุ', 'EMPLOYEE_NOT_FOUND'));
  }

  res.json(responseHelpers.success(null, 'อัปเดตข้อมูลพนักงานเรียบร้อย'));
}));

// GET /attendance - รายงานการเข้างานทั้งหมด
router.get('/attendance', asyncHandler(async (req, res) => {
    const { date, employeeId, status, page = 1, limit = 50 } = req.query;
    const today = dateHelpers.getCurrentDate();
    const targetDate = date || today;
    
    let whereClause = 'WHERE a.date = ?';
    let params = [targetDate];
    
    if (employeeId) {
        whereClause += ' AND a.employee_id = ?';
        params.push(employeeId);
    }
    
    if (status) {
        whereClause += ' AND a.status = ?';
        params.push(status);
    }

    const offset = (page - 1) * limit;

    const [attendanceRecords] = await dbConfig.execute(`
        SELECT a.*, e.name, e.employee_code, e.position, e.department
        FROM attendance a
        JOIN employees e ON a.employee_id = e.id
        ${whereClause}
        ORDER BY a.check_in_time ASC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [totalCount] = await dbConfig.execute(`
        SELECT COUNT(*) as count FROM attendance a JOIN employees e ON a.employee_id = e.id ${whereClause}
    `, params);

    const attendanceList = attendanceRecords.map(record => ({
        id: record.id,
        employee: {
            id: record.employee_id,
            code: record.employee_code,
            name: record.name,
            position: record.position,
            department: record.department
        },
        date: dateHelpers.formatDate(record.date),
        checkIn: record.check_in_time ? dateHelpers.formatTime(record.check_in_time) : null,
        checkOut: record.check_out_time ? dateHelpers.formatTime(record.check_out_time) : null,
        workHours: record.work_hours,
        overtimeHours: record.overtime_hours,
        status: record.status,
        statusText: textHelpers.getStatusText(record.status),
        notes: record.notes
    }));

    const pagination = dataHelpers.createPagination(page, totalCount[0].count, limit);

    res.json(responseHelpers.paginated(attendanceList, pagination, `รายงานการเข้างานวันที่ ${dateHelpers.formatDate(targetDate)}`));
}));

// GET /leaves - คำขอลาทั้งหมด
router.get('/leaves', asyncHandler(async (req, res) => {
    const { status = 'pending', employeeId, page = 1, limit = 20 } = req.query;
    
    let whereClause = 'WHERE lr.status = ?';
    let params = [status];
    
    if (employeeId) {
        whereClause += ' AND lr.employee_id = ?';
        params.push(employeeId);
    }

    const offset = (page - 1) * limit;

    const [leaveRequests] = await dbConfig.execute(`
        SELECT lr.*, e.name, e.employee_code, e.position, e.department,
               approver.name as approved_by_name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        LEFT JOIN employees approver ON lr.approved_by = approver.id
        ${whereClause}
        ORDER BY lr.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [totalCount] = await dbConfig.execute(`
        SELECT COUNT(*) as count FROM leave_requests lr JOIN employees e ON lr.employee_id = e.id ${whereClause}
    `, params);

    const leaveList = leaveRequests.map(leave => ({
        id: leave.id,
        employee: {
            id: leave.employee_id,
            code: leave.employee_code,
            name: leave.name,
            position: leave.position,
            department: leave.department
        },
        leaveType: leave.leave_type,
        leaveTypeText: textHelpers.getLeaveTypeText(leave.leave_type),
        startDate: dateHelpers.formatDate(leave.start_date),
        endDate: dateHelpers.formatDate(leave.end_date),
        daysCount: leave.days_count,
        reason: leave.reason,
        status: leave.status,
        statusText: textHelpers.getStatusText(leave.status),
        approvedBy: leave.approved_by_name,
        approvedAt: leave.approved_at ? dateHelpers.formatDateTime(leave.approved_at) : null,
        submittedAt: dateHelpers.formatDateTime(leave.created_at)
    }));

    const pagination = dataHelpers.createPagination(page, totalCount[0].count, limit);

    res.json(responseHelpers.paginated(leaveList, pagination, 'คำขอลาทั้งหมด'));
}));

// PUT /leaves/:id/approve - อนุมัติคำขอลา
router.put('/leaves/:id/approve', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const approverId = req.employee.id;

    // ตรวจสอบคำขอลา
    const [leaveRequests] = await dbConfig.execute(`
        SELECT lr.*, e.line_user_id, e.name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = ? AND lr.status = 'pending'
    `, [id]);

    if (leaveRequests.length === 0) {
        return res.status(404).json(responseHelpers.error(
            'ไม่พบคำขอลาที่สามารถอนุมัติได้',
            'LEAVE_REQUEST_NOT_FOUND'
        ));
    }

    const leaveRequest = leaveRequests[0];

    // อัปเดตสถานะ
    await dbConfig.execute(
        'UPDATE leave_requests SET status = "approved", approved_by = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
        [approverId, id]
    );

    // อัปเดตวันลาที่ใช้ (สำหรับลาพักผ่อน)
    if (leaveRequest.leave_type === 'vacation') {
        await dbConfig.execute(
            'UPDATE employee_benefits SET vacation_days_used = vacation_days_used + ? WHERE employee_id = ?',
            [leaveRequest.days_count, leaveRequest.employee_id]
        );
    } else if (leaveRequest.leave_type === 'sick') {
        await dbConfig.execute(
            'UPDATE employee_benefits SET sick_days_used = sick_days_used + ? WHERE employee_id = ?',
            [leaveRequest.days_count, leaveRequest.employee_id]
        );
    } else if (leaveRequest.leave_type === 'personal') {
        await dbConfig.execute(
            'UPDATE employee_benefits SET personal_days_used = personal_days_used + ? WHERE employee_id = ?',
            [leaveRequest.days_count, leaveRequest.employee_id]
        );
    }

    // ส่งการแจ้งเตือนผ่าน LINE
    if (leaveRequest.line_user_id) {
        await lineMessaging.sendLeaveApprovalNotification(leaveRequest.line_user_id, {
            status: 'approved',
            leaveType: leaveRequest.leave_type,
            startDate: leaveRequest.start_date,
            endDate: leaveRequest.end_date,
            approvedBy: req.employee.name
        }).catch(error => {
            console.error('Failed to send LINE notification:', error);
        });
    }

    res.json(responseHelpers.success(null, 'อนุมัติคำขอลาเรียบร้อย'));
}));

// PUT /leaves/:id/reject - ปฏิเสธคำขอลา
router.put('/leaves/:id/reject', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { rejectionReason } = req.body;
    const approverId = req.employee.id;

    if (!rejectionReason) {
        return res.status(400).json(responseHelpers.error(
            'กรุณาระบุเหตุผลในการปฏิเสธ',
            'REJECTION_REASON_REQUIRED'
        ));
    }

    // ตรวจสอบคำขอลา
    const [leaveRequests] = await dbConfig.execute(`
        SELECT lr.*, e.line_user_id, e.name
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        WHERE lr.id = ? AND lr.status = 'pending'
    `, [id]);

    if (leaveRequests.length === 0) {
        return res.status(404).json(responseHelpers.error(
            'ไม่พบคำขอลาที่สามารถปฏิเสธได้',
            'LEAVE_REQUEST_NOT_FOUND'
        ));
    }

    const leaveRequest = leaveRequests[0];

    // อัปเดตสถานะ
    await dbConfig.execute(
        'UPDATE leave_requests SET status = "rejected", approved_by = ?, rejection_reason = ?, approved_at = NOW(), updated_at = NOW() WHERE id = ?',
        [approverId, rejectionReason, id]
    );

    // ส่งการแจ้งเตือนผ่าน LINE
    if (leaveRequest.line_user_id) {
        await lineMessaging.sendLeaveApprovalNotification(leaveRequest.line_user_id, {
            status: 'rejected',
            leaveType: leaveRequest.leave_type,
            startDate: leaveRequest.start_date,
            endDate: leaveRequest.end_date,
            approvedBy: req.employee.name,
            rejectionReason: rejectionReason
        }).catch(error => {
            console.error('Failed to send LINE notification:', error);
        });
    }

    res.json(responseHelpers.success(null, 'ปฏิเสธคำขอลาเรียบร้อย'));
}));

// GET /reports/attendance - รายงานการเข้างาน
router.get('/reports/attendance', asyncHandler(async (req, res) => {
    const { startDate, endDate, employeeId, format = 'summary' } = req.query;
    
    const defaultStartDate = startDate || dateHelpers.formatDate(new Date(new Date().setDate(1)), 'YYYY-MM-DD');
    const defaultEndDate = endDate || dateHelpers.getCurrentDate();

    let whereClause = 'WHERE a.date BETWEEN ? AND ?';
    let params = [defaultStartDate, defaultEndDate];
    
    if (employeeId) {
        whereClause += ' AND a.employee_id = ?';
        params.push(employeeId);
    }

    if (format === 'detailed') {
        // รายงานแบบละเอียด
        const [records] = await dbConfig.execute(`
            SELECT a.*, e.name, e.employee_code, e.department, e.position
            FROM attendance a
            JOIN employees e ON a.employee_id = e.id
            ${whereClause}
            ORDER BY a.date DESC, e.name ASC
        `, params);

        const detailedReport = records.map(record => ({
            date: dateHelpers.formatDate(record.date),
            employee: {
                code: record.employee_code,
                name: record.name,
                department: record.department,
                position: record.position
            },
            checkIn: record.check_in_time ? dateHelpers.formatTime(record.check_in_time) : null,
            checkOut: record.check_out_time ? dateHelpers.formatTime(record.check_out_time) : null,
            workHours: record.work_hours,
            overtimeHours: record.overtime_hours,
            status: textHelpers.getStatusText(record.status),
            notes: record.notes
        }));

        res.json(responseHelpers.success(detailedReport, 'รายงานการเข้างานแบบละเอียด'));
    } else {
        // รายงานแบบสรุป
        const [summary] = await dbConfig.execute(`
            SELECT 
                e.id, e.name, e.employee_code, e.department,
                COUNT(a.id) as total_days,
                SUM(CASE WHEN a.status IN ('present', 'late') THEN 1 ELSE 0 END) as present_days,
                SUM(CASE WHEN a.status = 'late' THEN 1 ELSE 0 END) as late_days,
                SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_days,
                SUM(a.work_hours) as total_work_hours,
                SUM(a.overtime_hours) as total_overtime_hours,
                AVG(a.work_hours) as avg_work_hours
            FROM employees e
            LEFT JOIN attendance a ON e.id = a.employee_id AND a.date BETWEEN ? AND ?
            WHERE e.status = 'active'
            ${employeeId ? 'AND e.id = ?' : ''}
            GROUP BY e.id
            ORDER BY e.name
        `, employeeId ? [defaultStartDate, defaultEndDate, employeeId] : [defaultStartDate, defaultEndDate]);

        const summaryReport = summary.map(emp => ({
            employee: {
                id: emp.id,
                code: emp.employee_code,
                name: emp.name,
                department: emp.department
            },
            statistics: {
                totalDays: emp.total_days || 0,
                presentDays: emp.present_days || 0,
                lateDays: emp.late_days || 0,
                absentDays: emp.absent_days || 0,
                totalWorkHours: parseFloat(emp.total_work_hours || 0),
                totalOvertimeHours: parseFloat(emp.total_overtime_hours || 0),
                averageWorkHours: parseFloat(emp.avg_work_hours || 0),
                attendanceRate: emp.total_days > 0 ? 
                    ((emp.present_days / emp.total_days) * 100).toFixed(1) : 0
            }
        }));

        res.json(responseHelpers.success({
            period: {
                startDate: defaultStartDate,
                endDate: defaultEndDate
            },
            employees: summaryReport
        }, 'รายงานสรุปการเข้างาน'));
    }
}));

// รายการพนักงานสถานะ pending
router.get('/employees/pending', asyncHandler(async (req, res) => {
  const [rows] = await dbConfig.execute(`
    SELECT id, employee_code, name, department, position, phone, email, created_at
    FROM employees
    WHERE status = 'pending'
    ORDER BY created_at DESC
  `);
  res.json(responseHelpers.success(rows, 'รายการรออนุมัติ'));
}));

// อนุมัติพนักงาน
router.put('/employees/:id/approve', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const [result] = await dbConfig.execute(
    `UPDATE employees SET status='active', updated_at = NOW() WHERE id = ? AND status='pending'`,
    [id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json(responseHelpers.error('ไม่พบผู้สมัครที่รออนุมัติ', 'PENDING_NOT_FOUND'));
  }
  res.json(responseHelpers.success(null, 'อนุมัติเรียบร้อย'));
}));

// ปฏิเสธพนักงาน
router.put('/employees/:id/reject', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body || {};
  const [result] = await dbConfig.execute(
    `UPDATE employees SET status='inactive', rejection_reason = ?, updated_at = NOW() WHERE id = ? AND status='pending'`,
    [reason || null, id]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json(responseHelpers.error('ไม่พบผู้สมัครที่รออนุมัติ', 'PENDING_NOT_FOUND'));
  }
  res.json(responseHelpers.success(null, 'ปฏิเสธเรียบร้อย'));
}));



module.exports = router;