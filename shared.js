// ===== Shared Priority Queue System (localStorage-backed) =====

const STORAGE_KEY = 'carefirst_queue';
const ID_KEY = 'carefirst_nextId';
const ADMIN_KEY = 'carefirst_admin';
const ADMIN_PASSWORD = 'CareFirst@2026';

// Severity weights — Critical always first, then elderly get boosted
const SEVERITY_SCORE = { critical: 300, severe: 150, moderate: 80, mild: 30 };

function calculatePriority(age, severity) {
  let score = SEVERITY_SCORE[severity] || 0;
  // Elder bonus (applies within same severity tier)
  if (age >= 65) {
    score += 40;
    if (age >= 80) score += 15; // total +55 for 80+
  }
  // Young children bonus
  if (age <= 5) score += 20;
  return score;
}

// Load queue from localStorage
let queue = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
let nextId = parseInt(localStorage.getItem(ID_KEY) || '1', 10);

// Recalculate all priorities (in case scoring changed)
queue.forEach(p => { p.priority = calculatePriority(p.age, p.severity); });
saveQueue();

// Admin state
let isAdmin = localStorage.getItem(ADMIN_KEY) === 'true';

// Seed demo data on first visit
if (queue.length === 0 && !localStorage.getItem('carefirst_seeded')) {
  const demo = [
    { name: 'Margaret Williams', age: 78, gender: 'Female', severity: 'severe', symptoms: 'Chest pain, shortness of breath' },
    { name: 'James Carter', age: 34, gender: 'Male', severity: 'mild', symptoms: 'Minor headache, sore throat' },
    { name: 'Robert Chen', age: 82, gender: 'Male', severity: 'critical', symptoms: 'Stroke symptoms, slurred speech' },
    { name: 'Sarah Ahmed', age: 45, gender: 'Female', severity: 'moderate', symptoms: 'High fever, body aches' },
    { name: 'Dorothy Evans', age: 91, gender: 'Female', severity: 'moderate', symptoms: 'Dizziness, joint pain' },
    { name: 'Michael Torres', age: 28, gender: 'Male', severity: 'mild', symptoms: 'Sprained ankle' },
  ];
  demo.forEach(d => {
    queue.push({
      id: nextId++,
      ...d,
      priority: calculatePriority(d.age, d.severity),
      status: 'waiting',
      arrivedAt: new Date().toISOString()
    });
  });
  saveQueue();
  localStorage.setItem('carefirst_seeded', 'true');
}

function saveQueue() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  localStorage.setItem(ID_KEY, String(nextId));
}

function getPriorityClass(score) {
  if (score >= 250) return 'priority-high';
  if (score >= 120) return 'priority-medium';
  return 'priority-low';
}

function sortQueue() {
  queue.sort((a, b) => {
    if (a.status === 'done' && b.status !== 'done') return 1;
    if (b.status === 'done' && a.status !== 'done') return -1;
    if (a.status === 'serving' && b.status !== 'serving') return -1;
    if (b.status === 'serving' && a.status !== 'serving') return 1;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id - b.id;
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Animated counter
function animateCounter(el, target) {
  if (!el) return;
  const current = parseInt(el.textContent, 10) || 0;
  if (current === target) { el.textContent = target; return; }
  const diff = Math.abs(target - current);
  const step = target > current ? 1 : -1;
  const speed = Math.max(30, Math.min(80, 300 / diff));
  let val = current;
  const interval = setInterval(() => {
    val += step;
    el.textContent = val;
    if (val === target) clearInterval(interval);
  }, speed);
}

// Update just the stats
function updateStats() {
  const totalEl = document.getElementById('totalCount');
  const criticalEl = document.getElementById('criticalCount');
  const elderEl = document.getElementById('elderCount');
  const active = queue.filter(p => p.status !== 'done');
  animateCounter(totalEl, active.length);
  animateCounter(criticalEl, active.filter(p => p.severity === 'critical').length);
  animateCounter(elderEl, active.filter(p => p.age >= 65).length);
}

// ===== Admin Functions =====
function adminLogin() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.add('show');
}

function adminLogout() {
  isAdmin = false;
  localStorage.removeItem(ADMIN_KEY);
  updateAdminUI();
  if (typeof renderQueue === 'function') renderQueue();
}

function handleAdminLogin() {
  const input = document.getElementById('adminPassword');
  const error = document.getElementById('adminError');
  if (input.value === ADMIN_PASSWORD) {
    isAdmin = true;
    localStorage.setItem(ADMIN_KEY, 'true');
    const modal = document.getElementById('adminModal');
    if (modal) modal.classList.remove('show');
    input.value = '';
    error.hidden = true;
    updateAdminUI();
    if (typeof renderQueue === 'function') renderQueue();
  } else {
    error.hidden = false;
    input.value = '';
    input.focus();
  }
}

function closeAdminModal() {
  const modal = document.getElementById('adminModal');
  if (modal) modal.classList.remove('show');
  const error = document.getElementById('adminError');
  if (error) error.hidden = true;
}

function updateAdminUI() {
  const loginBtn = document.getElementById('adminLoginBtn');
  const logoutBtn = document.getElementById('adminLogoutBtn');
  const adminBadge = document.getElementById('adminBadge');
  if (loginBtn) loginBtn.style.display = isAdmin ? 'none' : '';
  if (logoutBtn) logoutBtn.style.display = isAdmin ? '' : 'none';
  if (adminBadge) adminBadge.style.display = isAdmin ? '' : 'none';
}

// Delete single patient
window.deletePatient = function(id) {
  if (!isAdmin) return;
  const p = queue.find(x => x.id === id);
  if (p && confirm(`Delete record for "${p.name}"? This cannot be undone.`)) {
    queue = queue.filter(x => x.id !== id);
    saveQueue();
    renderQueue();
  }
};

// Delete all completed patients
window.clearCompleted = function() {
  if (!isAdmin) return;
  const completed = queue.filter(p => p.status === 'done');
  if (completed.length === 0) { alert('No completed records to clear.'); return; }
  if (confirm(`Delete all ${completed.length} completed record(s)? This cannot be undone.`)) {
    queue = queue.filter(p => p.status !== 'done');
    saveQueue();
    renderQueue();
  }
};

// Delete ALL patients
window.clearAllPatients = function() {
  if (!isAdmin) return;
  if (queue.length === 0) { alert('Queue is already empty.'); return; }
  if (confirm(`Delete ALL ${queue.length} patient record(s)? This cannot be undone.`)) {
    queue = [];
    saveQueue();
    renderQueue();
  }
};

// Render the queue table
function renderQueue() {
  const tbody = document.getElementById('queueBody');
  updateStats();

  // Show/hide admin controls
  const adminControls = document.getElementById('adminControls');
  if (adminControls) adminControls.style.display = isAdmin ? '' : 'none';

  if (!tbody) return;

  const colSpan = isAdmin ? 9 : 8;

  if (queue.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${colSpan}">No patients in the queue yet. <a href="register.html" style="color:var(--clr-primary);font-weight:700;">Register a patient</a>.</td></tr>`;
    return;
  }

  sortQueue();

  tbody.innerHTML = queue.map((p, i) => {
    const prioClass = getPriorityClass(p.priority);
    const badgeClass = `badge-${p.severity}`;
    let statusClass, statusLabel;
    if (p.status === 'serving') { statusClass = 'status-serving'; statusLabel = 'Serving'; }
    else if (p.status === 'done') { statusClass = 'status-done'; statusLabel = 'Completed'; }
    else { statusClass = 'status-waiting'; statusLabel = 'Waiting'; }

    const elderTag = p.age >= 65 ? ' <span class="elder-tag">Elder</span>' : '';

    let actions = '';
    if (p.status === 'waiting') {
      actions = `<button class="btn btn-sm btn-success" onclick="servePatient(${p.id})">Serve</button>`;
    } else if (p.status === 'serving') {
      actions = `<button class="btn btn-sm btn-danger" onclick="completePatient(${p.id})">Done</button>`;
    } else {
      actions = '<span style="color:#b2bec3;">—</span>';
    }

    const deleteCol = isAdmin
      ? `<td><button class="btn btn-sm btn-delete" onclick="deletePatient(${p.id})" title="Delete record">&#10005;</button></td>`
      : '';

    return `<tr>
      <td><strong>${i + 1}</strong></td>
      <td>${escapeHtml(p.name)}${elderTag}</td>
      <td>${p.age}</td>
      <td>${p.gender}</td>
      <td><span class="badge ${badgeClass}">${p.severity}</span></td>
      <td><span class="priority-score ${prioClass}">${p.priority}</span></td>
      <td><span class="${statusClass}">${statusLabel}</span></td>
      <td>${actions}</td>
      ${deleteCol}
    </tr>`;
  }).join('');

  // Update table header for delete column
  const thead = tbody.closest('table').querySelector('thead tr');
  const existingDeleteTh = thead.querySelector('.delete-th');
  if (isAdmin && !existingDeleteTh) {
    const th = document.createElement('th');
    th.className = 'delete-th';
    th.textContent = 'Delete';
    thead.appendChild(th);
  } else if (!isAdmin && existingDeleteTh) {
    existingDeleteTh.remove();
  }
}

// Render a mini preview table (for home page)
function renderMiniQueue() {
  const tbody = document.getElementById('miniQueueBody');
  if (!tbody) return;

  const active = queue.filter(p => p.status !== 'done');
  sortQueue();
  const top5 = active.slice(0, 5);

  if (top5.length === 0) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No patients yet. <a href="register.html" style="color:var(--clr-primary);font-weight:700;">Register one now</a>.</td></tr>';
    return;
  }

  tbody.innerHTML = top5.map((p, i) => {
    const badgeClass = `badge-${p.severity}`;
    const prioClass = getPriorityClass(p.priority);
    const elderTag = p.age >= 65 ? ' <span class="elder-tag">Elder</span>' : '';
    let statusClass, statusLabel;
    if (p.status === 'serving') { statusClass = 'status-serving'; statusLabel = 'Serving'; }
    else { statusClass = 'status-waiting'; statusLabel = 'Waiting'; }

    return `<tr>
      <td><strong>${i + 1}</strong></td>
      <td>${escapeHtml(p.name)}${elderTag}</td>
      <td><span class="badge ${badgeClass}">${p.severity}</span></td>
      <td><span class="priority-score ${prioClass}">${p.priority}</span></td>
      <td><span class="${statusClass}">${statusLabel}</span></td>
    </tr>`;
  }).join('');
}

// Add patient
function addPatient(name, age, gender, severity, symptoms) {
  const priority = calculatePriority(age, severity);
  queue.push({
    id: nextId++,
    name, age, gender, severity, symptoms, priority,
    status: 'waiting',
    arrivedAt: new Date().toISOString()
  });
  saveQueue();
}

// Serve patient
window.servePatient = function(id) {
  const p = queue.find(x => x.id === id);
  if (p) { p.status = 'serving'; saveQueue(); renderQueue(); }
};

// Complete patient
window.completePatient = function(id) {
  const p = queue.find(x => x.id === id);
  if (p) { p.status = 'done'; saveQueue(); renderQueue(); }
};

// ===== Mobile Nav Toggle =====
document.querySelector('.nav-toggle').addEventListener('click', function() {
  document.querySelector('.navbar').classList.toggle('open');
});

document.querySelectorAll('.nav-links a').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelector('.navbar').classList.remove('open');
  });
});

// ===== Navbar scroll effect =====
window.addEventListener('scroll', () => {
  document.querySelector('.navbar').classList.toggle('scrolled', window.scrollY > 20);
});

// ===== Scroll-triggered fade-up animations =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.fade-up, .fade-left, .fade-right, .scale-in').forEach(el => observer.observe(el));

// Init admin UI on page load
document.addEventListener('DOMContentLoaded', updateAdminUI);
