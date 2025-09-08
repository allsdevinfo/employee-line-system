// server.js
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbConfig = require('./config/database');
const lineConfig = require('./config/line');

const { errorHandler } = require('./middleware/errorHandler');
const { authenticateUser, requestLogger } = require('./middleware/auth');

// routes
const apiRoutes = require('./routes/api');
const employeeRoutes = require('./routes/employee');
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

// ฟิกซ์สำหรับ LIFF ที่ส่ง content-type เป็น text/plain
app.use((req, res, next) => {
  // ถ้าเป็น POST/PUT และมี content-type เป็น text/plain แต่ body ดูเหมือน JSON
  if ((req.method === 'POST' || req.method === 'PUT') && 
      req.headers['content-type'] && 
      req.headers['content-type'].includes('text/plain')) {
    
    console.log('Detected text/plain content-type, converting to application/json');
    req.headers['content-type'] = 'application/json';
  }
  next();
});

// Raw body parser สำหรับ text/plain ที่เป็น JSON
app.use('/api', express.raw({ type: 'text/plain', limit: '10mb' }));

// Custom JSON parser ที่รองรับ text/plain
app.use('/api', (req, res, next) => {
  if (req.body && Buffer.isBuffer(req.body)) {
    try {
      const bodyStr = req.body.toString('utf8');
      console.log('Raw body string:', bodyStr);
      
      if (bodyStr.trim()) {
        req.body = JSON.parse(bodyStr);
        console.log('Parsed JSON from text/plain:', req.body);
      } else {
        req.body = {};
      }
    } catch (e) {
      console.error('Failed to parse body as JSON:', e.message);
      req.body = {};
    }
  }
  next();
});

// Standard JSON parser
app.use(express.json({ limit:'10mb' }));
app.use(express.urlencoded({ extended:true, limit:'10mb' }));

// Debug middleware สำหรับ ngrok
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    if (req.path.includes('/api/leave') || req.path.includes('/api/attendance')) {
      console.log('=== FINAL REQUEST DEBUG ===');
      console.log('Method:', req.method);
      console.log('URL:', req.url);
      console.log('Final Content-Type:', req.headers['content-type']);
      console.log('Final Body:', req.body);
      console.log('Body type:', typeof req.body);
      console.log('Body keys:', Object.keys(req.body || {}));
      console.log('========================');
    }
    next();
  });
}

app.use(express.static(path.join(__dirname, 'public')));

// basic headers
app.use((req,res,next)=>{
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('X-XSS-Protection','1; mode=block');
  next();
});

// เพิ่ม request logger สำหรับ development
if (process.env.NODE_ENV === 'development') {
  app.use(requestLogger);
}

// ===== health / config =====
app.get('/health', (req,res)=> {
  res.json({ 
    status:'OK', 
    timestamp:new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
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
if (employeeOpenRouter) {
  app.use('/api/employee', employeeOpenRouter);
}
app.use('/api/employee', employeeRoutes);

// ---- Attendance & Leave (ต้อง auth) ----
console.log('Setting up /api/attendance route with auth');
app.use('/api/attendance', authenticateUser, attendanceRoutes);

console.log('Setting up /api/leave route with auth');
app.use('/api/leave', authenticateUser, leaveRoutes);

// ===== serve app =====
app.get('/', (req,res)=> {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('*', (req,res)=> {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ 
      error:'API endpoint not found', 
      path:req.path, 
      method:req.method,
      availableRoutes: ['/api/leave', '/api/attendance', '/api/employee', '/api/admin']
    });
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
    console.log(lineStatus?.success ? '✅ LINE config OK' : '⚠ LINE config not verified');

    console.log('📚 Routes configured:');
    console.log('  - /api/leave (with auth + content-type fix)');
    console.log('  - /api/attendance (with auth + content-type fix)');
    console.log('  - /api/employee (mixed auth)');
    console.log('  - /api/admin (internal auth)');
    
    app.listen(PORT, ()=> {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('🔧 Content-Type fix enabled for LIFF compatibility');
    });
  } catch (e) {
    console.error('❌ Start failed:', e);
    process.exit(1);
  }
})();