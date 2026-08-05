const mongoose = require('mongoose');

/**
 * A single field-level change captured inside a revision entry.
 * `from`/`to` are Mixed because tracked fields span strings, dates,
 * arrays, and sub-documents.
 */
const changeSchema = new mongoose.Schema(
    {
        field: { type: String, required: true },
        from:  { type: mongoose.Schema.Types.Mixed, default: null },
        to:    { type: mongoose.Schema.Types.Mixed, default: null }
    },
    { _id: false }
);

/**
 * One entry in a document's revision/update log.
 *
 * `madeBy` is a display-name snapshot (so the log still reads correctly
 * even if the user later renames themselves); `userId` is the durable
 * reference for anything that needs to look the user up.
 *
 * Entries are only ever pushed by server-side controllers using the
 * signed-in session (`req.currentUser`) — never taken from client input —
 * so the "user" on a log line can be trusted. There is intentionally no
 * update/delete route for individual revision entries: once written, a
 * revision is permanent for the life of the parent document.
 */
const revisionSchema = new mongoose.Schema(
    {
        action:  { type: String, required: true },
        madeBy:  { type: String, required: true },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        changes: [changeSchema],
        note:    { type: String, default: '' },
        timestamp: { type: Date, default: Date.now }
    },
    { _id: true }
);

module.exports = revisionSchema;
