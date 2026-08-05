/* ==========================================================
   diffRevision — builds the field-by-field "changes" list that
   backs the Revision & Update Log (ProjectRequest / RolloutForm).
========================================================== */

// Internal/meta fields that should never show up as a "change",
// even if they happen to appear in an update payload.
const IGNORED_FIELDS = new Set([
    '_id',
    '__v',
    'createdAt',
    'updatedAt',
    'revisions',
    'refNumber',
    'submittedBy',
    'revisionNote',
    'madeBy',
    'submit'
]);

/** Normalises a value to a comparable string so unrelated shapes (Date vs
 *  ISO string, populated ref vs raw id) don't register as false changes. */
function normalise(value) {
    if (value === undefined || value === null || value === '') return null;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return JSON.stringify(value);
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/**
 * Compares `updates` (the fields a request is trying to change) against
 * `before` (the document's current state) and returns only the fields
 * whose value actually changed.
 *
 * @param {Object} before  Plain object — current state (e.g. doc.toObject())
 * @param {Object} updates Plain object — proposed new values
 * @returns {Array<{field: string, from: *, to: *}>}
 */
function diffFields(before, updates) {
    const changes = [];

    Object.keys(updates || {}).forEach((field) => {
        if (IGNORED_FIELDS.has(field)) return;

        const oldVal = before ? before[field] : undefined;
        const newVal = updates[field];

        if (normalise(oldVal) === normalise(newVal)) return;

        changes.push({
            field,
            from: oldVal === undefined ? null : oldVal,
            to: newVal === undefined ? null : newVal
        });
    });

    return changes;
}

/** Renders a single value for the human-readable summary line. */
function formatValue(value) {
    if (value === null || value === undefined || value === '') return '—';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

/** Turns a changes[] array into one readable line, e.g.
 *  "status: Pending → Active; priority: Medium → High" */
function summariseChanges(changes) {
    if (!changes || !changes.length) return '';
    return changes
        .map((c) => `${c.field}: ${formatValue(c.from)} \u2192 ${formatValue(c.to)}`)
        .join('; ');
}

module.exports = { diffFields, summariseChanges, formatValue };
