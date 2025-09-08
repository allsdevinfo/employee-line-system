// middleware/auth.js
const dbConfig = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

// Middleware สำหรับตรวจสอบ LINE User ID
async function authenticateUser(req, res, next) {
  try {
    console.log('=== AUTH MIDDLEWARE DEBUG ===');
    console.log('URL:', req.url);
    console.log('Method:', req.method);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Body preview:', JSON.stringify(req.body).substring(0, 200));

    let lineUserId = null;

    // ลอง JWT token ก่อน
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        lineUserId = payload.sub;
        console.log('JWT User ID found:', lineUserId);
      } catch (jwtError) {
        console.log('JWT verification failed:', jwtError.message);
      }
    }

    // ลองหา X-User-ID จากหลายแหล่ง (รองรับ ngrok proxy)
    if (!lineUserId) {
      lineUserId = req.headers['x-user-id'] || 
                   req.headers['X-User-ID'] || 
                   req.get('X-User-ID') ||
                   req.get('x-user-id');
      console.log('Header User ID found:', lineUserId);
    }

    if (!lineUserId) {
      console.log('No User ID found in request');
      return res.status(401).json({
        error: 'ไม่พบ LINE User ID',
        code: 'MISSING_USER_ID',
        debug: {
          availableHeaders: Object.keys(req.headers),
          authHeader: !!req.headers['authorization'],
          userIdHeader: !!req.headers['x-user-id']
        }
      });
    }

    // ค้นหาพนักงานในฐานข้อมูล
    const [rows] = await dbConfig.execute(
      'SELECT * FROM employees WHERE line_user_id = ? AND status = "active"',
      [lineUserId]
    );

    console.log('Database lookup result:', rows.length, 'employees found');

    if (!rows.length) {
      // ตรวจสอบว่ามีในระบบแต่ยังไม่ active
      const [anyEmployee] = await dbConfig.execute(
        'SELECT status FROM employees WHERE line_user_id = ? LIMIT 1',
        [lineUserId]
      );
      
      if (anyEmployee.length > 0) {
        const status = anyEmployee[0].status;
        console.log('Employee found but status:', status);
        return res.status(403).json({
          error: status === 'pending' ? 'บัญชีกำลังรอการอนุมัติจาก HR' : 'บัญชีถูกระงับ',
          code: status === 'pending' ? 'PENDING_APPROVAL' : 'ACCOUNT_SUSPENDED',
          debug: { status, lineUserId }
        });
      }

      console.log('No employee found with this LINE ID');
      return res.status(404).json({
        error: 'ไม่พบข้อมูลพนักงาน หรือบัญชีถูกระงับ',
        code: 'EMPLOYEE_NOT_FOUND',
        debug: { lineUserId }
      });
    }

    const employee = rows[0];
    req.employee = employee;
    req.lineUserId = lineUserId;
    
    console.log('Employee authenticated:', {
      id: employee.id,
      name: employee.name,
      position: employee.position
    });
    console.log('========================');
    
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({
      error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์',
      code: 'AUTH_ERROR',
      debug: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
}

// Middleware สำหรับตรวจสอบสิทธิ์แอดมิน
async function authenticateAdmin(req, res, next) {
    try {
        console.log('=== ADMIN AUTH DEBUG ===');
        console.log('Headers:', Object.keys(req.headers));

        const adminKey = req.headers['x-admin-key'] || req.headers['X-Admin-Key'];
        const lineUserId = req.headers['x-user-id'] || req.headers['X-User-ID'];
        
        console.log('Admin key provided:', !!adminKey);
        console.log('Line user ID provided:', !!lineUserId);
        
        // ตรวจสอบ Admin Key (สำหรับระบบภายนอก)
        if (adminKey && adminKey === process.env.ADMIN_API_KEY) {
            console.log('Admin key authentication successful');
            req.isAdmin = true;
            req.employee = {
                id: 0,
                name: 'System Admin',
                position: 'Administrator',
                isAdmin: true
            };
            return next();
        }
        
        // ตรวจสอบผ่าน LINE User ID (สำหรับแอดมินที่เป็นพนักงาน)
        if (lineUserId) {
            const [employees] = await dbConfig.execute(
                'SELECT * FROM employees WHERE line_user_id = ?',
                [lineUserId]
            );
            
            console.log('Found employees for admin check:', employees.length);
            
            if (employees.length === 0) {
                return res.status(404).json({
                    error: 'ไม่พบข้อมูลพนักงาน',
                    code: 'EMPLOYEE_NOT_FOUND'
                });
            }
            
            // หาพนักงานที่ active
            const activeEmp = employees.find(e => e.status === 'active');
            if (!activeEmp) {
                return res.status(403).json({
                    error: 'บัญชีกำลังรอการอนุมัติจาก HR',
                    code: 'PENDING_APPROVAL'
                });
            }

            req.employee = activeEmp;
            
            // ตรวจสอบว่าเป็นตำแหน่งที่มีสิทธิ์แอดมิน
            const adminPositions = ['หัวหน้าแผนกขาย', 'HR Officer', 'ผู้จัดการ', 'ผู้อำนวยการ'];
            
            if (adminPositions.includes(activeEmp.position)) {
                console.log('Employee has admin position:', activeEmp.position);
                req.isAdmin = true;
                return next();
            } else {
                console.log('Employee does not have admin privileges:', activeEmp.position);
            }
        }
        
        console.log('Admin authentication failed');
        return res.status(403).json({ 
            error: 'ไม่มีสิทธิ์เข้าถึงระบบแอดมิน',
            code: 'INSUFFICIENT_PRIVILEGES',
            debug: {
                hasAdminKey: !!adminKey,
                hasLineUserId: !!lineUserId,
                validAdminKey: adminKey === process.env.ADMIN_API_KEY
            }
        });
        
    } catch (error) {
        console.error('Admin authentication error:', error);
        res.status(500).json({ 
            error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์แอดมิน',
            code: 'ADMIN_AUTH_ERROR'
        });
    }
}

// Middleware สำหรับ rate limiting
const rateLimitMap = new Map();

function rateLimit(maxRequests = 100, windowMs = 15 * 60 * 1000) {
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress || 'unknown';
        const now = Date.now();
        
        if (!rateLimitMap.has(key)) {
            rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
            return next();
        }
        
        const limit = rateLimitMap.get(key);
        
        if (now > limit.resetTime) {
            limit.count = 1;
            limit.resetTime = now + windowMs;
            return next();
        }
        
        if (limit.count >= maxRequests) {
            return res.status(429).json({
                error: 'มีการร้องขอมากเกินไป กรุณาลองใหม่ในภายหลัง',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfter: Math.ceil((limit.resetTime - now) / 1000)
            });
        }
        
        limit.count++;
        next();
    };
}

// Middleware สำหรับ logging requests
function requestLogger(req, res, next) {
    const startTime = Date.now();
    const originalSend = res.send;
    
    res.send = function(data) {
        const duration = Date.now() - startTime;
        const logData = {
            method: req.method,
            url: req.originalUrl,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip,
            employee: req.employee ? {
                id: req.employee.id,
                name: req.employee.name,
                position: req.employee.position
            } : null,
            timestamp: new Date().toISOString()
        };
        
        // Log เฉพาะ error หรือ requests ที่สำคัญ
        if (res.statusCode >= 400 || req.url.includes('/api/')) {
            console.log('API Request:', JSON.stringify(logData, null, 2));
        }
        
        originalSend.call(this, data);
    };
    
    next();
}

module.exports = {
    authenticateUser,
    authenticateAdmin,
    rateLimit,
    requestLogger
};