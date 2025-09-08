// utils/location.js
const settings = require('../config/settings');

class LocationService {
    constructor() {
        this.earthRadius = 6371000; // รัศมีโลกในหน่วยเมตร
    }

    // คำนวณระยะทางระหว่างสองจุดด้วย Haversine formula
    calculateDistance(lat1, lon1, lat2, lon2) {
        // แปลงองศาเป็นเรเดียน
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = this.earthRadius * c;

        return Math.round(distance); // คืนค่าเป็นเมตร
    }

    // ตรวจสอบว่าอยู่ในรัศมีที่กำหนดหรือไม่
    async isWithinRange(userLat, userLon, maxDistance = null) {
        try {
            // ดึงตำแหน่งสำนักงานและรัศมีจากการตั้งค่า
            const officeLat = await settings.getSetting('office_location_lat', 13.7460);
            const officeLon = await settings.getSetting('office_location_lng', 100.5352);
            const allowedRadius = maxDistance || await settings.getSetting('checkin_radius_meters', 100);

            // คำนวณระยะทาง
            const distance = this.calculateDistance(userLat, userLon, officeLat, officeLon);

            return {
                isWithinRange: distance <= allowedRadius,
                distance: distance,
                allowedRadius: allowedRadius,
                officeLocation: {
                    latitude: officeLat,
                    longitude: officeLon
                },
                userLocation: {
                    latitude: userLat,
                    longitude: userLon
                }
            };
        } catch (error) {
            console.error('Error checking location range:', error);
            throw new Error('ไม่สามารถตรวจสอบตำแหน่งที่ตั้งได้');
        }
    }

    // ตรวจสอบความถูกต้องของพิกัด
    validateCoordinates(latitude, longitude) {
        const errors = [];

        // ตรวจสอบว่าเป็นตัวเลขหรือไม่
        if (isNaN(latitude) || isNaN(longitude)) {
            errors.push('พิกัดต้องเป็นตัวเลข');
            return { isValid: false, errors };
        }

        // ตรวจสอบช่วงของ latitude
        if (latitude < -90 || latitude > 90) {
            errors.push('ค่า latitude ต้องอยู่ระหว่าง -90 ถึง 90');
        }

        // ตรวจสอบช่วงของ longitude
        if (longitude < -180 || longitude > 180) {
            errors.push('ค่า longitude ต้องอยู่ระหว่าง -180 ถึง 180');
        }

        // ตรวจสอบว่าไม่เป็น 0,0 (มักเป็นข้อมูลผิดพลาด)
        if (latitude === 0 && longitude === 0) {
            errors.push('พิกัดไม่ถูกต้อง');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    // แปลงพิกัดเป็นชื่อพื้นที่ (ถ้ามี Google Maps API)
    async reverseGeocode(latitude, longitude) {
        // หากมี Google Maps API Key สามารถใช้ได้
        const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY;
        
        if (!googleMapsApiKey) {
            return {
                success: false,
                message: 'Google Maps API not configured',
                address: `${latitude}, ${longitude}`
            };
        }

        try {
            const fetch = require('node-fetch');
            const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${googleMapsApiKey}&language=th`;
            
            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                return {
                    success: true,
                    address: data.results[0].formatted_address,
                    components: data.results[0].address_components
                };
            } else {
                return {
                    success: false,
                    message: 'ไม่พบข้อมูลที่อยู่',
                    address: `${latitude}, ${longitude}`
                };
            }
        } catch (error) {
            console.error('Reverse geocoding error:', error);
            return {
                success: false,
                message: 'เกิดข้อผิดพลาดในการแปลงพิกัด',
                address: `${latitude}, ${longitude}`
            };
        }
    }

    // ดึงตำแหน่งสำนักงานทั้งหมด (ถ้ามีหลายสาขา)
    async getOfficeLocations() {
        try {
            // ในอนาคตอาจมีการเก็บข้อมูลสาขาหลายแห่งในฐานข้อมูล
            const mainOffice = {
                id: 'main',
                name: 'สำนักงานใหญ่',
                latitude: await settings.getSetting('office_location_lat', 13.7460),
                longitude: await settings.getSetting('office_location_lng', 100.5352),
                radius: await settings.getSetting('checkin_radius_meters', 100),
                address: await settings.getSetting('company_address', ''),
                isActive: true
            };

            return [mainOffice];
        } catch (error) {
            console.error('Error getting office locations:', error);
            throw new Error('ไม่สามารถดึงข้อมูลตำแหน่งสำนักงานได้');
        }
    }

    // หาสำนักงานที่ใกล้ที่สุด
    async findNearestOffice(userLat, userLon) {
        try {
            const offices = await this.getOfficeLocations();
            let nearestOffice = null;
            let shortestDistance = Infinity;

            for (const office of offices) {
                if (!office.isActive) continue;

                const distance = this.calculateDistance(
                    userLat, userLon,
                    office.latitude, office.longitude
                );

                if (distance < shortestDistance) {
                    shortestDistance = distance;
                    nearestOffice = {
                        ...office,
                        distance: distance,
                        isWithinRange: distance <= office.radius
                    };
                }
            }

            return nearestOffice;
        } catch (error) {
            console.error('Error finding nearest office:', error);
            throw new Error('ไม่สามารถหาสำนักงานที่ใกล้ที่สุดได้');
        }
    }

    // สร้าง Google Maps URL
    generateMapsUrl(latitude, longitude, zoom = 16) {
        return `https://maps.google.com/?q=${latitude},${longitude}&z=${zoom}`;
    }

    // คำนวณระยะทางและแสดงในรูปแบบที่อ่านง่าย
    formatDistance(distanceInMeters) {
        if (distanceInMeters < 1000) {
            return `${Math.round(distanceInMeters)} เมตร`;
        } else {
            const km = (distanceInMeters / 1000).toFixed(1);
            return `${km} กิโลเมตร`;
        }
    }

    // ตรวจสอบความแม่นยำของ GPS
    checkGPSAccuracy(accuracy) {
        // accuracy มาจาก HTML5 Geolocation API (หน่วยเมตร)
        if (accuracy <= 5) {
            return { level: 'excellent', message: 'สัญญาณ GPS แม่นยำมาก' };
        } else if (accuracy <= 20) {
            return { level: 'good', message: 'สัญญาณ GPS ดี' };
        } else if (accuracy <= 50) {
            return { level: 'fair', message: 'สัญญาณ GPS ปานกลาง' };
        } else {
            return { level: 'poor', message: 'สัญญาณ GPS แม่นยำต่ำ' };
        }
    }

    // บันทึกประวัติการเช็คอินตามตำแหน่ง
    async logLocationHistory(employeeId, latitude, longitude, action, result) {
        try {
            const dbConfig = require('../config/database');
            
            const locationData = {
                latitude: latitude,
                longitude: longitude,
                timestamp: new Date().toISOString(),
                action: action,
                distance: result.distance,
                isWithinRange: result.isWithinRange,
                accuracy: result.accuracy || null
            };

            // อัปเดตข้อมูลใน attendance table
            const today = new Date().toISOString().split('T')[0];
            const locationField = action === 'checkin' ? 'check_in_location' : 'check_out_location';
            
            await dbConfig.execute(
                `UPDATE attendance SET ${locationField} = ? WHERE employee_id = ? AND date = ?`,
                [JSON.stringify(locationData), employeeId, today]
            );

            return true;
        } catch (error) {
            console.error('Error logging location history:', error);
            return false;
        }
    }
}

module.exports = new LocationService();