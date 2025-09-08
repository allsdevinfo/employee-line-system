const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

// สมัครด้วย JWT แบบ scope: ['onboarding'] ที่ได้จาก /api/auth/liff-login
router.post('/register', asyncHandler(async (req, res) => {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'missing token' });
  const token = auth.slice('Bearer '.length).trim();
  const payload = jwt.verify(token, JWT_SECRET);
  if (!payload.scope || !payload.scope.includes('onboarding')) {
    return res.status(403).json({ error: 'forbidden' });
  }

  const lineUserId = payload.sub;
  const { employeeCode, name, department, position, phone, email } = req.body;

  // ถ้ามีอยู่แล้วและ active → แจ้งซ้ำ
  const [exists] = await db.execute(
    'SELECT id, status FROM employees WHERE line_user_id = ? OR employee_code = ?',
    [lineUserId, employeeCode]
  );
  if (exists.length > 0) {
    const e = exists[0];
    if (e.status === 'active') return res.status(409).json({ error: 'already active' });
    if (e.status === 'pending') return res.status(202).json({ message: 'already pending' });
  }

  // บันทึกเป็น pending
  await db.execute(`
    INSERT INTO employees (line_user_id, employee_code, name, department, position, phone, email, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', NOW())
  `, [lineUserId, employeeCode, name, department, position, phone, email]);

  res.status(201).json({ message: 'registered as pending' });
}));

module.exports = router;
