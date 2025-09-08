// utils/timeCalculator.js
const moment = require('moment');
const settings = require('../config/settings');

class TimeCalculator {
    constructor() {
        // ตั้งค่า moment.js ให้ใช้ภาษาไทย
        moment.locale('th');
    }

    // คำนวณชั่วโมงทำงานจากเวลาเข้า-ออก
    async calculateWorkHours(checkInTime, checkOutTime, includeBreak = true) {
        if (!checkInTime || !checkOutTime) {
            return {
                totalHours: 0,
                workHours: 0,
                breakHours: 0,
                overtimeHours: 0
            };
        }

        try {
            const checkIn = moment(checkInTime, 'HH:mm:ss');
            const checkOut = moment(checkOutTime, 'HH:mm:ss');

            // ถ้าเช็คเอาท์ก่อนเช็คอิน (ข้ามวัน)
            if (checkOut.isBefore(checkIn)) {
                checkOut.add(1, 'day');
            }

            const totalMinutes = checkOut.diff(checkIn, 'minutes');
            const totalHours = totalMinutes / 60;

            let breakHours = 0;
            let workHours = totalHours;

            if (includeBreak && totalHours >= 6) {
                // ดึงข้อมูลเวลาพักจากการตั้งค่า
                const lunchStart = await settings.getSetting('lunch_start_time', '12:00:00');
                const lunchEnd = await settings.getSetting('lunch_end_time', '13:00:00');
                
                breakHours = await this.calculateBreakTime(checkInTime, checkOutTime, lunchStart, lunchEnd);
                workHours = Math.max(0, totalHours - breakHours);
            }

            // คำนวณชั่วโมงล่วงเวลา
            const standardWorkHours = await settings.getSetting('min_work_hours_per_day', 8);
            const overtimeHours = Math.max(0, workHours - standardWorkHours);

            return {
                totalHours: Math.round(totalHours * 100) / 100,
                workHours: Math.round(workHours * 100) / 100,
                breakHours: Math.round(breakHours * 100) / 100,
                overtimeHours: Math.round(overtimeHours * 100) / 100
            };

        } catch (error) {
            console.error('Error calculating work hours:', error);
            throw new Error('ไม่สามารถคำนวณชั่วโมงทำงานได้');
        }
    }

    // คำนวณเวลาพัก
    async calculateBreakTime(checkInTime, checkOutTime, lunchStart, lunchEnd) {
        try {
            const checkIn = moment(checkInTime, 'HH:mm:ss');
            const checkOut = moment(checkOutTime, 'HH:mm:ss');
            const breakStart = moment(lunchStart, 'HH:mm:ss');
            const breakEnd = moment(lunchEnd, 'HH:mm:ss');

            // ถ้าเช็คเอาท์ก่อนเช็คอิน (ข้ามวัน)
            if (checkOut.isBefore(checkIn)) {
                checkOut.add(1, 'day');
            }

            // ตรวจสอบว่าช่วงทำงานครอบคลุมช่วงพักหรือไม่
            if (checkIn.isBefore(breakEnd) && checkOut.isAfter(breakStart)) {
                // คำนวณเวลาพักที่ทับซ้อนกับเวลาทำงาน
                const actualBreakStart = moment.max(checkIn, breakStart);
                const actualBreakEnd = moment.min(checkOut, breakEnd);
                
                if (actualBreakEnd.isAfter(actualBreakStart)) {
                    return actualBreakEnd.diff(actualBreakStart, 'minutes') / 60;
                }
            }

            return 0;
        } catch (error) {
            console.error('Error calculating break time:', error);
            return 1; // ค่าเริ่มต้น 1 ชั่วโมง
        }
    }

    // ตรวจสอบว่าเข้างานสายหรือไม่
    async isLateCheckIn(checkInTime, workDate = null) {
        try {
            const standardStartTime = await settings.getSetting('work_start_time', '09:00:00');
            const lateThresholdMinutes = await settings.getSetting('late_threshold_minutes', 15);

            const checkIn = moment(checkInTime, 'HH:mm:ss');
            const standardStart = moment(standardStartTime, 'HH:mm:ss');
            const lateThreshold = standardStart.clone().add(lateThresholdMinutes, 'minutes');

            const isLate = checkIn.isAfter(lateThreshold);
            const lateMinutes = isLate ? checkIn.diff(standardStart, 'minutes') : 0;

            return {
                isLate,
                lateMinutes,
                standardStartTime,
                lateThreshold: lateThreshold.format('HH:mm:ss')
            };
        } catch (error) {
            console.error('Error checking late status:', error);
            return { isLate: false, lateMinutes: 0 };
        }
    }

    // ตรวจสอบว่าออกงานเร็วหรือไม่
    async isEarlyCheckOut(checkOutTime, workDate = null) {
        try {
            const standardEndTime = await settings.getSetting('work_end_time', '18:00:00');
            
            const checkOut = moment(checkOutTime, 'HH:mm:ss');
            const standardEnd = moment(standardEndTime, 'HH:mm:ss');

            const isEarly = checkOut.isBefore(standardEnd);
            const earlyMinutes = isEarly ? standardEnd.diff(checkOut, 'minutes') : 0;

            return {
                isEarly,
                earlyMinutes,
                standardEndTime
            };
        } catch (error) {
            console.error('Error checking early checkout:', error);
            return { isEarly: false, earlyMinutes: 0 };
        }
    }

    // คำนวณค่าล่วงเวลา
    async calculateOvertimePay(overtimeHours, baseSalary, workingDaysPerMonth = 22) {
        try {
            const overtimeRate = await settings.getSetting('overtime_rate', 1.5);
            
            // คำนวณอัตราต่อชั่วโมง
            const hourlyRate = baseSalary / (workingDaysPerMonth * 8);
            const overtimePay = overtimeHours * hourlyRate * overtimeRate;

            return {
                overtimeHours,
                hourlyRate: Math.round(hourlyRate * 100) / 100,
                overtimeRate,
                overtimePay: Math.round(overtimePay * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating overtime pay:', error);
            return { overtimePay: 0 };
        }
    }

    // คำนวณสถิติการทำงานรายเดือน
    async calculateMonthlyStats(attendanceRecords) {
        try {
            let totalWorkDays = 0;
            let totalWorkHours = 0;
            let totalOvertimeHours = 0;
            let lateDays = 0;
            let totalLateMinutes = 0;
            let presentDays = 0;
            let absentDays = 0;

            for (const record of attendanceRecords) {
                if (record.status === 'present' || record.status === 'late') {
                    presentDays++;
                    totalWorkHours += record.work_hours || 0;
                    totalOvertimeHours += record.overtime_hours || 0;

                    if (record.status === 'late') {
                        lateDays++;
                        // คำนวณนาทีที่สายจากเวลาเข้างาน
                        const lateInfo = await this.isLateCheckIn(record.check_in_time);
                        totalLateMinutes += lateInfo.lateMinutes;
                    }
                } else if (record.status === 'absent') {
                    absentDays++;
                }

                totalWorkDays++;
            }

            const averageWorkHours = totalWorkDays > 0 ? totalWorkHours / totalWorkDays : 0;
            const attendanceRate = totalWorkDays > 0 ? (presentDays / totalWorkDays) * 100 : 0;

            return {
                totalWorkDays,
                presentDays,
                absentDays,
                lateDays,
                totalWorkHours: Math.round(totalWorkHours * 100) / 100,
                totalOvertimeHours: Math.round(totalOvertimeHours * 100) / 100,
                averageWorkHours: Math.round(averageWorkHours * 100) / 100,
                totalLateMinutes,
                attendanceRate: Math.round(attendanceRate * 100) / 100
            };
        } catch (error) {
            console.error('Error calculating monthly stats:', error);
            throw new Error('ไม่สามารถคำนวณสถิติรายเดือนได้');
        }
    }

    // ตรวจสอบว่าเป็นวันทำงานหรือไม่
    isWorkingDay(date) {
        const momentDate = moment(date);
        const dayOfWeek = momentDate.day(); // 0=อาทิตย์, 1=จันทร์, ..., 6=เสาร์
        
        // จันทร์-ศุกร์ (1-5)
        return dayOfWeek >= 1 && dayOfWeek <= 5;
    }

    // คำนวณจำนวนวันทำงานในเดือน
    getWorkingDaysInMonth(year, month) {
        const startOfMonth = moment([year, month - 1, 1]);
        const endOfMonth = startOfMonth.clone().endOf('month');
        let workingDays = 0;

        const current = startOfMonth.clone();
        while (current.isSameOrBefore(endOfMonth)) {
            if (this.isWorkingDay(current)) {
                workingDays++;
            }
            current.add(1, 'day');
        }

        return workingDays;
    }

    // คำนวณวันลาระหว่างสองวันที่
    calculateLeaveDays(startDate, endDate, includeWeekends = false) {
        const start = moment(startDate);
        const end = moment(endDate);
        let totalDays = 0;
        let workingDays = 0;

        const current = start.clone();
        while (current.isSameOrBefore(end)) {
            totalDays++;
            
            if (includeWeekends || this.isWorkingDay(current)) {
                workingDays++;
            }
            
            current.add(1, 'day');
        }

        return {
            totalDays,
            workingDays: includeWeekends ? totalDays : workingDays
        };
    }

    // แปลงนาทีเป็นรูปแบบ ชั่วโมง:นาที
    minutesToHoursMinutes(minutes) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        
        if (hours > 0) {
            return `${hours} ชั่วโมง ${remainingMinutes} นาที`;
        } else {
            return `${remainingMinutes} นาที`;
        }
    }

    // แปลงชั่วโมงเป็นรูปแบบ ชั่วโมง:นาที
    hoursToHoursMinutes(hours) {
        const wholeHours = Math.floor(hours);
        const minutes = Math.round((hours - wholeHours) * 60);
        
        if (wholeHours > 0 && minutes > 0) {
            return `${wholeHours} ชั่วโมง ${minutes} นาที`;
        } else if (wholeHours > 0) {
            return `${wholeHours} ชั่วโมง`;
        } else {
            return `${minutes} นาที`;
        }
    }

    // ตรวจสอบว่าอยู่ในช่วงเวลาทำงานหรือไม่
    async isWithinWorkingHours(currentTime = null) {
        try {
            const workStartTime = await settings.getSetting('work_start_time', '09:00:00');
            const workEndTime = await settings.getSetting('work_end_time', '18:00:00');
            
            const now = currentTime ? moment(currentTime, 'HH:mm:ss') : moment();
            const startTime = moment(workStartTime, 'HH:mm:ss');
            const endTime = moment(workEndTime, 'HH:mm:ss');
            
            return now.isBetween(startTime, endTime, 'minute', '[]');
        } catch (error) {
            console.error('Error checking working hours:', error);
            return false;
        }
    }

    // สร้างรายงานสรุปเวลาทำงาน
    async generateTimeReport(attendanceData) {
        try {
            const report = {
                period: {
                    start: attendanceData.length > 0 ? attendanceData[0].date : null,
                    end: attendanceData.length > 0 ? attendanceData[attendanceData.length - 1].date : null
                },
                summary: await this.calculateMonthlyStats(attendanceData),
                details: []
            };

            for (const record of attendanceData) {
                const timeInfo = await this.calculateWorkHours(
                    record.check_in_time,
                    record.check_out_time
                );

                const lateInfo = record.check_in_time ? 
                    await this.isLateCheckIn(record.check_in_time) : 
                    { isLate: false, lateMinutes: 0 };

                const earlyInfo = record.check_out_time ? 
                    await this.isEarlyCheckOut(record.check_out_time) : 
                    { isEarly: false, earlyMinutes: 0 };

                report.details.push({
                    date: record.date,
                    checkIn: record.check_in_time,
                    checkOut: record.check_out_time,
                    workHours: timeInfo.workHours,
                    overtimeHours: timeInfo.overtimeHours,
                    status: record.status,
                    isLate: lateInfo.isLate,
                    lateMinutes: lateInfo.lateMinutes,
                    isEarly: earlyInfo.isEarly,
                    earlyMinutes: earlyInfo.earlyMinutes,
                    formatted: {
                        workHours: this.hoursToHoursMinutes(timeInfo.workHours),
                        overtimeHours: this.hoursToHoursMinutes(timeInfo.overtimeHours),
                        lateTime: this.minutesToHoursMinutes(lateInfo.lateMinutes)
                    }
                });
            }

            return report;
        } catch (error) {
            console.error('Error generating time report:', error);
            throw new Error('ไม่สามารถสร้างรายงานเวลาทำงานได้');
        }
    }
}

module.exports = new TimeCalculator();