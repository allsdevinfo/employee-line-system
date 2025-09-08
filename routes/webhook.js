// routes/webhook.js - LINE Webhook Handler
const express = require('express');
const router = express.Router();
const lineConfig = require('../config/line');
const dbConfig = require('../config/database');
const { responseHelpers, dateHelpers, textHelpers } = require('../utils/helpers');
const { asyncHandler } = require('../middleware/errorHandler');

// Middleware สำหรับตรวจสอบ LINE Signature
function verifyLineSignature(req, res, next) {
    const signature = req.get('X-Line-Signature');
    const body = JSON.stringify(req.body);
    
    if (!signature) {
        return res.status(400).json(responseHelpers.error('Missing LINE signature', 'MISSING_SIGNATURE'));
    }
    
    try {
        if (!lineConfig.verifySignature(body, signature)) {
            return res.status(400).json(responseHelpers.error('Invalid LINE signature', 'INVALID_SIGNATURE'));
        }
    } catch (error) {
        console.error('Signature verification error:', error);
        return res.status(400).json(responseHelpers.error('Signature verification failed', 'SIGNATURE_ERROR'));
    }
    
    next();
}

// POST / - LINE Webhook endpoint
router.post('/', verifyLineSignature, asyncHandler(async (req, res) => {
    const events = req.body.events || [];
    
    console.log('LINE Webhook received:', JSON.stringify(req.body, null, 2));
    
    // ประมวลผล events แต่ละตัว
    for (const event of events) {
        try {
            await handleLineEvent(event);
        } catch (error) {
            console.error('Error handling LINE event:', error);
        }
    }
    
    res.status(200).json({ status: 'OK' });
}));

// ฟังก์ชันจัดการ LINE events หลัก
async function handleLineEvent(event) {
    const { type, source, message, postback, replyToken } = event;
    const userId = source?.userId;
    
    if (!userId) {
        console.error('No userId in event');
        return;
    }
    
    try {
        switch (type) {
            case 'message':
                if (message) {
                    await handleMessageEvent(userId, message, replyToken);
                }
                break;
                
            case 'postback':
                if (postback) {
                    await handlePostbackEvent(userId, postback, replyToken);
                }
                break;
                
            case 'follow':
                await handleFollowEvent(userId);
                break;
                
            case 'unfollow':
                await handleUnfollowEvent(userId);
                break;
                
            default:
                console.log('Unhandled event type:', type);
        }
    } catch (error) {
        console.error('Error in handleLineEvent:', error);
    }
}

// จัดการข้อความ
async function handleMessageEvent(userId, message, replyToken) {
    if (message.type !== 'text') {
        return;
    }
    
    const text = message.text.toLowerCase().trim();
    const client = lineConfig.getClient();
    
    if (!client) {
        console.error('LINE client not configured');
        return;
    }
    
    try {
        // ตรวจสอบว่าเป็นพนักงานหรือไม่
        const [employees] = await dbConfig.execute(
            'SELECT * FROM employees WHERE line_user_id = ? AND status = "active"',
            [userId]
        );
        
        let replyMessage = null;
        
        if (employees.length === 0) {
            // ลองเช็คสถานะ pending
            const [pending] = await dbConfig.execute(
                'SELECT * FROM employees WHERE line_user_id = ? AND status = "pending"', [userId]
            );
            if (pending.length > 0) {
                replyMessage = { type: 'text', text: '📨 คำขอของท่านกำลังรออนุมัติจาก HR ครับ' };
            } else {
                replyMessage = { type: 'text', text: '🚫 ท่านยังไม่ได้ลงทะเบียนเป็นพนักงาน\n\nกรุณาลงทะเบียนผ่าน LIFF หรือ ติดต่อ HR' };
            }

            // ไม่ใช่พนักงาน
            // replyMessage = {
            //     type: 'text',
            //     text: '🚫 ท่านยังไม่ได้ลงทะเบียนเป็นพนักงาน\n\nกรุณาติดต่อแผนก HR เพื่อลงทะเบียนเข้าระบบ\n\n📞 ติดต่อ: แผนก HR'
            // };
        } else {
            // เป็นพนักงาน
            const employee = employees[0];
            replyMessage = await generateEmployeeReply(employee, text);
        }
        
        // ส่งข้อความตอบกลับ
        if (replyMessage && replyToken) {
            await client.replyMessage(replyToken, replyMessage);
        }
        
    } catch (error) {
        console.error('Error in handleMessageEvent:', error);
        
        // ส่งข้อความ error กลับไป
        if (replyToken && client) {
            try {
                await client.replyMessage(replyToken, {
                    type: 'text',
                    text: '😅 ขออภัย เกิดข้อผิดพลาดในระบบ\nกรุณาลองใหม่อีกครั้ง'
                });
            } catch (replyError) {
                console.error('Error sending error reply:', replyError);
            }
        }
    }
}

// สร้างข้อความตอบกลับสำหรับพนักงาน
async function generateEmployeeReply(employee, text) {
    const liffUrl = lineConfig.liffId ? `https://liff.line.me/${lineConfig.liffId}` : 'https://your-liff-url.com';
    
    if (text.includes('สวัสดี') || text.includes('hello') || text.includes('hi')) {
        return {
            type: 'text',
            text: `สวัสดี ${employee.name}! 👋\n\nใช้เมนูด้านล่างเพื่อเข้าใช้งานระบบ หรือพิมพ์ "help" เพื่อดูคำสั่งที่ใช้ได้`
        };
        
    } else if (text.includes('help') || text.includes('ช่วยเหลือ')) {
        return {
            type: 'text',
            text: `📋 คำสั่งที่ใช้ได้:\n\n` +
                  `• "เช็คอิน" - เช็คอินเข้างาน\n` +
                  `• "เช็คเอาท์" - เช็คเอาท์ออกงาน\n` +
                  `• "สถานะ" - ดูสถานะการทำงานวันนี้\n` +
                  `• "ลา" - ดูข้อมูลการลา\n` +
                  `• "สวัสดิการ" - ดูข้อมูลสวัสดิการ\n` +
                  `• "ประวัติ" - ดูประวัติการทำงาน\n\n` +
                  `หรือใช้เมนูด้านล่างเพื่อเข้าใช้งานระบบ`
        };
        
    } else if (text.includes('เช็คอิน') || text.includes('checkin')) {
        return {
            type: 'text',
            text: `⏰ เช็คอิน/เช็คเอาท์\n\nกรุณาใช้ระบบ LIFF สำหรับการเช็คอิน/เช็คเอาท์\nเพื่อความแม่นยำของตำแหน่งที่ตั้ง\n\n👆 คลิกที่เมนูด้านล่างเพื่อเข้าสู่ระบบ`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'uri',
                            label: '🏢 เข้าสู่ระบบ',
                            uri: liffUrl
                        }
                    }
                ]
            }
        };
        
    } else if (text.includes('สถานะ') || text.includes('status')) {
        return await getEmployeeStatus(employee);
        
    } else if (text.includes('ลา') || text.includes('leave')) {
        return await getLeaveInfo(employee, liffUrl);
        
    } else if (text.includes('สวัสดิการ') || text.includes('welfare') || text.includes('benefit')) {
        return await getWelfareInfo(employee, liffUrl);
        
    } else if (text.includes('ประวัติ') || text.includes('history')) {
        return {
            type: 'text',
            text: `📊 ประวัติการทำงาน\n\nกรุณาใช้ระบบ LIFF เพื่อดูประวัติการทำงานแบบละเอียด\n\n👆 คลิกที่เมนูด้านล่างเพื่อเข้าสู่ระบบ`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'uri',
                            label: '📊 ดูประวัติ',
                            uri: liffUrl
                        }
                    }
                ]
            }
        };
        
    } else {
        // ข้อความอื่นๆ
        return {
            type: 'text',
            text: `สวัสดี ${employee.name}! 😊\n\nไม่เข้าใจคำสั่งที่ท่านส่งมา\nลองพิมพ์ "help" เพื่อดูคำสั่งที่ใช้ได้\n\nหรือใช้เมนูด้านล่างเพื่อเข้าใช้งานระบบ`,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'message',
                            label: '❓ ช่วยเหลือ',
                            text: 'help'
                        }
                    },
                    {
                        type: 'action',
                        action: {
                            type: 'uri',
                            label: '🏢 เข้าสู่ระบบ',
                            uri: liffUrl
                        }
                    }
                ]
            }
        };
    }
}

// ดึงสถานะการทำงานวันนี้
async function getEmployeeStatus(employee) {
    try {
        const today = dateHelpers.getCurrentDate();
        const [attendance] = await dbConfig.execute(
            'SELECT * FROM attendance WHERE employee_id = ? AND date = ?',
            [employee.id, today]
        );
        
        let statusText = '';
        if (attendance.length === 0) {
            statusText = '❌ ยังไม่ได้เช็คอินวันนี้';
        } else {
            const record = attendance[0];
            statusText = `📅 สถานะวันนี้ (${dateHelpers.formatDate(new Date())})\n\n`;
            
            if (record.check_in_time) {
                statusText += `✅ เช็คอิน: ${dateHelpers.formatTime(record.check_in_time)}\n`;
            }
            
            if (record.check_out_time) {
                statusText += `🏃‍♂️ เช็คเอาท์: ${dateHelpers.formatTime(record.check_out_time)}\n`;
                statusText += `⏱️ ทำงาน: ${record.work_hours || 0} ชั่วโมง\n`;
                
                if (record.overtime_hours > 0) {
                    statusText += `🌙 ล่วงเวลา: ${record.overtime_hours} ชั่วโมง\n`;
                }
            } else if (record.check_in_time) {
                statusText += `🟢 กำลังทำงาน...\n`;
            }
            
            statusText += `📊 สถานะ: ${textHelpers.getStatusText(record.status)}`;
        }
        
        return {
            type: 'text',
            text: statusText
        };
    } catch (error) {
        console.error('Error getting employee status:', error);
        return {
            type: 'text',
            text: '❌ ไม่สามารถดึงข้อมูลสถานะได้ กรุณาลองใหม่อีกครั้ง'
        };
    }
}

// ดึงข้อมูลการลา
async function getLeaveInfo(employee, liffUrl) {
    try {
        const [benefits] = await dbConfig.execute(
            'SELECT * FROM employee_benefits WHERE employee_id = ?',
            [employee.id]
        );
        
        const benefit = benefits[0] || {
            vacation_days_total: 10,
            vacation_days_used: 0,
            sick_days_total: 30,
            sick_days_used: 0
        };
        
        const [pendingLeaves] = await dbConfig.execute(
            'SELECT COUNT(*) as count FROM leave_requests WHERE employee_id = ? AND status = "pending"',
            [employee.id]
        );
        
        const leaveText = `🌴 ข้อมูลการลา\n\n` +
                         `📊 วันลาพักผ่อน:\n` +
                         `   • ใช้แล้ว: ${benefit.vacation_days_used}/${benefit.vacation_days_total} วัน\n` +
                         `   • คงเหลือ: ${benefit.vacation_days_total - benefit.vacation_days_used} วัน\n\n` +
                         `🏥 วันลาป่วย:\n` +
                         `   • ใช้แล้ว: ${benefit.sick_days_used}/${benefit.sick_days_total} วัน\n` +
                         `   • คงเหลือ: ${benefit.sick_days_total - benefit.sick_days_used} วัน\n\n` +
                         `⏳ คำขอที่รออนุมัติ: ${pendingLeaves[0].count} คำขอ\n\n` +
                         `💡 ใช้ระบบ LIFF เพื่อส่งคำขอลาใหม่`;
        
        return {
            type: 'text',
            text: leaveText,
            quickReply: {
                items: [
                    {
                        type: 'action',
                        action: {
                            type: 'uri',
                            label: '📝 แจ้งลา',
                            uri: liffUrl
                        }
                    }
                ]
            }
        };
    } catch (error) {
        console.error('Error getting leave info:', error);
        return {
            type: 'text',
            text: '❌ ไม่สามารถดึงข้อมูลการลาได้ กรุณาลองใหม่อีกครั้ง'
        };
    }
}

// ดึงข้อมูลสวัสดิการ
async function getWelfareInfo(employee, liffUrl) {
    const welfareText = `🎁 สวัสดิการพนักงาน\n\n` +
                       `💰 เงินเดือน: ${employee.salary ? employee.salary.toLocaleString() : 'ไม่ระบุ'} บาท\n` +
                       `📅 วันจ่าย: 25 ของทุกเดือน\n` +
                       `🏥 ประกันสังคม: เปิดใช้งาน\n` +
                       `🌴 วันลาพักผ่อน: 10 วัน/ปี\n` +
                       `🤒 วันลาป่วย: 30 วัน/ปี\n\n` +
                       `📱 ดูรายละเอียดเพิ่มเติมในระบบ LIFF`;
    
    return {
        type: 'text',
        text: welfareText,
        quickReply: {
            items: [
                {
                    type: 'action',
                    action: {
                        type: 'uri',
                        label: '🎁 ดูสวัสดิการ',
                        uri: liffUrl
                    }
                }
            ]
        }
    };
}

// จัดการ postback events
async function handlePostbackEvent(userId, postback, replyToken) {
    const { data } = postback;
    const client = lineConfig.getClient();
    
    if (!client || !replyToken) {
        console.error('LINE client not configured or no reply token');
        return;
    }
    
    console.log('Postback received:', data);
    
    let replyMessage = null;
    
    try {
        if (data === 'get_help') {
            replyMessage = {
                type: 'text',
                text: `📋 ความช่วยเหลือ\n\nระบบพนักงาน Employee System\n\n• ใช้เมนูด้านล่างเพื่อเข้าสู่ระบบ\n• พิมพ์ "help" เพื่อดูคำสั่ง\n• พิมพ์ "สถานะ" เพื่อดูสถานะการทำงาน\n\n📞 ติดต่อ HR หากมีปัญหา`
            };
        } else if (data === 'show_menu') {
            const liffUrl = lineConfig.liffId ? `https://liff.line.me/${lineConfig.liffId}` : 'https://your-liff-url.com';
            replyMessage = {
                type: 'text',
                text: `📱 เมนูระบบ\n\nกรุณาเลือกฟังก์ชันที่ต้องการ:`,
                quickReply: {
                    items: [
                        {
                            type: 'action',
                            action: {
                                type: 'uri',
                                label: '🏢 เข้าสู่ระบบ',
                                uri: liffUrl
                            }
                        },
                        {
                            type: 'action',
                            action: {
                                type: 'message',
                                label: '📊 สถานะ',
                                text: 'สถานะ'
                            }
                        },
                        {
                            type: 'action',
                            action: {
                                type: 'message',
                                label: '🌴 ข้อมูลลา',
                                text: 'ลา'
                            }
                        }
                    ]
                }
            };
        }
        
        if (replyMessage) {
            await client.replyMessage(replyToken, replyMessage);
        }
    } catch (error) {
        console.error('Error in handlePostbackEvent:', error);
    }
}

// จัดการเมื่อมีการ follow
async function handleFollowEvent(userId) {
    const client = lineConfig.getClient();

     const [rows] = await dbConfig.execute('SELECT id FROM employees WHERE line_user_id=?',[userId]);
        if(rows.length===0){
            await dbConfig.execute(
            `INSERT INTO employees (line_user_id, name, status, created_at, updated_at)
            VALUES (?, '(รอตรวจสอบ)', 'pending', NOW(), NOW())`, [userId]
            );
        }

    
    if (!client) {
        console.error('LINE client not configured');
        return;
    }
    
    
    try {
        // ตรวจสอบว่าเป็นพนักงานหรือไม่
        const [employees] = await dbConfig.execute(
            'SELECT * FROM employees WHERE line_user_id = ? AND status = "active"',
            [userId]
        );
        
        let welcomeMessage;
        
        if (employees.length === 0) {
            // ไม่ใช่พนักงาน
            welcomeMessage = {
                type: 'text',
                text: `🎉 ขอบคุณที่เพิ่มเพื่อน!\n\nระบบพนักงาน - Employee System\n\n❗ ท่านยังไม่ได้ลงทะเบียนเป็นพนักงาน\nกรุณาติดต่อแผนก HR เพื่อลงทะเบียนเข้าระบบ\n\n📞 ติดต่อ: แผนก HR`
            };
        } else {
            // เป็นพนักงาน
            const employee = employees[0];
            const liffUrl = lineConfig.liffId ? `https://liff.line.me/${lineConfig.liffId}` : 'https://your-liff-url.com';
            
            welcomeMessage = {
                type: 'flex',
                altText: 'ยินดีต้อนรับสู่ระบบพนักงาน',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '🎉 ยินดีต้อนรับ!',
                                weight: 'bold',
                                size: 'lg',
                                color: '#ffffff'
                            }
                        ],
                        backgroundColor: '#667eea',
                        paddingAll: 'lg'
                    },
                    body: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: `สวัสดี ${employee.name}!`,
                                weight: 'bold',
                                size: 'xl',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: `${employee.position || 'พนักงาน'} • ${employee.department || 'แผนกทั่วไป'}`,
                                size: 'sm',
                                color: '#666666',
                                margin: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'lg'
                            },
                            {
                                type: 'text',
                                text: 'ระบบพนักงานพร้อมให้บริการ:',
                                size: 'md',
                                margin: 'lg'
                            },
                            {
                                type: 'text',
                                text: '• เช็คอิน/เช็คเอาท์\n• แจ้งการลาหยุด\n• ดูข้อมูลสวัสดิการ\n• ตรวจสอบประวัติการทำงาน',
                                size: 'sm',
                                color: '#666666',
                                margin: 'md'
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'button',
                                action: {
                                    type: 'uri',
                                    label: '🏢 เข้าสู่ระบบ',
                                    uri: liffUrl
                                },
                                style: 'primary',
                                color: '#667eea'
                            },
                            {
                                type: 'button',
                                action: {
                                    type: 'message',
                                    label: '❓ ช่วยเหลือ',
                                    text: 'help'
                                },
                                style: 'secondary',
                                margin: 'sm'
                            }
                        ]
                    }
                }
            };
        }
        
        // ส่งข้อความต้อนรับ
        await client.pushMessage(userId, welcomeMessage);
        
        // บันทึก log การ follow
        console.log(`User followed: ${userId}`, {
            isEmployee: employees.length > 0,
            employeeName: employees.length > 0 ? employees[0].name : null,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('Error in handleFollowEvent:', error);
    }
}

// จัดการเมื่อมีการ unfollow
async function handleUnfollowEvent(userId) {
    console.log('User unfollowed:', {
        userId: userId,
        timestamp: new Date().toISOString()
    });
    
    try {
        // ตรวจสอบว่าเป็นพนักงานหรือไม่และบันทึก log
        const [employees] = await dbConfig.execute(
            'SELECT name, employee_code FROM employees WHERE line_user_id = ?',
            [userId]
        );
        
        if (employees.length > 0) {
            console.log('Employee unfollowed:', {
                employeeCode: employees[0].employee_code,
                employeeName: employees[0].name,
                userId: userId
            });
        }
    } catch (error) {
        console.error('Error handling unfollow event:', error);
    }
}

// GET / - Webhook verification
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'Webhook is running',
        timestamp: new Date().toISOString(),
        service: 'Employee LINE System Webhook'
    });
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Webhook error:', error);
    res.status(500).json({ 
        status: 'error',
        message: 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

module.exports = router;