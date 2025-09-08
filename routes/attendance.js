// routes/attendance.js
const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { responseHelpers, dateHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');
const { authenticateUser } = require('../middleware/auth');

router.use(authenticateUser);


// GET /api/attendance/today
router.get('/today', async (req, res) => {
  try {
    const e = req.employee;                               // จาก authenticateUser
    const today = new Date().toISOString().slice(0,10);   // YYYY-MM-DD

    const [rows] = await db.execute(
      `SELECT id, date, check_in_time, check_out_time, work_hours, overtime_hours, status, notes
         FROM attendance
        WHERE employee_id = ? AND date = ? LIMIT 1`,
      [e.id, today]
    );

    if (!rows.length) {
      return res.json({
        success: true,
        data: { hasData: false },
        message: 'ไม่มีข้อมูลวันนี้'
      });
    }

    const r = rows[0];
    const hasIn  = !!r.check_in_time;
    const hasOut = !!r.check_out_time;

    const fmtTime = (t) => t ? new Date(t).toTimeString().slice(0,5) : null;

    const payload = {
      hasData: true,
      checkInTime:  hasIn  ? fmtTime(r.check_in_time)  : null,
      checkOutTime: hasOut ? fmtTime(r.check_out_time) : null,
      currentWorkHours: r.work_hours ?? 0,
      finalWorkHours:   hasOut ? (r.work_hours ?? 0) : null,
      isWorkingNow: hasIn && !hasOut,
      isComplete:   hasIn && hasOut,
      status: r.status || null,
      notes:  r.notes  || null,
    };

    return res.json({ success: true, data: payload, message: 'สถานะวันนี้' });
  } catch (err) {
    console.error('ATT_TODAY_ERROR', err);
    return res.status(500).json({
      error: 'ไม่สามารถดึงสถานะวันนี้',
      code: 'ATT_TODAY_ERROR'
    });
  }
});

// POST /api/attendance
router.post('/', authenticateUser, asyncHandler(async (req, res) => {
  const { action, location } = req.body || {};
  const errors = [];

  if (!action || !['checkin', 'checkout'].includes(action)) {
    errors.push('action ต้องเป็น checkin หรือ checkout');
  }
  if (!location || typeof location !== 'object') {
    errors.push('location เป็นข้อมูลที่จำเป็น');
  } else {
    if (typeof location.latitude !== 'number')  errors.push('location.latitude เป็นตัวเลขที่จำเป็น');
    if (typeof location.longitude !== 'number') errors.push('location.longitude เป็นตัวเลขที่จำเป็น');
  }

  if (errors.length) {
    return res.status(400).json({
      error: 'ข้อมูลไม่ถูกต้อง',
      code: 'VALIDATION_ERROR',
      details: errors
    });
  }

  const employeeId = req.employee.id;
  const today = dateHelpers.getCurrentDate();

  // ดึงบันทึกของวันนี้
  const [rows] = await db.execute(
    'SELECT * FROM attendance WHERE employee_id = ? AND date = ? LIMIT 1',
    [employeeId, today]
  );
  const now = new Date();

  if (action === 'checkin') {
    if (rows.length) {
      if (rows[0].check_in_time) {
        return res.status(409).json({
          error: 'เช็คอินไปแล้ว',
          code: 'ALREADY_CHECKED_IN'
        });
      }
      await db.execute(
        `UPDATE attendance SET check_in_time = ?, updated_at = NOW()
         WHERE id = ?`,
        [now, rows[0].id]
      );
    } else {
      await db.execute(
        `INSERT INTO attendance (employee_id, date, check_in_time, status, created_at, updated_at)
         VALUES (?, ?, ?, 'present', NOW(), NOW())`,
        [employeeId, today, now]
      );
    }

    return res.json(responseHelpers.success(null, 'เช็คอินสำเร็จ'));
  }

  // checkout
  if (!rows.length || !rows[0].check_in_time) {
    return res.status(400).json({
      error: 'ยังไม่ได้เช็คอิน',
      code: 'NOT_CHECKED_IN'
    });
  }
  if (rows[0].check_out_time) {
    return res.status(409).json({
      error: 'เช็คเอาท์ไปแล้ว',
      code: 'ALREADY_CHECKED_OUT'
    });
  }

  // คำนวณชั่วโมงทำงานอย่างง่าย
  const start = new Date(rows[0].check_in_time);
  const workHours = Math.max(0, (now - start) / 36e5); // ชั่วโมง

  await db.execute(
    `UPDATE attendance
     SET check_out_time = ?, work_hours = ?, updated_at = NOW()
     WHERE id = ?`,
    [now, workHours, rows[0].id]
  );

  return res.json(responseHelpers.success(null, 'เช็คเอาท์สำเร็จ'));
}));

module.exports = router;
