// Sidebar toggle
const hamburgerBtn   = document.getElementById('hamburgerBtn');
const sidebar        = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');

hamburgerBtn.addEventListener('click', () => {
sidebar.classList.toggle('open');
sidebarOverlay.classList.toggle('show');
});
sidebarOverlay.addEventListener('click', () => {
sidebar.classList.remove('open');
sidebarOverlay.classList.remove('show');
});

// Guidelines toggle
document.getElementById('guidelinesToggle').addEventListener('click', function() {
const list = document.getElementById('guidelinesList');
list.classList.toggle('open');
this.textContent = list.classList.contains('open') ? 'Hide reminders ↑' : 'Show all reminders ↓';
});

// Step navigation
let currentStep = 1;
function goStep(n) {
currentStep = n;
document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < n) s.classList.add('done');
    else if (i + 1 === n) s.classList.add('active');
});
const section = document.getElementById('section' + n);
if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Tag input
const tagInput = document.getElementById('pointPersonInput');
const tagWrap  = document.getElementById('pointPersonWrap');

tagInput.addEventListener('keydown', function(e) {
if ((e.key === 'Enter' || e.key === ',') && this.value.trim()) {
    e.preventDefault();
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = this.value.trim() + ' <button class="tag-remove" onclick="removeTag(this)">✕</button>';
    tagWrap.insertBefore(tag, this);
    this.value = '';
}
});

tagWrap.addEventListener('click', () => tagInput.focus());

function removeTag(btn) {
btn.closest('.tag').remove();
}

// Publication table rows
let pubRowCount = 2;

function makeSelect(options, name) {
const sel = document.createElement('select');
options.forEach(o => {
    const opt = document.createElement('option');
    opt.text = o; sel.appendChild(opt);
});
return sel;
}

function addPubRow() {
pubRowCount++;
const tbody = document.getElementById('pubTableBody');
const tr = document.createElement('tr');
tr.innerHTML = `
    <td style="color:var(--gray-400);font-size:0.78rem;font-weight:600;">${pubRowCount}</td>
    <td><input type="text" placeholder="Publication description" /></td>
    <td><select>
    <option value="" disabled selected>Type</option>
    <option>Static Post</option><option>Carousel</option><option>Story</option>
    <option>Reel / Video</option><option>Caption Only</option><option>Infographic</option><option>Cover Photo</option>
    </select></td>
    <td><input type="date" /></td>
    <td><input type="time" /></td>
    <td><textarea placeholder="Caption notes…"></textarea></td>
    <td><input type="text" placeholder="Member name" /></td>
    <td><select><option>Pending</option><option>In Progress</option><option>For Review</option><option>Done</option></select></td>
    <td><button class="del-row-btn" onclick="delPubRow(this)" title="Remove"><svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></td>
`;
tbody.appendChild(tr);
}

function delPubRow(btn) {
const tbody = document.getElementById('pubTableBody');
if (tbody.rows.length <= 1) return;
btn.closest('tr').remove();
Array.from(tbody.rows).forEach((r, i) => {
    r.cells[0].textContent = i + 1;
});
pubRowCount = tbody.rows.length;
}

// Publicity plan rows
function addPublicityRow() {
const container = document.getElementById('publicityRows');
const div = document.createElement('div');
div.className = 'timeline-row';
div.innerHTML = `
    <input type="date" class="form-control" style="height:38px;" />
    <input type="text" class="form-control" placeholder="Activity / milestone" style="height:38px;" />
    <input type="text" class="form-control" placeholder="Person responsible" style="height:38px;" />
    <button class="del-row-btn" onclick="this.closest('.timeline-row').remove()" title="Remove">
    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
`;
container.appendChild(div);
}

// Checklist
function toggleCheck(item) {
item.classList.toggle('checked');
updateChecklistProgress();
}

function updateChecklistProgress() {
const items = document.querySelectorAll('.checklist-item');
const checked = document.querySelectorAll('.checklist-item.checked').length;
const pct = Math.round((checked / items.length) * 100);
document.getElementById('checklistFill').style.width = pct + '%';
document.getElementById('checklistCount').textContent = checked + ' / ' + items.length + ' complete';
}

// Toast
function showToast(msg) {
const toast = document.getElementById('toast');
document.getElementById('toastMsg').textContent = msg;
toast.classList.add('show');
setTimeout(() => toast.classList.remove('show'), 2800);
}

// Save draft
// Collect all rollout form data
function collectRolloutData() {
// Point persons from tags
const pointPersons = Array.from(
    document.querySelectorAll('#pointPersonWrap .tag')
).map(t => t.textContent.replace('✕','').trim());

// Publication rows
const publications = Array.from(
    document.querySelectorAll('#pubTableBody tr')
).map(row => {
    const inputs   = row.querySelectorAll('input, select, textarea');
    return {
    title:        inputs[0]?.value || '',
    materialType: inputs[1]?.value || '',
    postingDate:  inputs[2]?.value || null,
    postingTime:  inputs[3]?.value || '',
    captionNotes: inputs[4]?.value || '',
    assignedTo:   inputs[5]?.value || '',
    status:       inputs[6]?.value || 'Pending'
    };
}).filter(p => p.title);

// Publicity plan rows
const publicityPlan = Array.from(
    document.querySelectorAll('#publicityRows .timeline-row')
).map(row => {
    const inputs = row.querySelectorAll('input');
    return {
    date:              inputs[0]?.value || null,
    activity:          inputs[1]?.value || '',
    personResponsible: inputs[2]?.value || ''
    };
}).filter(p => p.activity);

// Checked checklist items
const checklist = Array.from(
    document.querySelectorAll('.checklist-item.checked .check-label')
).map(el => el.textContent.trim());

// Main fields — grab all visible inputs in order
const allInputs = document.querySelectorAll('.form-control');

return {
    projectName:    allInputs[0]?.value || '',
    committee:      allInputs[1]?.value || '',
    projectType:    allInputs[2]?.value || '',
    targetPlatform: allInputs[3]?.value || '',
    priority:       allInputs[4]?.value || '',
    requestingHead: allInputs[5]?.value || '',
    pointPersons,
    startDate:      allInputs[6]?.value || null,
    endDate:        allInputs[7]?.value || null,
    daamDeadline:   allInputs[8]?.value || null,
    eventDate:      allInputs[9]?.value || null,
    description:    allInputs[10]?.value || '',
    keyMessages:    allInputs[11]?.value || '',
    publications,
    publicityPlan,
    checklist
};
}

async function saveDraft() {
const data = collectRolloutData();
try {
    const res = await fetch('/api/rollouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, submit: false })
    });
    const result = await res.json();
    if (result.success) {
    addRevisionEntry('Draft saved', data.requestingHead || 'User', 'Form progress saved.');
    document.getElementById('autoSaveLabel').textContent = 'Saved · just now';
    showToast('Draft saved successfully');
    } else {
    showToast('Save failed: ' + result.message);
    }
} catch (err) {
    showToast('Could not reach server. Check that app.js is running.');
}
}

async function submitRollout() {
const checked = document.querySelectorAll('.checklist-item.checked').length;
const total   = document.querySelectorAll('.checklist-item').length;

if (checked < total) {
    const proceed = confirm(`You have ${total - checked} unchecked item(s) in the checklist. Submit anyway?`);
    if (!proceed) return;
}

const data = collectRolloutData();

try {
    const res = await fetch('/api/rollouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, submit: true })
    });
    const result = await res.json();

    if (result.success) {
    const statusBadge = document.getElementById('globalStatus');
    statusBadge.className = 'status-badge status-review';
    statusBadge.innerHTML = '<span class="dot"></span> Submitted — For Review';
    addRevisionEntry('Rollout submitted for review', data.requestingHead || 'User', 'Sent to chairpersons for review and approval.');
    showToast('Rollout submitted! Chairpersons have been notified.');
    } else {
    showToast('Submission failed: ' + result.message);
    }
} catch (err) {
    showToast('Could not reach server. Check that app.js is running.');
}
}

// Add revision entry
function addRevisionEntry(action, author, note) {
const log = document.getElementById('revisionLog');
const now = new Date();
const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const div = document.createElement('div');
div.className = 'revision-item';
div.style.opacity = '0';
div.innerHTML = `
    <div class="revision-dot-wrap">
    <div class="revision-dot" style="background:var(--orange);"></div>
    <div class="revision-line"></div>
    </div>
    <div class="revision-body">
    <div class="revision-action">${action}</div>
    <div class="revision-meta">${author} · Today, ${time}</div>
    ${note ? `<div class="revision-note">${note}</div>` : ''}
    </div>
`;
log.appendChild(div);
setTimeout(() => { div.style.transition = 'opacity 0.4s'; div.style.opacity = '1'; }, 50);
}

// Auto-save simulation
let autoSaveTimer;
document.querySelectorAll('.form-control, input, select, textarea').forEach(el => {
el.addEventListener('input', () => {
    document.getElementById('autoSaveLabel').textContent = 'Saving…';
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
    document.getElementById('autoSaveLabel').textContent = 'Auto-saved · just now';
    }, 1200);
});
});

// Scroll-based step highlighting
const sections = ['section1','section2','section3','section4'];
window.addEventListener('scroll', () => {
let current = 1;
sections.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el && el.getBoundingClientRect().top < 120) current = i + 1;
});
document.querySelectorAll('.step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i + 1 < current) s.classList.add('done');
    else if (i + 1 === current) s.classList.add('active');
});
});