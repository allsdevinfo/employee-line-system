(() => {
  // ---------- Helpers ----------
  const $  = (sel, el=document) => el.querySelector(sel);
  const $$ = (sel, el=document) => Array.from(el.querySelectorAll(sel));

  const CONFIG = {
    LIFF_ID: null,
    API_BASE: null,
    ENV: 'production',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  async function jsonFetch(url, options = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', ...(options.headers||{}) },
      ...options
    });
    let body = null;
    try { body = await res.json(); } catch {}
    if (!res.ok) {
      const msg = body?.error || body?.message || res.statusText || 'Request failed';
      const e = new Error(msg);
      e.code = body?.code;
      e.status = res.status;
      throw e;
    }
    return body;
  }

  // ---------- UI helpers ----------
  const UI = {
    showApp(){ const el = $('#app'); if (el) el.style.display = 'block'; },
    hideLoading(){ const el = $('#loading'); if (el) el.style.display = 'none'; },
    showModal(){ const m = $('#modal'); if (m){ m.style.display='block'; document.body.style.overflow='hidden'; } },
    closeModal(){ const m = $('#modal'); if (m){ m.style.display='none'; document.body.style.overflow=''; } },
    messageTimer: null,
    toast(msg, type='info', ms=3000){
      const el = $('#message'); if(!el) return;
      el.textContent = msg; el.className = `message ${type}`; el.style.display = 'block';
      clearTimeout(UI.messageTimer);
      UI.messageTimer = setTimeout(()=>{ el.style.display = 'none'; }, ms);
    },
    setHeader(name, statusText, statusClass){
      const nameEl = $('#employee-name'); if (nameEl) nameEl.textContent = name || '-';
      const stEl = $('#work-status'); if (stEl){ stEl.textContent = statusText; stEl.className = `status ${statusClass}`; }
    },
    disableMainButtons(disabled=true){
      ['btn-checkin','btn-leave','btn-welfare','btn-history'].forEach(id=>{
        const el = document.getElementById(id);
        if (el){ el.disabled = disabled; el.style.opacity = disabled? .6 : 1; }
      });
    },
    showPendingCard(text){
      const box = $('#today-status');
      if (!box) return;
      box.innerHTML = `
        <div class="card" style="text-align:center">
          <h3>⏳ ${text}</h3>
          <p style="color:#666">ระบบบันทึกข้อมูลของคุณแล้ว กำลังรอ HR อนุมัติสิทธิ์การใช้งาน</p>
          <p style="color:#999;font-size:13px">เมื่อได้รับการอนุมัติ กรุณาเข้าเมนูอีกครั้ง</p>
        </div>
      `;
    },
    showProblemCard(text){
      const box = $('#today-status');
      if (!box) return;
      box.innerHTML = `
        <div class="card" style="text-align:center">
          <h3>⚠️ ${text}</h3>
          <p style="color:#666">ไม่สามารถดึงข้อมูลพนักงานได้ในขณะนี้ กรุณาลองเข้าใหม่หรือติดต่อ HR/IT</p>
        </div>
      `;
    },
    setTodaySummary(att){
      const elIn  = $('#checkin-time');
      const elOut = $('#checkout-time');
      const elHr  = $('#work-hours');
      const elSt  = $('#attendance-status');
      if (!att?.hasData){
        if (elIn)  elIn.textContent  = '-';
        if (elOut) elOut.textContent = '-';
        if (elHr)  elHr.textContent  = '0 ชั่วโมง';
        if (elSt)  elSt.textContent  = 'ยังไม่ได้เช็คอิน';
        return;
      }
      if (elIn)  elIn.textContent  = att.checkInTime  || '-';
      if (elOut) elOut.textContent = att.checkOutTime || '-';
      const hours = att.finalWorkHours ?? att.currentWorkHours ?? 0;
      if (elHr)  elHr.textContent  = `${parseFloat(hours)} ชั่วโมง`;
      if (elSt)  elSt.textContent  = App.getStatusText(att.status);
    },
    paintAttendanceButton(att){
      const btn = $('#btn-checkin'); if (!btn) return;
      const icon = btn.querySelector('.menu-icon');
      const title = btn.querySelector('.menu-title');
      const sub = btn.querySelector('.menu-subtitle');

      if (att?.isWorkingNow){
        if (icon)  icon.textContent  = '🏃‍♂️';
        if (title) title.textContent = 'เช็คเอาท์';
        if (sub)   sub.textContent   = 'Check Out';
        btn.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
        btn.style.color = '#fff';
        btn.disabled = false;
        return;
      }
      if (att?.isComplete){
        if (icon)  icon.textContent  = '✅';
        if (title) title.textContent = 'เสร็จสิ้น';
        if (sub)   sub.textContent   = 'Completed';
        btn.style.background = '#6c757d';
        btn.style.color = '#fff';
        btn.disabled = true;
        return;
      }
      if (icon)  icon.textContent  = '⏰';
      if (title) title.textContent = 'เข้า-ออกงาน';
      if (sub)   sub.textContent   = 'Check In/Out';
      btn.style.background = '';
      btn.style.color = '';
      btn.disabled = false;
    }
  };

  // ---------- App ----------
  const App = {
    userId: null,
    employee: null,
    today: null,
    isLiffReady: false,

    async init(){
      try {
        // 1) โหลดคอนฟิก
        const cfg = await jsonFetch(`${location.origin}/api/config`).catch(()=>null);
        CONFIG.LIFF_ID = cfg?.data?.liffId || (window.__APP_CONFIG__?.LIFF_ID ?? '');
        CONFIG.API_BASE = cfg?.data?.apiBase || (window.__APP_CONFIG__?.API_BASE ?? '/api');
        CONFIG.ENV = cfg?.data?.env || (window.__APP_CONFIG__?.ENV ?? 'production');
        console.log('[CONFIG]', CONFIG);

        // 2) เริ่ม LIFF
        if (typeof liff === 'undefined') throw new Error('LIFF SDK not loaded');
        await liff.init({ liffId: CONFIG.LIFF_ID });
        this.isLiffReady = true;

        if (!liff.isLoggedIn()){
          liff.login();
          return;
        }

        const profile = await liff.getProfile();
        this.userId = profile.userId;

        // 3) Identify -> สถานะบัญชี
        const identify = await jsonFetch(`${CONFIG.API_BASE}/auth/identify`, {
          method: 'POST',
          body: JSON.stringify({ displayName: profile.displayName }),
          headers: { 'X-User-ID': this.userId }
        }).catch(e => {
          if (e.status === 202) return { data: { status: 'pending', name: profile.displayName } };
          throw e;
        });

        const status = identify?.data?.status;

        if (status === 'inactive'){
          UI.hideLoading(); UI.showApp();
          UI.setHeader(profile.displayName, 'บัญชีถูกระงับ', 'off-work');
          UI.disableMainButtons(true);
          UI.showPendingCard('บัญชีของคุณถูกระงับการใช้งาน กรุณาติดต่อ HR');
          return;
        }

        if (status === 'pending'){
          UI.hideLoading(); UI.showApp();
          UI.setHeader(`สวัสดี ${profile.displayName}`, 'รอ HR อนุมัติ', 'should-work');
          UI.disableMainButtons(true);
          UI.showPendingCard('กำลังตรวจสอบสิทธิ์พนักงาน');
          return;
        }

        // 4) active -> โหลดข้อมูล
        await this.loadEmployee().catch(err => {
          // กันกรณี /api/employee พัง (500)
          console.error('loadEmployee failed:', err);
          UI.setHeader(profile.displayName, 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์', 'off-work');
          UI.disableMainButtons(true);
          UI.showProblemCard('เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์');
          throw err; // ให้เข้า catch ข้างล่าง เพื่อแสดง fallback ที่สวยงาม
        });

        await this.loadToday().catch(()=>{ /* ไม่ critical */ });
        UI.hideLoading(); UI.showApp();

        UI.setHeader(`สวัสดี ${this.employee.name}`, this.getWorkStatusInfo(this.today).text, this.getWorkStatusInfo(this.today).className);
        UI.setTodaySummary(this.today);
        UI.paintAttendanceButton(this.today);

      } catch (err) {
        console.error(err);
        UI.toast('ไม่สามารถเชื่อมต่อระบบได้', 'error', 5000);
        UI.hideLoading(); UI.showApp();
        const appEl = $('#app');
        if (appEl) {
          appEl.innerHTML = `
            <div style="text-align:center;padding:40px">
              <div style="font-size:64px;margin-bottom:20px">⚠️</div>
              <h2 style="color:#666;margin-bottom:16px">ไม่สามารถเชื่อมต่อได้</h2>
              <p style="color:#999;margin-bottom:24px">กรุณาลองใหม่อีกครั้ง หรือติดต่อแผนก IT</p>
              <button class="btn btn-primary" onclick="location.reload()">🔄 ลองใหม่</button>
            </div>
          `;
        }
      }
    },

    // ----- API -----
    async loadEmployee(){
      const res = await jsonFetch(`${CONFIG.API_BASE}/employee`, {
        headers: { 'X-User-ID': this.userId }
      });
      this.employee = res.data;
      if (!this.employee || !this.employee.id) {
        throw new Error('ข้อมูลพนักงานไม่สมบูรณ์');
      }
    },

    async loadToday(){
      const res = await jsonFetch(`${CONFIG.API_BASE}/attendance/today`, {
        headers: { 'X-User-ID': this.userId }
      }).catch(() => ({ data: { hasData:false }}));
      this.today = res.data || { hasData:false };
    },

    // ----- Attendance -----
    async onAttendance(){
      try {
        if (!this.employee){ UI.toast('ไม่พบข้อมูลพนักงาน','error'); return; }

        const isCheckout = !!this.today?.isWorkingNow;
        const action = isCheckout ? 'checkout' : 'checkin';

        UI.toast('กำลังขอตำแหน่งที่ตั้ง...', 'info');

        const location = await this.getLocation();
        UI.toast(`กำลัง${isCheckout ? 'เช็คเอาท์':'เช็คอิน'}...`, 'info');

        const res = await jsonFetch(`${CONFIG.API_BASE}/attendance`, {
          method: 'POST',
          headers: { 'X-User-ID': this.userId },
          body: JSON.stringify({ action, location })
        });

        UI.toast(res.message || 'ดำเนินการสำเร็จ', 'success', 4000);

        await this.loadToday();
        UI.setTodaySummary(this.today);
        UI.paintAttendanceButton(this.today);

        if (this.isLiffReady && liff.isApiAvailable('sendMessages')){
          try { await liff.sendMessages([{ type:'text', text:`✅ ${res.message}` }]); } catch {}
        }
      } catch (e) {
        UI.toast(e.message || 'เกิดข้อผิดพลาด', 'error', 5000);
      }
    },

    // ----- Leave -----
    openLeaveForm(){
      const title = $('#modal-title');
      const body  = $('#modal-body');
      if (title) title.textContent = 'แจ้งการลาหยุด';
      if (body) {
        const today = new Date().toISOString().slice(0,10);
        body.innerHTML = `
          <form id="leave-form">
            <div class="form-group">
              <label>ประเภทการลา <span style="color:red">*</span></label>
              <select name="leaveType" required>
                <option value="">-- เลือกประเภท --</option>
                <option value="sick">🏥 ลาป่วย</option>
                <option value="personal">👤 ลาธุระส่วนตัว</option>
                <option value="vacation">🌴 ลาพักผ่อน</option>
                <option value="emergency">🚨 ลาฉุกเฉิน</option>
                <option value="maternity">👶 ลาคลอด</option>
                <option value="paternity">👨‍👶 ลาบิดา</option>
              </select>
            </div>
            <div class="form-group">
              <label>วันที่ลา (เริ่ม) <span style="color:red">*</span></label>
              <input type="date" name="startDate" required min="${today}">
            </div>
            <div class="form-group">
              <label>วันที่ลา (สิ้นสุด) <span style="color:red">*</span></label>
              <input type="date" name="endDate" required min="${today}">
            </div>
            <div class="form-group">
              <label>เหตุผล <span style="color:red">*</span></label>
              <textarea rows="4" name="reason" minlength="10" maxlength="500" required placeholder="โปรดระบุเหตุผลอย่างน้อย 10 ตัวอักษร..."></textarea>
            </div>
            <div class="form-buttons">
              <button type="button" class="btn btn-secondary" id="btn-cancel-leave">ยกเลิก</button>
              <button type="submit" class="btn btn-primary">ส่งคำขอ</button>
            </div>
          </form>
        `;
        const form = $('#leave-form');
        const cancel = $('#btn-cancel-leave');
        if (cancel) cancel.onclick = UI.closeModal;
        if (form) form.onsubmit = (e)=>this.submitLeave(e);
      }
      UI.showModal();
    },

    async submitLeave(e){
      e.preventDefault();
      const form = e.target;
      const data = Object.fromEntries(new FormData(form).entries());

      if (new Date(data.endDate) < new Date(data.startDate)){
        UI.toast('วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น', 'error');
        return;
      }

      try {
        UI.toast('กำลังส่งคำขอลา...', 'info');
        const res = await jsonFetch(`${CONFIG.API_BASE}/leave`, {
          method: 'POST',
          headers: { 'X-User-ID': this.userId },
          body: JSON.stringify(data)
        });
        UI.toast('ส่งคำขอลาเรียบร้อยแล้ว รอการอนุมัติ', 'success', 4000);
        UI.closeModal();

        if (this.isLiffReady && liff.isApiAvailable('sendMessages')){
          const map = { sick:'ลาป่วย', personal:'ลาธุระส่วนตัว', vacation:'ลาพักผ่อน', emergency:'ลาฉุกเฉิน', maternity:'ลาคลอด', paternity:'ลาบิดา' };
          const text = `📝 ส่งคำขอลาเรียบร้อยแล้ว\nประเภท: ${map[data.leaveType]}\nวันที่: ${data.startDate} ถึง ${data.endDate}\nรอการอนุมัติจากผู้บังคับบัญชา`;
          try { await liff.sendMessages([{ type:'text', text }]); } catch {}
        }
      } catch (err) {
        UI.toast(err.message || 'เกิดข้อผิดพลาดในการส่งคำขอลา', 'error', 5000);
      }
    },

    // ----- Utils -----
    async getLocation(){
      return new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('อุปกรณ์ไม่รองรับตำแหน่งที่ตั้ง'));
        navigator.geolocation.getCurrentPosition(
          pos => resolve({
            latitude:  pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy:  pos.coords.accuracy
          }),
          err => {
            const map = {1:'กรุณาอนุญาตการเข้าถึงตำแหน่งที่ตั้ง',2:'ไม่สามารถระบุตำแหน่งที่ตั้งได้',3:'การระบุตำแหน่งใช้เวลานานเกินไป'};
            reject(new Error(map[err.code] || 'เกิดข้อผิดพลาดในการระบุตำแหน่งที่ตั้ง'));
          },
          { enableHighAccuracy:true, timeout:15000, maximumAge:30000 }
        );
      });
    },

    getWorkStatusInfo(att){
      if (!att) return { text:'🔴 ไม่ทราบสถานะ', className:'off-work' };
      if (att.isWorkingNow) return { text:'🟢 กำลังทำงาน', className:'working' };
      if (att.isComplete)   return { text:'✅ เสร็จสิ้นแล้ว', className:'off-work' };
      const h = new Date().getHours();
      if (h >= 9 && h <= 18) return { text:'🟡 เวลาทำงาน', className:'should-work' };
      return { text:'🔴 นอกเวลาทำงาน', className:'off-work' };
    },

    getStatusText(s){
      const map = { present:'✅ ปกติ', late:'⚠️ สาย', absent:'❌ ขาดงาน', half_day:'⏰ ครึ่งวัน', holiday:'🏖️ วันหยุด' };
      return map[s] || s || '-';
    }
  };

  // ---------- Wire UI ----------
  window.employeeApp = App; // for console debugging
  // export handlers for inline onclick (กันเหนียว)
  window.handleAttendance = () => App.onAttendance();
  window.showLeaveForm   = () => App.openLeaveForm();
  window.showWelfare     = () => UI.toast('ฟีเจอร์สวัสดิการจะพร้อมใช้งานเร็ว ๆ นี้','info');
  window.showHistory     = () => UI.toast('ฟีเจอร์ประวัติการทำงานจะพร้อมใช้งานเร็ว ๆ นี้','info');

  document.addEventListener('DOMContentLoaded', () => {
    const btnCheck = $('#btn-checkin');
    if (btnCheck) btnCheck.addEventListener('click', () => App.onAttendance());

    const btnLeave = $('#btn-leave');
    if (btnLeave) btnLeave.addEventListener('click', () => App.openLeaveForm());

    const btnWelfare = $('#btn-welfare');
    if (btnWelfare) btnWelfare.addEventListener('click', () => UI.toast('ฟีเจอร์สวัสดิการจะพร้อมใช้งานเร็ว ๆ นี้', 'info'));

    const btnHistory = $('#btn-history');
    if (btnHistory) btnHistory.addEventListener('click', () => UI.toast('ฟีเจอร์ประวัติการทำงานจะพร้อมใช้งานเร็ว ๆ นี้', 'info'));

    const closeX = $('.close');
    if (closeX) closeX.addEventListener('click', UI.closeModal);

    App.init();
  });

  window.addEventListener('error', () => UI.toast('เกิดข้อผิดพลาดในระบบ', 'error', 5000));
  window.addEventListener('unhandledrejection', () => UI.toast('เกิดข้อผิดพลาดในระบบ', 'error', 5000));
})();
