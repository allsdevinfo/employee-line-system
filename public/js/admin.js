// public/js/admin.js  (REPLACE ALL)

// ---- Helpers ----
const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

const state = {
  base: location.origin,
  adminKey: localStorage.getItem('ADMIN_API_KEY') || '',
  positions: [], // <- โหลดครั้งเดียวไว้ใช้ทุกแถว
};

const api = {
  async getJSON(path, opts = {}) {
    const r = await fetch(path, { headers: api.headers(), ...opts });
    if (!r.ok) {
      let msg = '';
      try { msg = (await r.json()).error || ''; } catch {}
      throw new Error(msg || r.statusText);
    }
    return r.json();
  },
  headers() {
    const h = { 'Content-Type': 'application/json' };
    if (state.adminKey) h['X-Admin-Key'] = state.adminKey;
    return h;
  },
  // --- Endpoints ---
  listPositions() {
    return this.getJSON(`/api/admin/positions`);
  },
  listPendingEmployees({ search = '' } = {}) {
    const q = new URLSearchParams({ status: 'pending', limit: 50, page: 1, ...(search ? { search } : {}) });
    return this.getJSON(`/api/admin/employees?${q}`);
  },
  listEmployees({ status = '', search = '' } = {}) {
    const q = new URLSearchParams({ limit: 50, page: 1 });
    if (status) q.set('status', status);
    if (search) q.set('search', search);
    return this.getJSON(`/api/admin/employees?${q}`);
  },
  approveEmployee(id, payload) {
    // ส่งค่าครบ: status, positionId, salary, phone (required), email
    return this.getJSON(`/api/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active', ...payload }),
    });
  },
  rejectEmployee(id) {
    const reason = prompt('เหตุผลที่ปฏิเสธ (ไม่บังคับ)') || null;
    return this.getJSON(`/api/admin/employees/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'inactive', rejection_reason: reason }),
    });
  },
  listPendingLeaves() {
    const q = new URLSearchParams({ status: 'pending', limit: 50, page: 1 });
    return this.getJSON(`/api/admin/leaves?${q}`);
  },
  approveLeave(id) {
    return this.getJSON(`/api/admin/leaves/${id}/approve`, { method: 'PUT', body: JSON.stringify({}) });
  },
  rejectLeave(id) {
    const reason = prompt('เหตุผลที่ปฏิเสธ (ไม่บังคับ)') || null;
    return this.getJSON(`/api/admin/leaves/${id}/reject`, { method: 'PUT', body: JSON.stringify({ rejectionReason: reason }) });
  },
  stats() { return this.getJSON('/api/admin'); },
};

// ---- UI Actions ----
function setAdminKeyUI() {
  const input = $('#adminKey');
  input.value = state.adminKey;
  const sel = $('#filterStatus');
  if (sel) sel.value = '';
}

$('#saveKeyBtn').addEventListener('click', () => {
  state.adminKey = $('#adminKey').value.trim();
  localStorage.setItem('ADMIN_API_KEY', state.adminKey);
  alert('บันทึก X-Admin-Key แล้ว');
  refreshAll();
});

$$('#tabs .tab').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('#tabs .tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    ['pendingEmployees', 'employees', 'pendingLeaves', 'dashboard'].forEach(name => {
      const v = $('#view_' + name);
      v.style.display = (name === tab ? 'block' : 'none');
    });
  });
});

function badge(status) {
  const cls = `pill ${status}`;
  const map = { pending: 'รออนุมัติ', active: 'ใช้งาน', inactive: 'ปิดใช้งาน' };
  return `<span class="${cls}">${map[status] || status}</span>`;
}

function positionSelectHtml(empId, currentTitle = '') {
  const opts = state.positions.map(p => {
    const selected = (p.title === currentTitle) ? 'selected' : '';
    const range = `(${Number(p.min_salary).toLocaleString()}-${Number(p.max_salary).toLocaleString()})`;
    return `<option value="${p.id}" ${selected} data-min="${p.min_salary}" data-max="${p.max_salary}">${p.title} ${range}</option>`;
  }).join('');
  return `<select id="pos_${empId}" class="in">${opts}</select>`;
}

async function renderPendingEmployees() {
  // โหลดตำแหน่งครั้งแรก
  if (!state.positions.length) {
    const posRes = await api.listPositions();
    state.positions = posRes?.data || [];
  }

  const search = $('#searchPendingEmp').value.trim();
  const data = await api.listPendingEmployees({ search });
  const tbody = $('#tablePendingEmp tbody');

  const items = (data?.data?.items || data?.data || []);
  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted">ไม่มีคำขอรออนุมัติ</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(emp => {
    // หาตำแหน่งที่ตรงกับชื่อเดิม (ถ้ามี)
    const pos = state.positions.find(p => p.title === emp.position) || state.positions[0];
    const salaryVal = emp.salary ?? pos?.min_salary ?? '';

    return `
      <tr data-id="${emp.id}">
        <td>${emp.employeeCode || '-'}</td>
        <td>${emp.name || '-'}</td>
        <td>${emp.department || '-'}</td>
        <td>${positionSelectHtml(emp.id, emp.position || '')}</td>
        <td style="max-width:140px">
          <input type="number" class="in" id="sal_${emp.id}" placeholder="เงินเดือน"
                 value="${salaryVal}" min="${pos?.min_salary ?? 0}" step="100">
          <small id="hint_${emp.id}" class="muted"></small>
        </td>
        <td>
          <input type="text" class="in" id="phone_${emp.id}" placeholder="เบอร์ (บังคับ)" value="${emp.phone || ''}">
        </td>
        <td>
          <input type="text" class="in" id="email_${emp.id}" placeholder="อีเมล" value="${emp.email || ''}">
        </td>
        <td>${badge(emp.status || 'pending')}</td>
        <td class="row" style="gap:6px">
          <button class="btn ok" onclick="onApproveEmp(${emp.id})">อนุมัติ</button>
          <button class="btn danger" onclick="onRejectEmp(${emp.id})">ปฏิเสธ</button>
        </td>
      </tr>`;
  }).join('');

  // bind change เพื่ออัปเดต min/max hint & clamp
  items.forEach(emp => {
    const sel = $(`#pos_${emp.id}`);
    const sal = $(`#sal_${emp.id}`);
    const hint = $(`#hint_${emp.id}`);
    const updateHint = () => {
      const opt = sel.options[sel.selectedIndex];
      const min = Number(opt.dataset.min || 0);
      const max = Number(opt.dataset.max || 0);
      hint.textContent = `ช่วงที่กำหนด: ${min.toLocaleString()} - ${max.toLocaleString()} บาท`;
      if (sal.value !== '') {
        let v = Number(sal.value);
        if (v < min) v = min;
        if (v > max) v = max;
        sal.value = v;
        sal.min = String(min);
      }
    };
    sel?.addEventListener('change', updateHint);
    updateHint();
  });
}

async function renderEmployees() {
  const status = $('#filterStatus').value;
  const search = $('#searchEmp').value.trim();

  const res = await api.listEmployees({ status, search });
  const items = (res?.data?.items || res?.data || []);
  const tbody = $('#tableEmp tbody');

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">ไม่พบข้อมูล</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(emp => {
    const hired = emp.hireDate || '-';
    return `
      <tr>
        <td>${emp.employeeCode || '-'}</td>
        <td>${emp.name || '-'}</td>
        <td>${emp.position || '-'}</td>
        <td>${emp.department || '-'}</td>
        <td>${hired}</td>
        <td>${badge(emp.status || '-')}</td>
        <td class="row" style="gap:6px">
          ${emp.status !== 'active' ? `<button class="btn ok" onclick="onApproveEmp(${emp.id})">อนุมัติ</button>` : ''}
          ${emp.status !== 'inactive' ? `<button class="btn danger" onclick="onRejectEmp(${emp.id})">ปิดใช้งาน</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

async function renderLeaves() {
  const data = await api.listPendingLeaves();
  const tbody = $('#tableLeaves tbody');
  const items = (data?.data?.items || data?.data || []);

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="muted">ไม่พบคำขอลา</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(x => {
    const period = `${x.startDate} → ${x.endDate}`;
    const typeMap = { sick: 'ลาป่วย', personal: 'ลากิจ', vacation: 'ลาพักผ่อน', emergency: 'ฉุกเฉิน', maternity: 'ลาคลอด', paternity: 'ลาบิดา' };
    const type = typeMap[x.leaveType] || x.leaveType;
    return `
      <tr>
        <td>${x.employee?.code || '-'}</td>
        <td>${x.employee?.name || '-'}</td>
        <td>${type}</td>
        <td>${period}</td>
        <td>${x.daysCount}</td>
        <td>${(x.reason || '').replace(/</g, '&lt;')}</td>
        <td class="row" style="gap:6px">
          <button class="btn ok" onclick="onApproveLeave(${x.id})">อนุมัติ</button>
          <button class="btn danger" onclick="onRejectLeave(${x.id})">ปฏิเสธ</button>
        </td>
      </tr>`;
  }).join('');
}

async function renderStats() {
  const st = await api.stats();
  const s = st?.data || {};
  $('#kpiTotal').textContent = s.overview?.totalEmployees ?? '-';
  $('#kpiActive').textContent = s.overview?.activeEmployees ?? '-';
  $('#kpiPendingLeave').textContent = s.overview?.pendingLeaves ?? '-';
  $('#dashboardJson').textContent = JSON.stringify(s, null, 2);
}

// ---- Handlers ----
async function onApproveEmp(id) {
  const pos = $(`#pos_${id}`)?.value?.trim() || '';
  const salRaw = $(`#sal_${id}`)?.value || '';
  const salary = salRaw === '' ? null : Number(salRaw);

  const phone = prompt('กรุณากรอกเบอร์โทร (บังคับ)')?.trim();
  if (!phone) {
    alert('เบอร์โทรเป็นข้อมูลบังคับ');
    return;
  }

  const email = prompt('กรุณากรอกอีเมล (ถ้ามี)')?.trim() || null;

  if (!pos || salary === null || Number.isNaN(salary)) {
    alert('กรุณากรอก "ตำแหน่ง" และ "เงินเดือน" ให้ครบถ้วน');
    return;
  }

  try {
    await api.approveEmployee(id, { 
      position,  // หรือ positionId ถ้าจะใช้ตามตาราง positions
      salary, 
      phone, 
      email 
    });
    await renderPendingEmployees();
    await renderEmployees();
  } catch (err) {
    console.error(err);
    alert('ไม่สามารถอนุมัติพนักงานได้: ' + (err.message || ''));
  }
}

async function onRejectEmp(id) {
  if (!confirm('ยืนยันการปฏิเสธ/ปิดใช้งานพนักงานคนนี้?')) return;
  await api.rejectEmployee(id);
  await renderPendingEmployees();
  await renderEmployees();
}
async function onApproveLeave(id) {
  if (!confirm('ยืนยันการอนุมัติคำขอลา?')) return;
  await api.approveLeave(id);
  await renderLeaves();
  await renderStats();
}
async function onRejectLeave(id) {
  if (!confirm('ยืนยันการปฏิเสธคำขอลา?')) return;
  await api.rejectLeave(id);
  await renderLeaves();
  await renderStats();
}

// export
window.onApproveEmp = onApproveEmp;
window.onRejectEmp = onRejectEmp;
window.onApproveLeave = onApproveLeave;
window.onRejectLeave = onRejectLeave;

// ---- Wiring ----
$('#refreshPendingEmp').addEventListener('click', renderPendingEmployees);
$('#searchPendingEmp').addEventListener('keydown', (e) => { if (e.key === 'Enter') renderPendingEmployees(); });
$('#refreshEmp').addEventListener('click', renderEmployees);
$('#filterStatus').addEventListener('change', renderEmployees);
$('#searchEmp').addEventListener('keydown', (e) => { if (e.key === 'Enter') renderEmployees(); });
$('#refreshLeaves').addEventListener('click', renderLeaves);

async function refreshAll() {
  await Promise.all([
    renderPendingEmployees(),
    renderEmployees(),
    renderLeaves(),
    renderStats(),
  ]);
}

// init
setAdminKeyUI();
refreshAll().catch(err => { console.error(err); alert('โหลดข้อมูลไม่สำเร็จ: ' + err.message) });
