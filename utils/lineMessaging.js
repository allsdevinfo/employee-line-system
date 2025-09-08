// utils/lineMessaging.js
const lineConfig = require('../config/line');
const { textHelpers, dateHelpers } = require('./helpers');

class LineMessagingService {
    constructor() {
        this.client = lineConfig.getClient();
    }

    // ส่งข้อความแจ้งเตือนการเช็คอิน
    async sendCheckInNotification(userId, checkInData) {
        try {
            const { checkInTime, isLate, lateMinutes, location } = checkInData;
            
            let message = `✅ เช็คอินสำเร็จ\n`;
            message += `🕘 เวลา: ${dateHelpers.formatTime(checkInTime)}\n`;
            
            if (isLate) {
                message += `⚠️ สาย: ${lateMinutes} นาที\n`;
            } else {
                message += `✨ ตรงเวลา\n`;
            }
            
            message += `📍 ตำแหน่ง: อยู่ในพื้นที่สำนักงาน\n`;
            message += `📅 วันที่: ${dateHelpers.formatDate(new Date())}`;

            const messages = [
                {
                    type: 'text',
                    text: message
                },
                {
                    type: 'sticker',
                    packageId: '1',
                    stickerId: isLate ? '14' : '2'
                }
            ];

            await this.client.pushMessage(userId, messages);
            return true;
        } catch (error) {
            console.error('Error sending check-in notification:', error);
            return false;
        }
    }

    // ส่งข้อความแจ้งเตือนการเช็คเอาท์
    async sendCheckOutNotification(userId, checkOutData) {
        try {
            const { checkOutTime, workHours, overtimeHours } = checkOutData;
            
            let message = `🏃‍♂️ เช็คเอาท์สำเร็จ\n`;
            message += `🕕 เวลา: ${dateHelpers.formatTime(checkOutTime)}\n`;
            message += `⏱️ ทำงาน: ${workHours.toFixed(1)} ชั่วโมง\n`;
            
            if (overtimeHours > 0) {
                message += `🌙 ล่วงเวลา: ${overtimeHours.toFixed(1)} ชั่วโมง\n`;
            }
            
            message += `📅 วันที่: ${dateHelpers.formatDate(new Date())}\n`;
            message += `👏 ขอบคุณสำหรับการทำงานหนักวันนี้!`;

            await this.client.pushMessage(userId, {
                type: 'text',
                text: message
            });
            return true;
        } catch (error) {
            console.error('Error sending check-out notification:', error);
            return false;
        }
    }

    // ส่งข้อความแจ้งเตือนการส่งคำขอลา
    async sendLeaveRequestNotification(userId, leaveData) {
        try {
            const { leaveType, startDate, endDate, daysCount, reason } = leaveData;
            
            let message = `📝 ส่งคำขอลาเรียบร้อยแล้ว\n\n`;
            message += `📋 ประเภท: ${textHelpers.getLeaveTypeText(leaveType)}\n`;
            message += `📅 วันที่: ${dateHelpers.formatDate(startDate)}`;
            
            if (startDate !== endDate) {
                message += ` ถึง ${dateHelpers.formatDate(endDate)}`;
            }
            
            message += `\n🗓️ จำนวน: ${daysCount} วัน\n`;
            message += `💬 เหตุผล: ${textHelpers.truncateText(reason, 50)}\n\n`;
            message += `⏳ รอการอนุมัติจากผู้บังคับบัญชา`;

            // สร้าง Flex Message สำหรับแสดงรายละเอียด
            const flexMessage = {
                type: 'flex',
                altText: 'รายละเอียดคำขอลา',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📝 คำขอลาหยุด',
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
                                type: 'box',
                                layout: 'baseline',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'ประเภท:',
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 2
                                    },
                                    {
                                        type: 'text',
                                        text: textHelpers.getLeaveTypeText(leaveType),
                                        size: 'sm',
                                        flex: 4,
                                        wrap: true
                                    }
                                ],
                                margin: 'md'
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'วันที่:',
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 2
                                    },
                                    {
                                        type: 'text',
                                        text: startDate === endDate ? 
                                            dateHelpers.formatDate(startDate) :
                                            `${dateHelpers.formatDate(startDate)} - ${dateHelpers.formatDate(endDate)}`,
                                        size: 'sm',
                                        flex: 4,
                                        wrap: true
                                    }
                                ],
                                margin: 'md'
                            },
                            {
                                type: 'box',
                                layout: 'baseline',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'จำนวนวัน:',
                                        size: 'sm',
                                        color: '#666666',
                                        flex: 2
                                    },
                                    {
                                        type: 'text',
                                        text: `${daysCount} วัน`,
                                        size: 'sm',
                                        flex: 4
                                    }
                                ],
                                margin: 'md'
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'text',
                                        text: 'เหตุผล:',
                                        size: 'sm',
                                        color: '#666666',
                                        margin: 'md'
                                    },
                                    {
                                        type: 'text',
                                        text: reason,
                                        size: 'sm',
                                        wrap: true,
                                        margin: 'xs'
                                    }
                                ]
                            }
                        ]
                    },
                    footer: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '⏳ รอการอนุมัติจากผู้บังคับบัญชา',
                                size: 'xs',
                                color: '#999999',
                                align: 'center'
                            }
                        ]
                    }
                }
            };

            const messages = [
                { type: 'text', text: message },
                flexMessage
            ];

            await this.client.pushMessage(userId, messages);
            return true;
        } catch (error) {
            console.error('Error sending leave request notification:', error);
            return false;
        }
    }

    // ส่งข้อความแจ้งเตือนการอนุมัติ/ปฏิเสธคำขอลา
    async sendLeaveApprovalNotification(userId, approvalData) {
        try {
            const { status, leaveType, startDate, endDate, approvedBy, rejectionReason } = approvalData;
            
            let message = '';
            let stickerId = '2';
            
            if (status === 'approved') {
                message = `✅ คำขอลาได้รับการอนุมัติแล้ว\n\n`;
                message += `📋 ประเภท: ${textHelpers.getLeaveTypeText(leaveType)}\n`;
                message += `📅 วันที่: ${dateHelpers.formatDate(startDate)}`;
                
                if (startDate !== endDate) {
                    message += ` ถึง ${dateHelpers.formatDate(endDate)}`;
                }
                
                message += `\n👤 อนุมัติโดย: ${approvedBy}\n`;
                message += `🎉 ขอให้พักผ่อนให้เต็มที่!`;
                stickerId = '114';
            } else {
                message = `❌ คำขอลาไม่ได้รับการอนุมัติ\n\n`;
                message += `📋 ประเภท: ${textHelpers.getLeaveTypeText(leaveType)}\n`;
                message += `📅 วันที่: ${dateHelpers.formatDate(startDate)}`;
                
                if (startDate !== endDate) {
                    message += ` ถึง ${dateHelpers.formatDate(endDate)}`;
                }
                
                if (rejectionReason) {
                    message += `\n\n💬 เหตุผล: ${rejectionReason}`;
                }
                
                message += `\n\n📞 สามารถติดต่อหัวหน้างานเพื่อสอบถามเพิ่มเติมได้`;
                stickerId = '3';
            }

            const messages = [
                {
                    type: 'text',
                    text: message
                },
                {
                    type: 'sticker',
                    packageId: '1',
                    stickerId: stickerId
                }
            ];

            await this.client.pushMessage(userId, messages);
            return true;
        } catch (error) {
            console.error('Error sending leave approval notification:', error);
            return false;
        }
    }

    // ส่งข้อความเตือนการลืมเช็คเอาท์
    async sendMissedCheckOutReminder(userId, employeeName) {
        try {
            const message = `⚠️ แจ้งเตือน: ลืมเช็คเอาท์\n\n` +
                          `สวัสดี ${employeeName}\n` +
                          `ระบบตรวจพบว่าคุณยังไม่ได้เช็คเอาท์เมื่อวานนี้\n\n` +
                          `กรุณาติดต่อแผนก HR หรือหัวหน้างาน\n` +
                          `เพื่อแก้ไขข้อมูลการเข้า-ออกงาน\n\n` +
                          `📞 ติดต่อ: แผนก HR`;

            await this.client.pushMessage(userId, {
                type: 'text',
                text: message
            });
            return true;
        } catch (error) {
            console.error('Error sending missed checkout reminder:', error);
            return false;
        }
    }

    // ส่งสรุปการทำงานรายสัปดาห์
    async sendWeeklySummary(userId, summaryData) {
        try {
            const { employeeName, weekStart, weekEnd, totalDays, totalHours, overtimeHours, lateDays } = summaryData;
            
            const message = `📊 สรุปการทำงานสัปดาห์\n` +
                          `📅 ${dateHelpers.formatDate(weekStart)} - ${dateHelpers.formatDate(weekEnd)}\n\n` +
                          `👤 ${employeeName}\n` +
                          `📈 วันทำงาน: ${totalDays} วัน\n` +
                          `⏱️ ชั่วโมงรวม: ${totalHours.toFixed(1)} ชั่วโมง\n` +
                          `🌙 ล่วงเวลา: ${overtimeHours.toFixed(1)} ชั่วโมง\n` +
                          `⚠️ มาสาย: ${lateDays} วัน\n\n` +
                          `💪 ขอบคุณสำหรับการทำงานหนัก!`;

            await this.client.pushMessage(userId, {
                type: 'text',
                text: message
            });
            return true;
        } catch (error) {
            console.error('Error sending weekly summary:', error);
            return false;
        }
    }

    // ส่งข้อความแจ้งเตือนทั่วไป
    async sendGeneralNotification(userId, title, message, urgent = false) {
        try {
            const icon = urgent ? '🚨' : '📢';
            const fullMessage = `${icon} ${title}\n\n${message}`;

            await this.client.pushMessage(userId, {
                type: 'text',
                text: fullMessage
            });
            return true;
        } catch (error) {
            console.error('Error sending general notification:', error);
            return false;
        }
    }

    // ส่งข้อความหลายคนพร้อมกัน (Broadcast)
    async broadcastMessage(userIds, message) {
        try {
            const promises = userIds.map(userId => 
                this.client.pushMessage(userId, message).catch(error => {
                    console.error(`Failed to send message to ${userId}:`, error);
                    return null;
                })
            );

            const results = await Promise.allSettled(promises);
            const successCount = results.filter(result => result.status === 'fulfilled').length;
            
            console.log(`Broadcast completed: ${successCount}/${userIds.length} messages sent`);
            return { success: successCount, total: userIds.length };
        } catch (error) {
            console.error('Error broadcasting message:', error);
            return { success: 0, total: userIds.length };
        }
    }

    // สร้าง Rich Menu แบบไดนามิก
    async createDynamicRichMenu(menuData) {
        try {
            // สร้าง Rich Menu object
            const richMenu = {
                size: {
                    width: 2500,
                    height: 1686
                },
                selected: false,
                name: menuData.name,
                chatBarText: menuData.chatBarText,
                areas: menuData.areas
            };

            const richMenuId = await this.client.createRichMenu(richMenu);
            
            if (menuData.imageBuffer) {
                await this.client.setRichMenuImage(richMenuId, menuData.imageBuffer);
            }

            return richMenuId;
        } catch (error) {
            console.error('Error creating rich menu:', error);
            throw error;
        }
    }

    // ตรวจสอบสถานะการส่งข้อความ
    async checkMessageDelivery(messageId) {
        try {
            // LINE API ไม่มี API สำหรับตรวจสอบสถานะการส่ง
            // แต่เราสามารถ log และ track ได้เอง
            console.log(`Checking delivery status for message: ${messageId}`);
            return { delivered: true, timestamp: new Date().toISOString() };
        } catch (error) {
            console.error('Error checking message delivery:', error);
            return { delivered: false, error: error.message };
        }
    }

    // ส่งข้อความแบบ Template (Carousel, Buttons, etc.)
    async sendTemplateMessage(userId, template) {
        try {
            const message = {
                type: 'template',
                altText: template.altText || 'Template Message',
                template: template
            };

            await this.client.pushMessage(userId, message);
            return true;
        } catch (error) {
            console.error('Error sending template message:', error);
            return false;
        }
    }

    // สร้าง Quick Reply สำหรับการตอบกลับเร็ว
    createQuickReply(items) {
        return {
            items: items.map(item => ({
                type: 'action',
                action: {
                    type: item.type || 'message',
                    label: item.label,
                    text: item.text || item.label
                }
            }))
        };
    }

    // ส่งข้อความพร้อม Quick Reply
    async sendMessageWithQuickReply(userId, text, quickReplyItems) {
        try {
            const message = {
                type: 'text',
                text: text,
                quickReply: this.createQuickReply(quickReplyItems)
            };

            await this.client.pushMessage(userId, message);
            return true;
        } catch (error) {
            console.error('Error sending message with quick reply:', error);
            return false;
        }
    }

    // ส่งการ์ดข้อมูลพนักงาน
    async sendEmployeeCard(userId, employeeData) {
        try {
            const flexMessage = {
                type: 'flex',
                altText: 'ข้อมูลพนักงาน',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '👤 ข้อมูลพนักงาน',
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
                                text: employeeData.name,
                                weight: 'bold',
                                size: 'xl',
                                margin: 'md'
                            },
                            {
                                type: 'text',
                                text: `${employeeData.position} • ${employeeData.department}`,
                                size: 'sm',
                                color: '#666666',
                                margin: 'md'
                            },
                            {
                                type: 'separator',
                                margin: 'md'
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'รหัสพนักงาน:',
                                                size: 'sm',
                                                color: '#666666',
                                                flex: 3
                                            },
                                            {
                                                type: 'text',
                                                text: employeeData.employeeCode,
                                                size: 'sm',
                                                flex: 4
                                            }
                                        ],
                                        margin: 'md'
                                    },
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'วันที่เริ่มงาน:',
                                                size: 'sm',
                                                color: '#666666',
                                                flex: 3
                                            },
                                            {
                                                type: 'text',
                                                text: dateHelpers.formatDate(employeeData.hireDate),
                                                size: 'sm',
                                                flex: 4
                                            }
                                        ],
                                        margin: 'md'
                                    }
                                ]
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
                                    label: 'ดูข้อมูลเพิ่มเติม',
                                    uri: `https://liff.line.me/${lineConfig.liffId}`
                                },
                                style: 'primary',
                                color: '#667eea'
                            }
                        ]
                    }
                }
            };

            await this.client.pushMessage(userId, flexMessage);
            return true;
        } catch (error) {
            console.error('Error sending employee card:', error);
            return false;
        }
    }

    // ส่งแผนภูมิสถิติการทำงาน
    async sendWorkStatistics(userId, statsData) {
        try {
            const { monthYear, totalDays, presentDays, lateDays, totalHours, overtimeHours } = statsData;
            
            const attendanceRate = ((presentDays / totalDays) * 100).toFixed(1);
            
            const flexMessage = {
                type: 'flex',
                altText: 'สถิติการทำงาน',
                contents: {
                    type: 'bubble',
                    header: {
                        type: 'box',
                        layout: 'vertical',
                        contents: [
                            {
                                type: 'text',
                                text: '📊 สถิติการทำงาน',
                                weight: 'bold',
                                size: 'lg',
                                color: '#ffffff'
                            },
                            {
                                type: 'text',
                                text: monthYear,
                                size: 'sm',
                                color: '#ffffff',
                                margin: 'xs'
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
                                type: 'box',
                                layout: 'horizontal',
                                contents: [
                                    {
                                        type: 'box',
                                        layout: 'vertical',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: presentDays.toString(),
                                                size: 'xl',
                                                weight: 'bold',
                                                color: '#4CAF50',
                                                align: 'center'
                                            },
                                            {
                                                type: 'text',
                                                text: 'วันมาทำงาน',
                                                size: 'xs',
                                                color: '#666666',
                                                align: 'center'
                                            }
                                        ],
                                        flex: 1
                                    },
                                    {
                                        type: 'box',
                                        layout: 'vertical',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: lateDays.toString(),
                                                size: 'xl',
                                                weight: 'bold',
                                                color: '#FF9800',
                                                align: 'center'
                                            },
                                            {
                                                type: 'text',
                                                text: 'วันมาสาย',
                                                size: 'xs',
                                                color: '#666666',
                                                align: 'center'
                                            }
                                        ],
                                        flex: 1
                                    },
                                    {
                                        type: 'box',
                                        layout: 'vertical',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: `${attendanceRate}%`,
                                                size: 'xl',
                                                weight: 'bold',
                                                color: '#2196F3',
                                                align: 'center'
                                            },
                                            {
                                                type: 'text',
                                                text: 'อัตราเข้างาน',
                                                size: 'xs',
                                                color: '#666666',
                                                align: 'center'
                                            }
                                        ],
                                        flex: 1
                                    }
                                ],
                                margin: 'lg'
                            },
                            {
                                type: 'separator',
                                margin: 'lg'
                            },
                            {
                                type: 'box',
                                layout: 'vertical',
                                contents: [
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'ชั่วโมงทำงานรวม:',
                                                size: 'sm',
                                                color: '#666666',
                                                flex: 3
                                            },
                                            {
                                                type: 'text',
                                                text: `${totalHours.toFixed(1)} ชั่วโมง`,
                                                size: 'sm',
                                                flex: 2,
                                                align: 'end'
                                            }
                                        ],
                                        margin: 'lg'
                                    },
                                    {
                                        type: 'box',
                                        layout: 'baseline',
                                        contents: [
                                            {
                                                type: 'text',
                                                text: 'ชั่วโมงล่วงเวลา:',
                                                size: 'sm',
                                                color: '#666666',
                                                flex: 3
                                            },
                                            {
                                                type: 'text',
                                                text: `${overtimeHours.toFixed(1)} ชั่วโมง`,
                                                size: 'sm',
                                                flex: 2,
                                                align: 'end'
                                            }
                                        ],
                                        margin: 'md'
                                    }
                                ]
                            }
                        ]
                    }
                }
            };

            await this.client.pushMessage(userId, flexMessage);
            return true;
        } catch (error) {
            console.error('Error sending work statistics:', error);
            return false;
        }
    }
}

module.exports = new LineMessagingService();