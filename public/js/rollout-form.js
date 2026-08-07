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

// Point Person(s) — the same member picker used on the Project Request
// form, backed by the Users collection. The people chosen here receive
// the notification when this rollout is submitted.
// Requesting Head — the shared selector from common.js, identical to the
// one on Project Requests. Defaults to the signed-in user with an opt-in
// to file on behalf of another Executive.
window.RequestingHead = window.IMC.createRequestingHead({
    onChange: updateChecklistProgress,
    pickerHint: 'You will still be recorded as the submitter of this rollout.',
    pickError: 'Please select the Executive this rollout is for.'
});

// Project selector — the rollout must point at a real Project Request,
// otherwise the generated PDF has no project to be filed under.
(async function loadProjectOptions() {
    const select = document.getElementById('rolloutProject');
    if (!select) return;

    try {
        const response = await window.IMC.api.get('/api/projects');
        const projects = response.data || [];

        if (!projects.length) {
            select.innerHTML =
                '<option value="">No project requests available</option>';
            return;
        }

        select.innerHTML =
            '<option value="">Select a project…</option>' +
            projects.map(function (p) {
                return '<option value="' + window.IMC.escapeHtml(p.projectName) +
                    '" data-project-id="' + window.IMC.escapeHtml(p._id) + '">' +
                    window.IMC.escapeHtml(p.projectName) + '</option>';
            }).join('');
    } catch (err) {
        console.error('Could not load projects:', err);
        select.innerHTML = '<option value="">Unable to load projects</option>';
    }
})();

window.PointPersons = window.IMC.createMemberPicker({
    wrapId: 'pointPersonWrap',
    inputId: 'pointPersonInput',
    placeholder: 'Add a point person…',
    label: 'Add a point person',
    onChange: updateChecklistProgress
});

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

// Save draft
// Collect all rollout form data
function collectRolloutData() {
// Point persons — names for display, ids so the server can notify them
const points = window.PointPersons
    ? window.PointPersons.getValue()
    : { names: [], ids: [] };

const pointPersons = points.names;

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

// Main fields — positional, so the requesting-head controls are excluded
// deliberately: they are read from the shared component below, and leaving
// them in the list would shift every index after them.
const allInputs = Array.from(document.querySelectorAll('.form-control'))
    .filter(function (el) {
        return el.id !== 'requestingHeadDisplay' && el.id !== 'requestingHeadSelect';
    });

const head = window.RequestingHead
    ? window.RequestingHead.getValue()
    : { requestingHead: '', requestingHeadUser: null };

// Explicit project reference, so the server never has to guess from a name
const projectSelect = document.getElementById('rolloutProject');
const projectId = projectSelect
    ? (projectSelect.selectedOptions[0] || {}).getAttribute
        ? projectSelect.selectedOptions[0].getAttribute('data-project-id')
        : null
    : null;

return {
    project:        projectId || null,
    projectName:    allInputs[0]?.value || '',
    committee:      allInputs[1]?.value || '',
    projectType:    allInputs[2]?.value || '',
    targetPlatform: allInputs[3]?.value || '',
    priority:       allInputs[4]?.value || '',
    requestingHead: head.requestingHead,
    requestingHeadUser: head.requestingHeadUser,
    pointPersons,
    pointPersonUsers: points.ids,
    startDate:      allInputs[5]?.value || null,
    endDate:        allInputs[6]?.value || null,
    daamDeadline:   allInputs[7]?.value || null,
    eventDate:      allInputs[8]?.value || null,
    description:    allInputs[9]?.value || '',
    keyMessages:    allInputs[10]?.value || '',
    publications,
    publicityPlan,
    checklist,
    // Link the rollout to the signed-in user
    submittedBy: window.currentUser ? window.currentUser.id : null
};
}

async function saveDraft() {
const headError = window.RequestingHead && window.RequestingHead.validate();
if (headError) {
    showToast(headError);
    return;
}

const data = collectRolloutData();
try {
    const res = await fetch('/api/rollouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, submit: false })
    });
    const result = await res.json();
    if (result.success) {
    addRevisionEntry(result.revision);
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
const headError = window.RequestingHead && window.RequestingHead.validate();
if (headError) {
    showToast(headError);
    return;
}

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
    addRevisionEntry(result.revision);

    // Report what actually happened rather than assuming success:
    // a skipped PDF or an unsent notification used to be invisible.
    if (result.warnings && result.warnings.length) {
        showToast('Rollout submitted, but: ' + result.warnings.join(' '));
    } else if (result.pdf) {
        showToast(
            'Rollout submitted. "' + result.pdf.name +
            '" was added to the ' + result.pdf.folder + ' folder.'
        );
    } else {
        showToast('Rollout submitted successfully.');
    }
    } else {
    showToast('Submission failed: ' + result.message);
    }
} catch (err) {
    showToast('Could not reach server. Check that app.js is running.');
}
}

// Escape untrusted text before it goes into innerHTML
function escapeHtml(str) {
return String(str == null ? '' : str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
}

// Append a revision entry using the record the server actually persisted
// (real signed-in user, real timestamp, real note) — never client-guessed data.
function addRevisionEntry(revision) {
if (!revision) return;

const log = document.getElementById('revisionLog');

// First real entry replaces the "no revisions yet" placeholder
const placeholder = log.querySelector('.notice');
if (placeholder) placeholder.remove();

const when = new Date(revision.timestamp || Date.now());
const time = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const div = document.createElement('div');
div.className = 'revision-item';
div.style.opacity = '0';
div.innerHTML = `
    <div class="revision-dot-wrap">
    <div class="revision-dot" style="background:var(--orange);"></div>
    <div class="revision-line"></div>
    </div>
    <div class="revision-body">
    <div class="revision-action">${escapeHtml(revision.action)}</div>
    <div class="revision-meta">${escapeHtml(revision.madeBy)} · ${time}</div>
    ${revision.note ? `<div class="revision-note">${escapeHtml(revision.note)}</div>` : ''}
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