const mongoose = require('mongoose');

const publicationSchema = new mongoose.Schema({
    title:       { type: String },
    materialType: { type: String },
    postingDate: { type: Date },
    postingTime: { type: String },
    captionNotes: { type: String },
    assignedTo:  { type: String },
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'For Review', 'Done'],
        default: 'Pending'
    }
});

const publicityPlanSchema = new mongoose.Schema({
    date:       { type: Date },
    activity:   { type: String },
    personResponsible: { type: String }
});

const revisionSchema = new mongoose.Schema({
    action:    { type: String },
    madeBy:    { type: String },
    note:      { type: String },
    timestamp: { type: Date, default: Date.now }
});

const rolloutFormSchema = new mongoose.Schema(
{
    // Section 1 — Project Details
    projectName:    { type: String, required: true, trim: true },
    committee:      { type: String, required: true },
    projectType:    { type: String },
    targetPlatform: { type: String },
    priority:       { type: String, enum: ['High', 'Medium', 'Low'] },

    requestingHead: { type: String },
    pointPersons:   [{ type: String }],

    startDate:      { type: Date },
    endDate:        { type: Date },
    daamDeadline:   { type: Date },
    eventDate:      { type: Date },

    description:    { type: String },
    keyMessages:    { type: String },

    // Section 2 — Publication Plan
    publications:   [publicationSchema],
    creativesNotes: { type: String },

    // Section 3 — Publicity Plan
    publicityPlan:  [publicityPlanSchema],
    coordinationNotes: { type: String },

    // Meta
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'For Review', 'Approved', 'Rejected'],
        default: 'Draft'
    },

    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Checklist — store which items are checked
    checklist: [{ type: String }],

    // Revision log
    revisions: [revisionSchema]
},
{
    timestamps: true
});

module.exports = mongoose.model('RolloutForm', rolloutFormSchema);
