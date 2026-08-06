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

// Requesting head comes from its own module: either the signed-in user
// (default) or the Executive chosen via "on behalf of".
const head = window.RequestingHead
    ? window.RequestingHead.getValue()
    : { requestingHead: '', requestingHeadUser: null };

const requestingHead = head.requestingHead;

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
    // Structured reference for the audit trail; the server verifies it
    requestingHeadUser: head.requestingHeadUser,
    pointPersons,
    startDate:      startDate   || null,
    postingDate:    postingDate || null,
    eventDate:      eventDate   || null,
    priority,
    deliverables,
    additionalNotes,
    referenceLinks: referenceLink ? [referenceLink] : [],
    // Link the request to the signed-in user
    submittedBy: window.currentUser ? window.currentUser.id : null
};
}

async function saveDraft() {
const headError = window.RequestingHead && window.RequestingHead.validate();
if (headError) {
    showToast(headError);
    return;
}

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

const headError = window.RequestingHead && window.RequestingHead.validate();
if (headError) {
    showToast(headError);
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
/* ==========================================================
   Chairpersons notified on submission — loaded from the API
   instead of the previously hardcoded list.
========================================================== */

(async function loadChairpersons() {
    const list = document.getElementById('chairpersonList');

    if (!list || !window.IMC) return;

    const { api, escapeHtml, generateInitials } = window.IMC;

    // Reuses the avatar gradients already present in the stylesheet
    const GRADIENTS = [
        'linear-gradient(135deg,#F97316,#c2410c)',
        'linear-gradient(135deg,#6366F1,#4338CA)',
        'linear-gradient(135deg,#10B981,#059669)',
        'linear-gradient(135deg,#F59E0B,#D97706)',
        'linear-gradient(135deg,#8B5CF6,#6D28D9)'
    ];

    try {
        const response = await api.get('/api/users?position=Chairperson');
        const chairs = response.users || [];

        if (!chairs.length) {
            list.innerHTML =
                '<p class="chair-role">No chairpersons registered yet.</p>';
            return;
        }

        list.innerHTML = chairs
            .map(function (chair, index) {
                return (
                    '<div class="chairperson-item">' +
                    '<div class="chair-avatar" style="background:' +
                    GRADIENTS[index % GRADIENTS.length] +
                    ';">' +
                    escapeHtml(generateInitials(chair.name)) +
                    '</div>' +
                    '<div>' +
                    '<div class="chair-name">' +
                    escapeHtml(chair.name) +
                    '</div>' +
                    '<div class="chair-role">Chairperson, ' +
                    escapeHtml(chair.committee || '—') +
                    '</div>' +
                    '</div></div>'
                );
            })
            .join('');
    } catch (err) {
        console.error(err);
        list.innerHTML =
            '<p class="chair-role">Unable to load chairpersons.</p>';
    }
})();

/* ==========================================================
   Submitted Requests — browse, search & filter
   Reuses GET /api/projects (search matches projectName or the
   description/objective field) and the shared filter controller
   in common.js. No new endpoint, no duplicated search logic.
========================================================== */

(function browseRequests() {
    const list = document.getElementById('requestList');

    if (!list || !window.IMC) return;

    const {
        api,
        escapeHtml,
        badgeClass,
        formatLongDate,
        buildQueryString,
        createFilterController,
        populateSelect,
        populateCommitteeSelect,
        emptyResultMessage,
        renderNotice,
        showToast
    } = window.IMC;

    // Matches the ProjectRequest schema's status enum
    const STATUS_OPTIONS = [
        'Pending',
        'Active',
        'For Review',
        'For Approval',
        'Completed',
        'On Hold'
    ];

    // Declared before load() reads it
    let filters = null;

    function renderRows(projects) {
        if (!projects.length) {
            renderNotice(
                list,
                emptyResultMessage(
                    filters && filters.isFiltering(),
                    'No project requests have been submitted yet.'
                )
            );
            return;
        }

        list.innerHTML = projects
            .map(function (project) {
                const submitted =
                    project.submittedBy && project.submittedBy.name
                        ? ' · ' + escapeHtml(project.submittedBy.name)
                        : '';

                return (
                    '<div class="request-row">' +
                    '<div class="request-main">' +
                    '<div class="request-name">' +
                    escapeHtml(project.projectName) +
                    '</div>' +
                    '<div class="request-objective">' +
                    escapeHtml(project.description || '') +
                    '</div>' +
                    '<div class="request-meta">' +
                    '<span>' + escapeHtml(project.committee || '—') + '</span>' +
                    (project.refNumber
                        ? '<span>' + escapeHtml(project.refNumber) + '</span>'
                        : '') +
                    '<span>' +
                    escapeHtml(formatLongDate(project.createdAt)) +
                    submitted +
                    '</span>' +
                    '</div></div>' +
                    '<div class="request-side">' +
                    '<span class="badge ' + badgeClass(project.status) + '">' +
                    escapeHtml(project.status) +
                    '</span>' +
                    '<a class="row-link" href="discussions.html?project=' +
                    escapeHtml(project._id) + '">Discuss</a>' +
                    '</div></div>'
                );
            })
            .join('');
    }

    function setCount(shown) {
        const note = document.getElementById('requestCount');

        if (note) {
            note.textContent =
                shown === 1 ? '1 request' : shown + ' requests';
        }
    }

    async function refresh(params) {
        try {
            const response = await api.get(
                '/api/projects' +
                    buildQueryString(params || (filters ? filters.params() : {}))
            );

            const projects = response.data || [];

            renderRows(projects);
            setCount(projects.length);

            return projects;
        } catch (err) {
            console.error(err);
            renderNotice(list, 'Unable to load submitted requests.');
            showToast(err.message);
            return [];
        }
    }

    filters = createFilterController({
        controls: {
            search:    { id: 'requestSearch', debounce: true },
            status:    { id: 'requestStatus' },
            committee: { id: 'requestCommittee' }
        },
        clearButtonId: 'clearRequestFilters',
        onChange: refresh
    });

    (async function init() {
        populateSelect('requestStatus', STATUS_OPTIONS, 'All Statuses');

        // Official structure, shared with every other committee dropdown
        populateCommitteeSelect('requestCommittee', {
            placeholder: 'All Committees'
        });

        await refresh({});
    })();
})();

/* ==========================================================
   Requesting Head — defaults to the signed-in user, with an
   opt-in to file on behalf of another Executive.

   submittedBy   → always the authenticated user (set server-side)
   requestingHead → the Executive responsible for the project

   Exposed as window.RequestingHead so collectFormData() reads one
   source of truth, and so an edit flow can restore stored state.
========================================================== */

window.RequestingHead = (function () {
    'use strict';

    const display  = document.getElementById('requestingHeadDisplay');
    const select   = document.getElementById('requestingHeadSelect');
    const hidden   = document.getElementById('requestingHeadUser');
    const toggle   = document.getElementById('onBehalfToggle');
    const hint     = document.getElementById('requestingHeadHint');

    // Page has the old markup (or the field is absent) — stay inert
    if (!display || !select || !hidden || !toggle) {
        return {
            getValue: function () {
                return {
                    requestingHead: display ? display.value.trim() : '',
                    requestingHeadUser: null
                };
            },
            setFromProject: function () {},
            isOnBehalf: function () { return false; }
        };
    }

    const IMC  = window.IMC || {};
    const user = window.currentUser || null;

    // Executives loaded from the Members API, cached for the toggle
    let executives = [];
    let loaded = false;

    /** "Adrian Yap — Executive · Logistics" */
    function describe(person) {
        if (!person) return '';

        const role = [person.position, person.committee]
            .filter(Boolean)
            .join(' · ');

        return role ? person.name + ' — ' + role : person.name;
    }

    function showSelf() {
        display.hidden = false;
        select.hidden = true;

        display.value = user ? describe(user) : '';
        hidden.value = user ? user.id : '';

        if (hint) {
            hint.textContent =
                'Defaults to you. Your account is still recorded as the submitter.';
        }
    }

    function showPicker() {
        display.hidden = true;
        select.hidden = false;

        // .trackable counts this field by value; clear it so an unfinished
        // selection doesn't inflate the progress bar.
        display.value = '';

        if (hint) {
            hint.textContent =
                'You will still be recorded as the submitter of this request.';
        }
    }

    /**
     * Loads selectable Executives from the existing Members API.
     * Reuses IMC.api so the session cookie and error handling are shared.
     */
    async function loadExecutives() {
        if (loaded) return executives;

        try {
            const response = await IMC.api.get('/api/users?position=Executive');

            executives = response.users || [];
            loaded = true;

            const current = hidden.value;

            select.innerHTML =
                '<option value="">Select an Executive…</option>' +
                executives
                    .map(function (person) {
                        return '<option value="' + IMC.escapeHtml(person._id) + '">' +
                            IMC.escapeHtml(describe(person)) + '</option>';
                    })
                    .join('');

            // Keep a pre-selected head (edit mode) if still listed
            if (current && executives.some(function (p) {
                return String(p._id) === String(current);
            })) {
                select.value = current;
            }
        } catch (err) {
            console.error('Could not load Executives:', err);

            select.innerHTML =
                '<option value="">Unable to load members</option>';

            if (IMC.showToast) IMC.showToast(err.message);
        }

        return executives;
    }

    toggle.addEventListener('change', async function () {
        if (toggle.checked) {
            showPicker();
            await loadExecutives();

            // Nothing chosen yet — clear so validation catches an empty pick
            if (!select.value) hidden.value = '';
        } else {
            // Reverting restores the signed-in user
            select.value = '';
            showSelf();
        }

        if (typeof window.updateProgress === 'function') window.updateProgress();
    });

    select.addEventListener('change', function () {
        hidden.value = select.value || '';

        // Mirror the choice into the tracked field so progress reflects it
        const chosen = executives.find(function (p) {
            return String(p._id) === String(select.value);
        });

        display.value = chosen ? describe(chosen) : '';

        if (typeof window.updateProgress === 'function') window.updateProgress();
    });

    // Show the signed-in user immediately
    showSelf();

    return {
        /** Current head, in the shape collectFormData() submits. */
        getValue: function () {
            if (toggle.checked) {
                const chosen = executives.find(function (p) {
                    return String(p._id) === String(select.value);
                });

                return {
                    requestingHead: chosen ? chosen.name : '',
                    requestingHeadUser: select.value || null
                };
            }

            return {
                requestingHead: user ? user.name : display.value.trim(),
                requestingHeadUser: user ? user.id : null
            };
        },

        isOnBehalf: function () {
            return toggle.checked;
        },

        /** null when valid, otherwise a message to show the user. */
        validate: function () {
            if (toggle.checked && !select.value) {
                return 'Please select the Executive this request is for.';
            }

            if (!toggle.checked && !user) {
                return 'Could not identify the requesting head. Please sign in again.';
            }

            return null;
        },

        /**
         * Restores state from a stored record, for an edit flow.
         * Ticks the box and preselects the member only when the request
         * was filed for somebody other than its submitter.
         */
        setFromProject: async function (project) {
            if (!project) return;

            const headId =
                project.requestingHeadUser && project.requestingHeadUser._id
                    ? project.requestingHeadUser._id
                    : project.requestingHeadUser;

            const submitterId =
                project.submittedBy && project.submittedBy._id
                    ? project.submittedBy._id
                    : project.submittedBy;

            const differs =
                headId && submitterId &&
                String(headId) !== String(submitterId);

            if (!differs) {
                toggle.checked = false;
                showSelf();

                // Legacy record with only a typed name and no reference
                if (!headId && project.requestingHead) {
                    display.value = project.requestingHead;
                    hidden.value = '';
                }

                return;
            }

            toggle.checked = true;
            showPicker();

            hidden.value = String(headId);

            await loadExecutives();

            select.value = String(headId);

            // Stored head is no longer an Executive (role changed or removed):
            // keep them selectable so an edit doesn't silently reassign.
            if (select.value !== String(headId)) {
                const label = project.requestingHeadUser &&
                    project.requestingHeadUser.name
                        ? describe(project.requestingHeadUser)
                        : project.requestingHead;

                select.insertAdjacentHTML(
                    'beforeend',
                    '<option value="' + IMC.escapeHtml(String(headId)) + '">' +
                    IMC.escapeHtml(label || 'Current requesting head') +
                    '</option>'
                );

                select.value = String(headId);
            }
        }
    };
})();
