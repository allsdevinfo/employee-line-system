// utils/helpers.js
const moment = require('moment');

// ฟังก์ชันจัดการวันที่และเวลา
const dateHelpers = {
    // รูปแบบวันที่แสดงผล
    formatDate(date, format = 'DD/MM/YYYY') {
        return moment(date).format(format);
    },

    // รูปแบบเวลาแสดงผล
    formatTime(time, format = 'HH:mm') {
        return moment(time, 'HH:mm:ss').format(format);
    },

    // รูปแบบวันที่และเวลา
    formatDateTime(datetime, format = 'DD/MM/YYYY HH:mm') {
        return moment(datetime).format(format);
    },

    // ตรวจสอบว่าเป็นวันทำงานหรือไม่ (จันทร์-ศุกร์)
    isWorkingDay(date) {
        const day = moment(date).day();
        return day >= 1 && day <= 5; // 1=Monday, 5=Friday
    },

    // คำนวณจำนวนวันทำงานระหว่างสองวันที่
    getWorkingDaysBetween(startDate, endDate) {
        let count = 0;
        const current = moment(startDate);
        const end = moment(endDate);

        while (current.isSameOrBefore(end)) {
            if (this.isWorkingDay(current)) {
                count++;
            }
            current.add(1, 'day');
        }

        return count;
    },

    // ได้วันที่ปัจจุบันในรูปแบบ YYYY-MM-DD
    getCurrentDate() {
        return moment().format('YYYY-MM-DD');
    },

    // ได้เวลาปัจจุบันในรูปแบบ HH:mm:ss
    getCurrentTime() {
        return moment().format('HH:mm:ss');
    },

    // ตรวจสอบว่าเวลาปัจจุบันอยู่ในช่วงทำงานหรือไม่
    isWorkingHours(startTime = '09:00:00', endTime = '18:00:00') {
        const now = moment();
        const start = moment(startTime, 'HH:mm:ss');
        const end = moment(endTime, 'HH:mm:ss');
        const currentTime = moment(now.format('HH:mm:ss'), 'HH:mm:ss');

        return currentTime.isBetween(start, end, 'minute', '[]');
    },

    // คำนวณอายุงาน
    calculateWorkingYears(hireDate) {
        return moment().diff(moment(hireDate), 'years');
    }
};

// ฟังก์ชันจัดการการคำนวณเวลา
const timeCalculators = {
    // คำนวณชั่วโมงทำงานจากเวลาเข้า-ออก
    calculateWorkHours(checkIn, checkOut, breakHours = 1) {
        if (!checkIn || !checkOut) return 0;

        const start = moment(checkIn, 'HH:mm:ss');
        const end = moment(checkOut, 'HH:mm:ss');
        const duration = moment.duration(end.diff(start));
        const totalHours = duration.asHours();

        return Math.max(0, totalHours - breakHours);
    },

    // คำนวณชั่วโมงล่วงเวลา
    calculateOvertimeHours(workHours, standardHours = 8) {
        return Math.max(0, workHours - standardHours);
    },

    // คำนวณค่าล่วงเวลา
    calculateOvertimePay(overtimeHours, hourlyRate, multiplier = 1.5) {
        return overtimeHours * hourlyRate * multiplier;
    },

    // ตรวจสอบว่าสายหรือไม่
    isLate(checkInTime, standardStartTime = '09:00:00', lateThresholdMinutes = 15) {
        const checkIn = moment(checkInTime, 'HH:mm:ss');
        const standardStart = moment(standardStartTime, 'HH:mm:ss');
        const lateThreshold = standardStart.clone().add(lateThresholdMinutes, 'minutes');

        return checkIn.isAfter(lateThreshold);
    },

    // คำนวณเวลาสาย (นาที)
    calculateLateMinutes(checkInTime, standardStartTime = '09:00:00') {
        const checkIn = moment(checkInTime, 'HH:mm:ss');
        const standardStart = moment(standardStartTime, 'HH:mm:ss');

        if (checkIn.isAfter(standardStart)) {
            return moment.duration(checkIn.diff(standardStart)).asMinutes();
        }

        return 0;
    }
};

// ฟังก์ชันจัดการข้อความและการแสดงผล
const textHelpers = {
    // ตัดข้อความให้สั้นลง
    truncateText(text, maxLength = 100, suffix = '...') {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + suffix;
    },

    // แปลงสถานะเป็นข้อความภาษาไทย
    getStatusText(status) {
        const statusMap = {
            'present': '✅ ปกติ',
            'late': '⚠️ สาย',
            'absent': '❌ ขาดงาน',
            'half_day': '⏰ ครึ่งวัน',
            'holiday': '🏖️ วันหยุด',
            'pending': '⏳ รออนุมัติ',
            'approved': '✅ อนุมัติ',
            'rejected': '❌ ปฏิเสธ',
            'cancelled': '🚫ยกเลิก',
            'active': '🟢 ใช้งาน',
            'inactive': '🔴 ไม่ใช้งาน'
        };

        return statusMap[status] || status;
    },

    // แปลงประเภทการลาเป็นข้อความภาษาไทย
    getLeaveTypeText(type) {
        const typeMap = {
            'sick': '🏥 ลาป่วย',
            'personal': '👤 ลาธุระส่วนตัว',
            'vacation': '🌴 ลาพักผ่อน',
            'emergency': '🚨 ลาฉุกเฉิน',
            'maternity': '👶 ลาคลอด',
            'paternity': '👨‍👶 ลาบิดา',
            'annual': '📅 ลาประจำปี'
        };

        return typeMap[type] || type;
    },

    // สร้างรหัสอ้างอิงแบบสุ่ม
    generateReference(prefix = '', length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = prefix;
        
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        return result;
    },

    // ซ่อนข้อมูลสำคัญ (เช่น เบอร์โทร, อีเมล)
    maskSensitiveData(data, type = 'phone') {
        if (!data) return '';

        switch (type) {
            case 'phone':
                if (data.length >= 10) {
                    return data.substring(0, 3) + '****' + data.substring(7);
                }
                break;
            case 'email':
                const [username, domain] = data.split('@');
                if (username && domain) {
                    const maskedUsername = username.substring(0, 2) + '****';
                    return maskedUsername + '@' + domain;
                }
                break;
        }

        return data;
    }
};

// ฟังก์ชันจัดการข้อมูลและการจัดรูปแบบ
const dataHelpers = {
    // จัดรูปแบบตัวเลขเงิน
    formatCurrency(amount, currency = 'THB') {
        const formatter = new Intl.NumberFormat('th-TH', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });

        return formatter.format(amount || 0);
    },

    // จัดรูปแบบตัวเลขธรรมดา
    formatNumber(number, decimals = 0) {
        return new Intl.NumberFormat('th-TH', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        }).format(number || 0);
    },

    // คำนวณเปอร์เซ็นต์
    calculatePercentage(value, total, decimals = 1) {
        if (!total || total === 0) return 0;
        return ((value / total) * 100).toFixed(decimals);
    },

    // ตรวจสอบว่าข้อมูลเป็น object ว่างหรือไม่
    isEmpty(obj) {
        return !obj || Object.keys(obj).length === 0;
    },

    // ลบ property ที่มีค่า null หรือ undefined
    removeNullValues(obj) {
        const cleaned = {};
        
        Object.keys(obj).forEach(key => {
            if (obj[key] !== null && obj[key] !== undefined) {
                cleaned[key] = obj[key];
            }
        });
        
        return cleaned;
    },

    // สร้าง pagination object
    createPagination(currentPage, totalItems, itemsPerPage = 10) {
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const offset = (currentPage - 1) * itemsPerPage;

        return {
            currentPage: parseInt(currentPage),
            totalPages,
            totalItems,
            itemsPerPage,
            offset,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
        };
    }
};

// ฟังก์ชันจัดการ response
const responseHelpers = {
    // สร้าง success response
    success(data = null, message = 'สำเร็จ', meta = null) {
        const response = {
            success: true,
            message,
            timestamp: new Date().toISOString()
        };

        if (data !== null) {
            response.data = data;
        }

        if (meta) {
            response.meta = meta;
        }

        return response;
    },

    // สร้าง error response
    error(message = 'เกิดข้อผิดพลาด', code = 'UNKNOWN_ERROR', details = null) {
        const response = {
            success: false,
            error: message,
            code,
            timestamp: new Date().toISOString()
        };

        if (details) {
            response.details = details;
        }

        return response;
    },

    // สร้าง paginated response
    paginated(data, pagination, message = 'สำเร็จ') {
        return {
            success: true,
            message,
            data,
            pagination,
            timestamp: new Date().toISOString()
        };
    }
};

module.exports = {
    dateHelpers,
    timeCalculators,
    textHelpers,
    dataHelpers,
    responseHelpers
};