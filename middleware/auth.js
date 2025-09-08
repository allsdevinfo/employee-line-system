// middleware/auth.js
const dbConfig = require('../config/database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me';


// Middleware สำหรับตรวจสอบ LINE User ID
async function authenticateUser(req, res, next) {
  try {
    let lineUserId = null;

    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      const token = auth.slice('Bearer '.length).trim();
      try {
        const payload = jwt.verify(token, JWT_SECRET);
        lineUserId = payload.sub;
      } catch {
        return res.status(401).json({ error: 'invalid token', code: 'INVALID_TOKEN' });
      }
    }

    if (!lineUserId) lineUserId = req.headers['x-user-id'];
    if (!lineUserId) {
      return res.status(401).json({ error: 'ไม่พบ LINE User ID', code: 'MISSING_USER_ID' });
    }

    const [rows] = await dbConfig.execute(
      'SELECT * FROM employees WHERE line_user_id = ? AND status = "active"',
      [lineUserId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'ไม่พบข้อมูลพนักงาน หรือบัญชีถูกระงับ', code: 'EMPLOYEE_NOT_FOUND' });
    }

    req.employee = rows[0];
    req.lineUserId = lineUserId;
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    res.status(500).json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์', code: 'AUTH_ERROR' });
  }
}

// Middleware สำหรับตรวจสอบสิทธิ์แอดมิน
async function authenticateAdmin(req, res, next) {
    try {
        const adminKey = req.headers['x-admin-key'];
        const lineUserId = req.headers['x-user-id'];
        
        // ตรวจสอบ Admin Key (สำหรับระบบภายนอก)
        if (adminKey && adminKey === process.env.ADMIN_API_KEY) {
            req.isAdmin = true;
            return next();
        }
        
        // ตรวจสอบผ่าน LINE User ID (สำหรับแอดมินที่เป็นพนักงาน)
        if (lineUserId) {
            // const employees = await dbConfig.execute(
            //     `SELECT e.*, p.title as position_title 
            //      FROM employees e 
            //      LEFT JOIN positions p ON e.position = p.title 
            //      WHERE e.line_user_id = ? AND e.status = "active"`,
            //     [lineUserId]
            // );
            const [anyEmp] = await dbConfig.execute(
                    'SELECT * FROM employees WHERE line_user_id = ?',
                    [lineUserId]
                );
                // ไม่พบเลย
                if (anyEmp.length === 0) {
                    return res.status(404).json({
                        error: 'ไม่พบข้อมูลพนักงาน',
                    code: 'EMPLOYEE_NOT_FOUND'          });
                }
                // พบแต่ยังไม่อนุมัติ
                const activeEmp = anyEmp.find(e => e.status === 'active');
                if (!activeEmp) {
                    return res.status(403).json({
                        error: 'บัญชีกำลังรอการอนุมัติจาก HR',
                        code: 'PENDING_APPROVAL'
                    });
            }

            // if (employees.length === 0) {
            //     return res.status(404).json({ 
            //         error: 'ไม่พบข้อมูลพนักงาน',
            //         code: 'EMPLOYEE_NOT_FOUND'
            //     });
            // }
            req.employee = activeEmp;
            // const employee = employees[0];
            
            // ตรวจสอบว่าเป็นตำแหน่งที่มีสิทธิ์แอดมิน
            const adminPositions = ['หัวหน้าแผนกขาย', 'HR Officer', 'ผู้จัดการ', 'ผู้อำนวยการ'];
            
            if (adminPositions.includes(employee.position)) {
                req.employee = employee;
                req.isAdmin = true;
                return next();
            }
        }
        
        return res.status(403).json({ 
            error: 'ไม่มีสิทธิ์เข้าถึงระบบแอดมิน',
            code: 'INSUFFICIENT_PRIVILEGES'
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
        const key = req.ip || req.connection.remoteAddress;
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
        
        console.log('API Request:', JSON.stringify(logData, null, 2));
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