// routes/leave.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { responseHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

router.post('/', asyncHandler(async (req, res) => {
  console.log('=== LEAVE REQUEST DEBUG ===');
  console.log('URL:', req.url);
  console.log('Method:', req.method);
  console.log('Content-Type:', req.headers['content-type']);
  console.log('Raw body:', req.body);
  console.log('Body type:', typeof req.body);
  console.log('Body keys:', Object.keys(req.body || {}));
  console.log('Employee from middleware:', req.employee ? {
    id: req.employee.id,
    name: req.employee.name
  } : 'NOT_FOUND');
  console.log('========================');

  // ตรวจสอบว่า middleware authenticateUser ทำงานหรือไม่
  if (!req.employee || !req.employee.id) {
    console.error('Employee not found in request - middleware auth failed');
    return res.status(401).json({
      error: 'ไม่พบข้อมูลพนักงาน กรุณาเข้าสู่ระบบใหม่',
      code: 'EMPLOYEE_NOT_FOUND'
    });
  }

  // ตรวจสอบว่า request body เป็น object
  if (!req.body || typeof req.body !== 'object') {
    console.error('Invalid request body:', req.body);
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง - ไม่พบ JSON body',
      code: 'INVALID_REQUEST_BODY',
      debug: {
        bodyType: typeof req.body,
        contentType: req.headers['content-type']
      }
    });
  }

  const { leaveType, startDate, endDate, reason } = req.body;
  const errors = [];

  console.log('Extracted leave data:', { leaveType, startDate, endDate, reason });

  // Validation แบบละเอียด
  if (!leaveType || String(leaveType).trim() === '') {
    errors.push('leaveType เป็นข้อมูลที่จำเป็น');
    console.log('Missing or empty leaveType:', leaveType);
  } else {
    const validLeaveTypes = ['sick', 'personal', 'vacation', 'emergency', 'maternity', 'paternity'];
    if (!validLeaveTypes.includes(leaveType)) {
      errors.push(`leaveType ต้องเป็นหนึ่งใน: ${validLeaveTypes.join(', ')}`);
      console.log('Invalid leaveType:', leaveType);
    }
  }

  if (!startDate || String(startDate).trim() === '') {
    errors.push('startDate เป็นข้อมูลที่จำเป็น');
    console.log('Missing or empty startDate:', startDate);
  } else {
    // ตรวจสอบรูปแบบวันที่
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startDate)) {
      errors.push('startDate ต้องเป็นรูปแบบ YYYY-MM-DD');
      console.log('Invalid startDate format:', startDate);
    }
  }

  if (!endDate || String(endDate).trim() === '') {
    errors.push('endDate เป็นข้อมูลที่จำเป็น');
    console.log('Missing or empty endDate:', endDate);
  } else {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(endDate)) {
      errors.push('endDate ต้องเป็นรูปแบบ YYYY-MM-DD');
      console.log('Invalid endDate format:', endDate);
    }
  }

  if (!reason || String(reason).trim() === '') {
    errors.push('reason เป็นข้อมูลที่จำเป็น');
    console.log('Missing or empty reason:', reason);
  } else {
    const trimmedReason = String(reason).trim();
    if (trimmedReason.length < 10) {
      errors.push('reason ต้องมีอย่างน้อย 10 ตัวอักษร');
      console.log('Reason too short:', trimmedReason.length);
    } else if (trimmedReason.length > 500) {
      errors.push('reason ต้องมีไม่เกิน 500 ตัวอักษร');
      console.log('Reason too long:', trimmedReason.length);
    }
  }

  if (errors.length) {
    console.log('Validation errors:', errors);
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      code: 'VALIDATION_ERROR',
      details: errors,
      debug: {
        receivedBody: req.body,
        contentType: req.headers['content-type'],
        bodyKeys: Object.keys(req.body || {}),
        extractedData: { leaveType, startDate, endDate, reason }
      }
    });
  }

  // ตรวจสอบวันที่เพิ่มเติม
  try {
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (endDateObj < startDateObj) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ถูกต้อง',
        code: 'VALIDATION_ERROR',
        details: ['วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น']
      });
    }

    // ตรวจสอบว่าวันเริ่มต้นไม่เป็นอดีต (ยกเว้นลาป่วย)
    if (leaveType !== 'sick' && startDateObj < today) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ถูกต้อง',
        code: 'VALIDATION_ERROR',
        details: ['วันที่เริ่มลาต้องไม่เป็นวันที่ผ่านมาแล้ว (ยกเว้นลาป่วย)']
      });
    }

    // คำนวณจำนวนวัน
    const daysDiff = Math.ceil((endDateObj - startDateObj) / (1000 * 60 * 60 * 24)) + 1;
    if (daysDiff > 30) {
      return res.status(400).json({
        error: 'ข้อมูลไม่ถูกต้อง',
        code: 'VALIDATION_ERROR',
        details: ['ไม่สามารถลาติดต่อกันเกิน 30 วันได้']
      });
    }

    console.log('Leave request validation passed. Days requested:', daysDiff);

  } catch (dateError) {
    console.error('Date parsing error:', dateError);
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      code: 'VALIDATION_ERROR',
      details: ['รูปแบบวันที่ไม่ถูกต้อง']
    });
  }

  const employeeId = req.employee.id;
  console.log('Inserting leave request for employee:', employeeId);

  try {
    const [result] = await db.execute(
      `INSERT INTO leave_requests
        (employee_id, leave_type, start_date, end_date, reason, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      [employeeId, leaveType, startDate, endDate, reason.trim()]
    );

    console.log('Leave request inserted successfully with ID:', result.insertId);
    
    return res.status(201).json(
      responseHelpers.success({
        id: result.insertId,
        status: 'pending'
      }, 'ส่งคำขอลาเรียบร้อยแล้ว รอการอนุมัติ')
    );
    
  } catch (dbError) {
    console.error('Database error:', dbError);
    return res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล',
      code: 'DATABASE_ERROR',
      debug: process.env.NODE_ENV === 'development' ? dbError.message : undefined
    });
  }
}));

module.exports = router;