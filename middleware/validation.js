// middleware/validation.js

// ฟังก์ชันช่วยในการ validate
const validators = {
    required: (value, fieldName) => {
        if (value === undefined || value === null || value === '') {
            return `${fieldName} เป็นข้อมูลที่จำเป็น`;
        }
        return null;
    },

    email: (value, fieldName) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (value && !emailRegex.test(value)) {
            return `${fieldName} ต้องเป็นรูปแบบอีเมลที่ถูกต้อง`;
        }
        return null;
    },

    phone: (value, fieldName) => {
        const phoneRegex = /^[0-9]{10}$/;
        if (value && !phoneRegex.test(value.replace(/[-\s]/g, ''))) {
            return `${fieldName} ต้องเป็นเบอร์โทรศัพท์ 10 หลัก`;
        }
        return null;
    },

    number: (value, fieldName) => {
        if (value !== undefined && isNaN(Number(value))) {
            return `${fieldName} ต้องเป็นตัวเลข`;
        }
        return null;
    },

    minLength: (min) => (value, fieldName) => {
        if (value && value.length < min) {
            return `${fieldName} ต้องมีอย่างน้อย ${min} ตัวอักษร`;
        }
        return null;
    },

    maxLength: (max) => (value, fieldName) => {
        if (value && value.length > max) {
            return `${fieldName} ต้องมีไม่เกิน ${max} ตัวอักษร`;
        }
        return null;
    },

    dateFormat: (value, fieldName) => {
        if (value && !moment(value, 'YYYY-MM-DD', true).isValid()) {
            return `${fieldName} ต้องเป็นรูปแบบวันที่ YYYY-MM-DD`;
        }
        return null;
    },

    timeFormat: (value, fieldName) => {
        if (value && !moment(value, 'HH:mm:ss', true).isValid()) {
            return `${fieldName} ต้องเป็นรูปแบบเวลา HH:mm:ss`;
        }
        return null;
    },

    inArray: (allowedValues) => (value, fieldName) => {
        if (value && !allowedValues.includes(value)) {
            return `${fieldName} ต้องเป็นหนึ่งใน: ${allowedValues.join(', ')}`;
        }
        return null;
    }
};

// Validation schemas
const schemas = {
    // Schema สำหรับการเช็คอิน/เช็คเอาท์
    attendance: {
        action: [
            validators.required,
            validators.inArray(['checkin', 'checkout'])
        ],
        location: [validators.required],
        'location.latitude': [validators.required, validators.number],
        'location.longitude': [validators.required, validators.number]
    },

    // Schema สำหรับคำขอลา
    leaveRequest: {
        leaveType: [
            validators.required,
            validators.inArray(['sick', 'personal', 'vacation', 'emergency', 'maternity', 'paternity'])
        ],
        startDate: [validators.required, validators.dateFormat],
        endDate: [validators.required, validators.dateFormat],
        reason: [validators.required, validators.minLength(10), validators.maxLength(500)]
    },

    // Schema สำหรับการสร้างพนักงานใหม่
    employee: {
        lineUserId: [validators.required, validators.minLength(10)],
        employeeCode: [validators.required, validators.minLength(3), validators.maxLength(20)],
        name: [validators.required, validators.minLength(2), validators.maxLength(255)],
        position: [validators.maxLength(255)],
        department: [validators.maxLength(255)],
        salary: [validators.number],
        hireDate: [validators.dateFormat],
        phone: [validators.phone],
        email: [validators.email]
    },

    // Schema สำหรับการอัปเดตข้อมูลพนักงาน
    employeeUpdate: {
        name: [validators.minLength(2), validators.maxLength(255)],
        position: [validators.maxLength(255)],
        department: [validators.maxLength(255)],
        salary: [validators.number],
        phone: [validators.phone],
        email: [validators.email]
    }
};

// ฟังก์ชันหลักสำหรับ validate
function validate(schema, data) {
    const errors = [];

    for (const [field, validatorList] of Object.entries(schema)) {
        const value = getNestedValue(data, field);
        
        for (const validator of validatorList) {
            const error = validator(value, field);
            if (error) {
                errors.push(error);
                break; // หยุดการ validate field นี้ถ้าเจอ error
            }
        }
    }

    return errors;
}

// ฟังก์ชันช่วยสำหรับการเข้าถึง nested object
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
}

// Middleware สำหรับ validation
function validationMiddleware(schemaName) {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        
        if (!schema) {
            console.error(`Validation schema '${schemaName}' not found`);
            return res.status(500).json({
                error: 'เกิดข้อผิดพลาดในระบบ validation',
                code: 'VALIDATION_SCHEMA_ERROR'
            });
        }

        const errors = validate(schema, req.body);

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'ข้อมูลไม่ถูกต้อง',
                code: 'VALIDATION_ERROR',
                details: errors
            });
        }

        next();
    };
}

// Validation แบบกำหนดเอง
function customValidation(validationFunc) {
    return (req, res, next) => {
        try {
            const errors = validationFunc(req.body, req);
            
            if (errors && errors.length > 0) {
                return res.status(400).json({
                    error: 'ข้อมูลไม่ถูกต้อง',
                    code: 'VALIDATION_ERROR',
                    details: errors
                });
            }
            
            next();
        } catch (error) {
            console.error('Custom validation error:', error);
            res.status(500).json({
                error: 'เกิดข้อผิดพลาดในการตรวจสอบข้อมูล',
                code: 'VALIDATION_ERROR'
            });
        }
    };
}

// Validation functions สำหรับกรณีพิเศษ
const customValidations = {
    // ตรวจสอบวันที่ลา
    leaveRequestDates: (data) => {
        const errors = [];
        const startDate = new Date(data.startDate);
        const endDate = new Date(data.endDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ตรวจสอบว่าวันเริ่มต้นไม่เป็นอดีต (ยกเว้นลาป่วย)
        if (data.leaveType !== 'sick' && startDate < today) {
            errors.push('วันที่เริ่มลาต้องไม่เป็นวันที่ผ่านมาแล้ว');
        }

        // ตรวจสอบว่าวันสิ้นสุดมากกว่าหรือเท่ากับวันเริ่มต้น
        if (endDate < startDate) {
            errors.push('วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น');
        }

        // ตรวจสอบระยะเวลาการลา
        const daysDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        if (daysDiff > 30) {
            errors.push('ไม่สามารถลาติดต่อกันเกิน 30 วันได้');
        }

        return errors;
    },

    // ตรวจสอบตำแหน่งที่ตั้ง
    locationValidation: (data) => {
        const errors = [];
        const { latitude, longitude } = data.location;

        if (latitude < -90 || latitude > 90) {
            errors.push('ค่า latitude ต้องอยู่ระหว่าง -90 ถึง 90');
        }

        if (longitude < -180 || longitude > 180) {
            errors.push('ค่า longitude ต้องอยู่ระหว่าง -180 ถึง 180');
        }

        return errors;
    }
};

module.exports = {
    validationMiddleware,
    customValidation,
    customValidations,
    validators,
    schemas,
    validate
};