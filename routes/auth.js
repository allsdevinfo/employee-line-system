const express = require('express');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch'); // ถ้าไม่มี ให้ `npm i node-fetch@2`
const db = require('../config/database');
const { asyncHandler } = require('../middleware/errorHandler');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';
const LINE_CHANNEL_ID = process.env.LINE_CHANNEL_ID; // ต้องตั้งค่าเพิ่มใน .env

// รับ id_token จาก LIFF แล้วตรวจสอบกับ LINE -> ออก JWT ฝั่งระบบเรา
router.post('/liff-login', asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'missing idToken' });

  // verify id_token กับ LINE
  const resp = await fetch('https://api.line.me/oauth2/v2.1/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `id_token=${encodeURIComponent(idToken)}&client_id=${encodeURIComponent(LINE_CHANNEL_ID)}`
  });
  const data = await resp.json();
  if (!data || !data.sub) {
    return res.status(401).json({ error: 'invalid idToken', details: data });
  }

  const lineUserId = data.sub;

  // map line_user_id -> employee (ต้องเป็น active)
  const [rows] = await db.execute(
    'SELECT * FROM employees WHERE line_user_id = ? AND status = "active"',
    [lineUserId]
  );

  if (rows.length === 0) {
    // ยังไม่ active -> อนุญาตเฉพาะอ่าน public หรือคู่กับ flow onboarding (ดูข้อ 4)
    // คืน JWT ที่ถือเพียง sub เพื่อใช้เรียก endpoint onboarding ได้
    const token = jwt.sign({ sub: lineUserId, scope: ['onboarding'] }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, onboarding: true });
  }

  const emp = rows[0];
  const token = jwt.sign({
    sub: lineUserId,
    empId: emp.id,
    role: emp.position || 'employee',
    scope: ['employee']
  }, JWT_SECRET, { expiresIn: '12h' });

  res.json({ token, onboarding: false, employee: { id: emp.id, name: emp.name } });
}));

router.get('/config', (req, res) => {
  res.json({ liffId: process.env.LIFF_ID });
});

module.exports = router;