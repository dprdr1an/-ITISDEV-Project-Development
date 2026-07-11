// Radio card select
function selectCard(el, group) {
el.closest('.radio-cards').querySelectorAll('.radio-card').forEach(c => c.classList.remove('selected'));
el.classList.add('selected');
updateProgress();
}

// Priority select
function selectPriority(level, el) {
document.querySelectorAll('.priority-pill').forEach(p => p.className = 'priority-pill');
el.classList.add('selected-' + level);
updateProgress();
}

// Tag input
const tagInput = document.getElementById('pointPersonInput');
const tagWrap  = document.getElementById('pointPersonWrap');

tagInput.addEventListener('keydown', function(e) {
if ((e.key === 'Enter' || e.key === ',') && this.value.trim()) {
    e.preventDefault();
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = this.value.trim() + ' <button class="tag-remove" onclick="this.parentElement.remove()">✕</button>';
    tagWrap.insertBefore(tag, this);
    this.value = '';
    updateProgress();
}
});
tagWrap.addEventListener('click', () => tagInput.focus());

// Character counters
document.getElementById('projName').addEventListener('input', function() {
const c = document.getElementById('projNameCounter');
c.textContent = this.value.length + ' / 80';
c.className = 'char-counter' + (this.value.length > 70 ? ' warn' : '') + (this.value.length >= 80 ? ' over' : '');
updateProgress();
});
document.getElementById('projDesc').addEventListener('input', function() {
const c = document.getElementById('projDescCounter');
c.textContent = this.value.length + ' / 500';
c.className = 'char-counter' + (this.value.length > 420 ? ' warn' : '') + (this.value.length >= 500 ? ' over' : '');
updateProgress();
});

// Deliverables
function addDeliverable() {
const row = document.createElement('div');
row.className = 'deliverable-row';
row.innerHTML = `
    <input type="text" class="form-control" placeholder="Describe the material needed…" />
    <select class="form-control">
    <option value="" disabled selected>Category</option>
    <option>Static Post</option><option>Carousel</option>
    <option>Story / Story Highlight</option><option>Reel / Video</option>
    <option>Cover Photo</option><option>Infographic</option>
    <option>Caption / Copy</option><option>Email Blast</option><option>Other</option>
    </select>
    <button class="del-btn" onclick="delDeliverable(this)" title="Remove">
    <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>`;
document.getElementById('deliverableRows').appendChild(row);
}

function delDeliverable(btn) {
const rows = document.getElementById('deliverableRows');
if (rows.children.length <= 1) return;
btn.closest('.deliverable-row').remove();
}

// File upload
function handleDragOver(e) { e.preventDefault(); document.getElementById('fileDrop').classList.add('drag-over'); }
function handleDragLeave(e) { document.getElementById('fileDrop').classList.remove('drag-over'); }
function handleDrop(e) {
e.preventDefault();
document.getElementById('fileDrop').classList.remove('drag-over');
addFiles(e.dataTransfer.files);
}
function handleFileSelect(e) { addFiles(e.target.files); }

function addFiles(files) {
const list = document.getElementById('fileList');
Array.from(files).forEach(f => {
    const item = document.createElement('div');
    item.className = 'file-item';
    const size = f.size > 1048576 ? (f.size/1048576).toFixed(1) + ' MB' : (f.size/1024).toFixed(0) + ' KB';
    item.innerHTML = `
    <div class="file-icon"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
    <span class="file-name">${f.name}</span>
    <span class="file-size">${size}</span>
    <button class="file-remove" onclick="this.closest('.file-item').remove()">✕</button>`;
    list.appendChild(item);
});
updateProgress();
}

// Progress tracking
function updateProgress() {
const fields = document.querySelectorAll('.trackable');
let filled = 0;
fields.forEach(f => { if (f.value && f.value !== '') filled++; });

const hasType     = document.querySelector('.radio-card.selected') ? 1 : 0;
const hasPriority = document.querySelector('.priority-pill[class*="selected"]') ? 1 : 0;
const hasTags     = document.querySelectorAll('#pointPersonWrap .tag').length > 0 ? 1 : 0;

const total    = fields.length + 3;
const achieved = filled + hasType + hasPriority + hasTags;
const pct      = Math.min(100, Math.round((achieved / total) * 100));

document.getElementById('progressFill').style.width = pct + '%';
document.getElementById('progressPct').textContent  = pct + '%';

// Update step indicators
const vsteps = ['vstep1','vstep2','vstep3','vstep4'];
const thresholds = [15, 40, 65, 85];
vsteps.forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (pct >= thresholds[i] && i < vsteps.length - 1) el.classList.add('done');
    else if (pct < thresholds[i] && (i === 0 || pct >= thresholds[i-1])) el.classList.add('active');
});
if (pct < 15) document.getElementById('vstep1').classList.add('active');
}

// Scroll-based step highlight
const sections = ['.form-card:nth-child(1)','.form-card:nth-child(2)','.form-card:nth-child(3)','.form-card:nth-child(4)'];
const vstepIds = ['vstep1','vstep2','vstep3','vstep4'];
window.addEventListener('scroll', () => {
const cards = document.querySelectorAll('.form-col .form-card');
let current = 0;
cards.forEach((card, i) => {
    if (card.getBoundingClientRect().top < 120) current = i;
});
vstepIds.forEach((id, i) => {
    const el = document.getElementById(id);
    el.classList.remove('active','done');
    if (i < current) el.classList.add('done');
    else if (i === current) el.classList.add('active');
});
});

// Auto-save simulation
let autoSaveTimer;
document.addEventListener('input', () => {
document.getElementById('autosaveLabel').textContent = 'Saving…';
clearTimeout(autoSaveTimer);
autoSaveTimer = setTimeout(() => {
    document.getElementById('autosaveLabel').textContent = 'Auto-saved · just now';
}, 1400);
updateProgress();
});

// Save draft
// Collect all form data into one object
function collectFormData() {
// Point persons from tags
const pointPersons = Array.from(
    document.querySelectorAll('#pointPersonWrap .tag')
).map(t => t.textContent.replace('✕', '').trim());

// Deliverables from rows
const deliverables = Array.from(
    document.querySelectorAll('#deliverableRows .deliverable-row')
).map(row => ({
    description: row.querySelector('input').value.trim(),
    category:    row.querySelector('select').value
})).filter(d => d.description);

// Selected project type card
const typeCard = document.querySelector('.radio-card.selected .radio-card-label');

// Selected priority pill
const priorityEl = document.querySelector('.priority-pill[class*="selected"]');
let priority = 'Medium';
if (priorityEl) {
    if (priorityEl.classList.contains('selected-high'))   priority = 'High';
    if (priorityEl.classList.contains('selected-medium')) priority = 'Medium';
    if (priorityEl.classList.contains('selected-low'))    priority = 'Low';
}

// Target each field directly by type and position — no fragile index guessing
const allInputs    = Array.from(document.querySelectorAll('.form-col input[type="text"], .form-col input:not([type])'));
const allSelects   = Array.from(document.querySelectorAll('.form-col select'));
const allDates     = Array.from(document.querySelectorAll('.form-col input[type="date"]'));
const allTextareas = Array.from(document.querySelectorAll('.form-col textarea'));

// text inputs: [0]=projName (use id), [1]=requestingHead, [2]=referenceLink
const requestingHead = allInputs.find(i =>
    i.placeholder && i.placeholder.toLowerCase().includes('full name')
)?.value.trim() || '';

const referenceLink = allInputs.find(i =>
    i.placeholder && i.placeholder.toLowerCase().includes('google drive')
)?.value.trim() || '';

// selects: [0]=committee
const committee = allSelects[0]?.value || '';

// dates in order: startDate, postingDate, eventDate
const startDate   = allDates[0]?.value || null;
const postingDate = allDates[1]?.value || null;
const eventDate   = allDates[2]?.value || null;

// textareas: [0]=description (use id), [1]=keyMessages, [2]=additionalNotes
const keyMessages      = allTextareas[1]?.value.trim() || '';
const additionalNotes  = allTextareas[allTextareas.length - 1]?.value.trim() || '';

return {
    projectName:    document.getElementById('projName').value.trim(),
    committee,
    projectType:    typeCard ? typeCard.textContent.trim() : '',
    description:    document.getElementById('projDesc').value.trim(),
    keyMessages,
    requestingHead,
    pointPersons,
    startDate:      startDate   || null,
    postingDate:    postingDate || null,
    eventDate:      eventDate   || null,
    priority,
    deliverables,
    additionalNotes,
    referenceLinks: referenceLink ? [referenceLink] : []
};
}

async function saveDraft() {
const data = collectFormData();
try {
    const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, status: 'Pending' })
    });
    const result = await res.json();
    if (result.success) {
    showToast('Draft saved — ' + result.refNumber);
    } else {
    showToast('Save failed: ' + result.message);
    }
} catch (err) {
    showToast('Could not reach server. Check that app.js is running.');
}
}

async function submitRequest() {
const pct = parseInt(document.getElementById('progressPct').textContent);
if (pct < 30) {
    showToast('Please fill in the required fields before submitting.');
    return;
}

const data = collectFormData();

try {
    const res = await fetch('/api/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
    });
    const result = await res.json();

    if (result.success) {
    document.getElementById('successRef').textContent = 'REF #' + result.refNumber;
    document.getElementById('successOverlay').classList.add('show');
    } else {
    showToast('Submission failed: ' + result.message);
    }
} catch (err) {
    showToast('Could not reach server. Check that app.js is running.');
}
}

function closeSuccess() {
document.getElementById('successOverlay').classList.remove('show');
}