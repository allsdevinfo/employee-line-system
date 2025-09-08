// routes/leave.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { responseHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');

// ให้ router ตัวนี้ parse JSON เองด้วย (กันพลาดลำดับ middleware)
router.use(express.json());

// อย่าซ้อน auth หลายชั้นเกินจำเป็น; แนบแค่ที่ route หรือให้ server.js เป็นคนแนบ ก็พอ
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
  const { leaveType, startDate, endDate, reason } = req.body || {};
  const errors = [];

  if (!leaveType) errors.push('leaveType เป็นข้อมูลที่จำเป็น');
  if (!startDate) errors.push('startDate เป็นข้อมูลที่จำเป็น');
  if (!endDate)   errors.push('endDate เป็นข้อมูลที่จำเป็น');
  if (!reason)    errors.push('reason เป็นข้อมูลที่จำเป็น');

  if (errors.length) {
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }

  if (new Date(endDate) < new Date(startDate)) {
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      code: 'VALIDATION_ERROR',
      details: ['endDate ต้องไม่ก่อน startDate']
    });
  }

  const employeeId = req.employee.id;

  await db.execute(
    `INSERT INTO leave_requests
      (employee_id, leave_type, start_date, end_date, reason, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
    [employeeId, leaveType, startDate, endDate, reason]
  );

  return res.status(201).json(
    responseHelpers.success(null, 'ส่งคำขอลาเรียบร้อยแล้ว รอการอนุมัติ')
  );
}));

module.exports = router;
