// middleware/errorHandler.js

class AppError extends Error {
    constructor(message, statusCode, code = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        
        Error.captureStackTrace(this, this.constructor);
    }
}

// การจัดการ error สำหรับ database
function handleDatabaseError(error) {
    let message = 'เกิดข้อผิดพลาดในฐานข้อมูล';
    let statusCode = 500;
    let code = 'DATABASE_ERROR';

    switch (error.code) {
        case 'ER_DUP_ENTRY':
            message = 'ข้อมูลซ้ำ กรุณาตรวจสอบข้อมูลที่ป้อน';
            statusCode = 400;
            code = 'DUPLICATE_ENTRY';
            break;
            
        case 'ER_NO_REFERENCED_ROW_2':
            message = 'ไม่พบข้อมูลที่เกี่ยวข้อง';
            statusCode = 400;
            code = 'FOREIGN_KEY_ERROR';
            break;
            
        case 'ER_ROW_IS_REFERENCED_2':
            message = 'ไม่สามารถลบข้อมูลได้ เนื่องจากมีข้อมูลอื่นที่เกี่ยวข้อง';
            statusCode = 400;
            code = 'REFERENCED_DATA';
            break;
            
        case 'ER_BAD_FIELD_ERROR':
            message = 'ข้อมูลไม่ถูกต้อง';
            statusCode = 400;
            code = 'INVALID_FIELD';
            break;
            
        case 'ECONNREFUSED':
            message = 'ไม่สามารถเชื่อมต่อฐานข้อมูลได้';
            statusCode = 503;
            code = 'DATABASE_CONNECTION_ERROR';
            break;
            
        case 'ER_ACCESS_DENIED_ERROR':
            message = 'ไม่มีสิทธิ์เข้าถึงฐานข้อมูล';
            statusCode = 503;
            code = 'DATABASE_ACCESS_DENIED';
            break;
    }

    return new AppError(message, statusCode, code);
}

// การจัดการ error สำหรับ LINE API
function handleLineError(error) {
    let message = 'เกิดข้อผิดพลาดในการเชื่อมต่อ LINE';
    let statusCode = 500;
    let code = 'LINE_API_ERROR';

    if (error.originalError) {
        switch (error.originalError.response?.status) {
            case 400:
                message = 'ข้อมูลที่ส่งไป LINE ไม่ถูกต้อง';
                statusCode = 400;
                code = 'LINE_BAD_REQUEST';
                break;
                
            case 401:
                message = 'การตรวจสอบสิทธิ์ LINE ล้มเหลว';
                statusCode = 401;
                code = 'LINE_UNAUTHORIZED';
                break;
                
            case 403:
                message = 'ไม่มีสิทธิ์ใช้งาน LINE API';
                statusCode = 403;
                code = 'LINE_FORBIDDEN';
                break;
                
            case 429:
                message = 'การใช้งาน LINE API เกินขั้นตอน';
                statusCode = 429;
                code = 'LINE_RATE_LIMIT';
                break;
        }
    }

    return new AppError(message, statusCode, code);
}

// Main error handler middleware
function errorHandler(error, req, res, next) {
    let err = error;

    // Log error สำหรับ debugging
    console.error('Error occurred:', {
        message: error.message,
        stack: error.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        employee: req.employee ? {
            id: req.employee.id,
            name: req.employee.name
        } : null,
        timestamp: new Date().toISOString()
    });

    // แปลง error ให้เป็น AppError
    if (!err.isOperational) {
        if (err.code && err.code.startsWith('ER_')) {
            err = handleDatabaseError(err);
        } else if (err.name === 'HTTPError' && err.originalError) {
            err = handleLineError(err);
        } else if (err.name === 'ValidationError') {
            err = new AppError('ข้อมูลไม่ถูกต้อง', 400, 'VALIDATION_ERROR');
        } else if (err.name === 'JsonWebTokenError') {
            err = new AppError('Token ไม่ถูกต้อง', 401, 'INVALID_TOKEN');
        } else if (err.name === 'TokenExpiredError') {
            err = new AppError('Token หมดอายุ', 401, 'EXPIRED_TOKEN');
        } else if (err.name === 'SyntaxError' && err.type === 'entity.parse.failed') {
            err = new AppError('รูปแบบ JSON ไม่ถูกต้อง', 400, 'INVALID_JSON');
        } else {
            // Unknown error
            err = new AppError(
                process.env.NODE_ENV === 'production' 
                    ? 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' 
                    : error.message,
                500,
                'INTERNAL_SERVER_ERROR'
            );
        }
    }

    // สร้าง response object
    const response = {
        error: err.message,
        code: err.code || 'UNKNOWN_ERROR',
        timestamp: new Date().toISOString()
    };

    // เพิ่มข้อมูลเพิ่มเติมสำหรับ development
    if (process.env.NODE_ENV === 'development') {
        response.stack = error.stack;
        response.details = {
            originalError: error.message,
            url: req.originalUrl,
            method: req.method
        };
    }

    // ส่ง response
    res.status(err.statusCode || 500).json(response);
}

// Wrapper สำหรับ async functions เพื่อจัดการ error
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

// สร้าง error แบบกำหนดเอง
function createError(message, statusCode = 500, code = null) {
    return new AppError(message, statusCode, code);
}

// Handle 404 errors
function notFoundHandler(req, res, next) {
    const error = new AppError(
        `ไม่พบเส้นทาง ${req.originalUrl}`,
        404,
        'NOT_FOUND'
    );
    next(error);
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // ปิดเซิร์ฟเวอร์อย่างสุภาพ
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

module.exports = {
    errorHandler,
    asyncHandler,
    createError,
    notFoundHandler,
    AppError
};