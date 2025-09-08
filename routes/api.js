// routes/api.js
const express = require('express');
const router = express.Router();
const dbConfig = require('../config/database');
const { responseHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// GET /api - API Information
router.get('/', (req, res) => {
    res.json(responseHelpers.success({
        name: 'Employee LINE System API',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            employee: '/api/employee/*',
            attendance: '/api/attendance/*',
            leave: '/api/leave/*',
            admin: '/api/admin/*',
            webhook: '/webhook'
        },
        documentation: 'https://your-docs-url.com'
    }, 'API Information'));
});

// GET /api/health - Health Check
router.get('/health', asyncHandler(async (req, res) => {
    const dbHealth = await dbConfig.healthCheck();
    const stats = await dbConfig.getDatabaseStats();
    
    res.json(responseHelpers.success({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: dbHealth,
        statistics: stats,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
    }, 'System is healthy'));
}));

// GET /api/settings - System Settings (ไม่ต้องใช้ auth)
router.get('/settings', asyncHandler(async (req, res) => {
    const publicSettings = await dbConfig.execute(`
        SELECT setting_key, setting_value, description 
        FROM system_settings 
        WHERE setting_key IN (
            'company_name', 
            'work_start_time', 
            'work_end_time',
            'checkin_radius_meters'
        ) AND is_active = TRUE
    `);
    
    const settings = {};
    publicSettings.forEach(setting => {
        settings[setting.setting_key] = setting.setting_value;
    });
    
    res.json(responseHelpers.success(settings, 'Public settings retrieved'));
}));

// POST /api/auth/identify - ระบุตัวตนผู้ใช้ LIFF + ลงทะเบียน pending อัตโนมัติ
router.post('/auth/identify', asyncHandler(async (req, res) => {
    try {
  const lineUserId = req.get('X-User-ID') || req.body?.lineUserId;
  const displayName = req.body?.displayName || null;
  if (!lineUserId) {
    return res.status(400).json(responseHelpers.error('Missing X-User-ID', 'MISSING_USER_ID'));
  }

  // มีอยู่แล้วหรือไม่
  const [rows] = await dbConfig.execute(
    'SELECT * FROM employees WHERE line_user_id = ? LIMIT 1',
    [lineUserId]
  );

  if (rows.length > 0) {
    const emp = rows[0];
    const payload = {
      id: emp.id,
      name: emp.name,
      employeeCode: emp.employee_code,
      status: emp.status
    };
    if (emp.status === 'active') {
      return res.json(responseHelpers.success(payload, 'active employee'));
    }
    if (emp.status === 'pending') {
      return res.status(202).json(responseHelpers.success(payload, 'waiting for HR approval'));
    }
    return res.status(403).json(responseHelpers.error('บัญชีถูกระงับ', 'ACCOUNT_INACTIVE', payload));
  }

  // ยังไม่มี -> สร้าง pending
  const nameForPending = displayName || '(รอตรวจสอบ)';
  const [ins] = await dbConfig.execute(
    `INSERT INTO employees (line_user_id, name, status, created_at, updated_at)
     VALUES (?, ?, 'pending', NOW(), NOW())`,
    [lineUserId, nameForPending]
  );

  return res.status(202).json(responseHelpers.success({
    id: ins.insertId,
    name: nameForPending,
    status: 'pending'
  }, 'สมัครเรียบร้อย รอ HR อนุมัติ'));
  } catch (e) {
    return res.status(500).json(responseHelpers.error('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์', 'IDENTIFY_ERROR'));
  }
}));



// GET /api/departments - ข้อมูลแผนกทั้งหมด
router.get('/departments', asyncHandler(async (req, res) => {
    const departments = await dbConfig.execute(`
        SELECT id, name, description, location, status
        FROM departments 
        WHERE status = 'active'
        ORDER BY name
    `);
    
    res.json(responseHelpers.success(departments, 'Departments retrieved'));
}));

// GET /api/positions - ข้อมูลตำแหน่งทั้งหมด
router.get('/positions', asyncHandler(async (req, res) => {
    const positions = await dbConfig.execute(`
        SELECT p.id, p.title, p.description, p.min_salary, p.max_salary,
               d.name as department_name
        FROM positions p
        LEFT JOIN departments d ON p.department_id = d.id
        WHERE p.status = 'active'
        ORDER BY d.name, p.title
    `);
    
    res.json(responseHelpers.success(positions, 'Positions retrieved'));
}));

// GET /api/stats - สถิติระบบ
router.get('/stats', asyncHandler(async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const [
        totalEmployees,
        todayAttendance,
        pendingLeaves,
        monthlyStats
    ] = await Promise.all([
        dbConfig.execute('SELECT COUNT(*) as count FROM employees WHERE status = "active"'),
        dbConfig.execute('SELECT COUNT(*) as count FROM attendance WHERE date = ?', [today]),
        dbConfig.execute('SELECT COUNT(*) as count FROM leave_requests WHERE status = "pending"'),
        dbConfig.execute(`
            SELECT 
                COUNT(DISTINCT employee_id) as active_employees,
                SUM(work_hours) as total_work_hours,
                SUM(overtime_hours) as total_overtime_hours,
                AVG(work_hours) as avg_work_hours
            FROM attendance 
            WHERE date >= DATE_FORMAT(NOW(), '%Y-%m-01')
        `)
    ]);
    
    const stats = {
        employees: {
            total: totalEmployees[0].count,
            checkedInToday: todayAttendance[0].count
        },
        leaves: {
            pending: pendingLeaves[0].count
        },
        monthly: {
            activeEmployees: monthlyStats[0].active_employees || 0,
            totalWorkHours: parseFloat(monthlyStats[0].total_work_hours || 0),
            totalOvertimeHours: parseFloat(monthlyStats[0].total_overtime_hours || 0),
            averageWorkHours: parseFloat(monthlyStats[0].avg_work_hours || 0)
        }
    };
    
    res.json(responseHelpers.success(stats, 'System statistics'));
}));

// Error handling for this router
router.use((error, req, res, next) => {
    console.error('API Route Error:', error);
    res.status(500).json(responseHelpers.error(
        'เกิดข้อผิดพลาดในระบบ API',
        'API_ERROR',
        process.env.NODE_ENV === 'development' ? error.message : null
    ));
});

// GET /api/config - public config for LIFF
router.get('/config', (req, res) => {
  res.json(responseHelpers.success({
    liffId: process.env.LIFF_ID || null,
    env: process.env.NODE_ENV || 'development',
    companyName: process.env.COMPANY_NAME || 'Company',
  }, 'Public config'));
});

module.exports = router;