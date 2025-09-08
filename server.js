// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbConfig = require('./config/database');
const lineConfig = require('./config/line');

const { errorHandler } = require('./middleware/errorHandler');
const { authenticateUser } = require('./middleware/auth');

// routes
const apiRoutes = require('./routes/api');
const employeeRoutes = require('./routes/employee');                 // default export = router
const { openRouter: employeeOpenRouter } = require('./routes/employee');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leave');
const adminRoutes = require('./routes/admin');
const webhookRoutes = require('./routes/webhook');
const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== middleware base =====
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-User-ID','X-Line-Signature','X-Admin-Key']
}));
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));
app.use(express.static(path.join(__dirname, 'public')));



// basic headers
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-XSS-Protection','1; mode=block');
  next();
});

// ===== health / config =====
app.get('/health', (req,res)=> {
  res.json({ status:'OK', timestamp:new Date().toISOString() });
});

app.get('/config.js', (req,res)=> {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.send(`window.__APP_CONFIG__=${JSON.stringify({
    LIFF_ID: process.env.LIFF_ID || '',
    API_BASE: '/api',
    ENV: process.env.NODE_ENV || 'development'
  })};`);
});

// ===== public routes (no auth) =====
app.use('/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/onboarding', onboardingRoutes);

// ===== API namespacing =====
app.use('/api', apiRoutes);
app.use('/api/admin', adminRoutes); // มี auth ภายในเอง

// ---- Employee routes ----
// เปิด public ของ employee ใต้ /api/employee
if (employeeOpenRouter) {
  app.use('/api/employee', employeeOpenRouter);
}
// หลัก: ต้อง auth ทั้งก้อน (เรา auth ทีละ route ภายในไฟล์แล้วก็ได้)
app.use('/api/employee', employeeRoutes);

// ---- Attendance & Leave (ต้อง auth) ----
app.use('/api/attendance', authenticateUser, attendanceRoutes);
app.use('/api/leave', authenticateUser, leaveRoutes);


// ===== serve app =====
app.get('/', (req,res)=> {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req,res)=> {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error:'API endpoint not found', path:req.path, method:req.method });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== error handler =====
app.use(errorHandler);

// ===== start =====
(async function start() {
  try {
    console.log('🔌 Connecting DB...');
    await dbConfig.testConnection();
    console.log('✅ DB OK');

    const lineStatus = await lineConfig.testConnection().catch(()=>({success:false}));
    console.log(lineStatus?.success ? '✅ LINE config OK' : '⚠️ LINE config not verified');

    app.listen(PORT, ()=> {
      console.log(`🚀 Server on :${PORT}`);
    });
  } catch (e) {
    console.error('❌ Start failed:', e);
    process.exit(1);
  }
})();
