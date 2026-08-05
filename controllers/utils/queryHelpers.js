/* ==========================================================
   queryHelpers — small utilities shared by list/search endpoints.
========================================================== */

/** Escapes regex metacharacters so user input can't break out of a
 *  $regex filter (e.g. searching for "a.b" shouldn't match "axb"). */
function escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Case-insensitive "contains" match, safe against regex injection. */
function containsRegex(str) {
    return new RegExp(escapeRegex(str), 'i');
}

/**
 * Builds a case-insensitive "contains" clause across several fields.
 * Returns null when the term is blank so callers can skip it entirely.
 *
 *   matchAnyField('poster', ['title', 'description'])
 *   → { $or: [{ title: /poster/i }, { description: /poster/i }] }
 */
function matchAnyField(term, fields) {
    const trimmed = String(term || '').trim();

    if (!trimmed || !fields || !fields.length) return null;

    const re = containsRegex(trimmed);

    return { $or: fields.map((field) => ({ [field]: re })) };
}

/**
 * Merges one or more clauses into a filter without letting a second
 * `$or` silently overwrite the first. Any clause containing `$or` is
 * pushed onto `$and`, so multiple multi-field searches stay AND'd
 * together the way a user expects when combining search with filters.
 */
function addClause(filter, clause) {
    if (!clause) return filter;

    if (clause.$or) {
        filter.$and = filter.$and || [];
        filter.$and.push(clause);
        return filter;
    }

    return Object.assign(filter, clause);
}

/**
 * Inclusive date-range clause for a field, from ISO date strings.
 * Returns null when neither bound is supplied.
 *
 * `to` is pushed to the end of that day so a single-day range
 * (from === to) still matches timestamps recorded during the day.
 */
function dateRange(field, from, to) {
    if (!from && !to) return null;

    const range = {};

    if (from) {
        const start = new Date(from);
        if (!Number.isNaN(start.getTime())) range.$gte = start;
    }

    if (to) {
        const end = new Date(to);

        if (!Number.isNaN(end.getTime())) {
            end.setHours(23, 59, 59, 999);
            range.$lte = end;
        }
    }

    return Object.keys(range).length ? { [field]: range } : null;
}

module.exports = {
    escapeRegex,
    containsRegex,
    matchAnyField,
    addClause,
    dateRange
};
