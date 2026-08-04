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

module.exports = { escapeRegex, containsRegex };
