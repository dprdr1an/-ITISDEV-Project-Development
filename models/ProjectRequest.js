const mongoose = require('mongoose');
const revisionSchema = require('./revisionSchema');

const deliverableSchema = new mongoose.Schema({
    description: { type: String, required: true },
    category:    { type: String }
});

const projectRequestSchema = new mongoose.Schema(
{
    projectName:    { type: String, required: true, trim: true },
    committee:      { type: String, required: true },
    projectType:    { type: String },
    targetPlatform: { type: String },
    priority:       { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },

    // Free-text name of the Executive responsible for the project. Kept as
    // the display value so records created before requestingHeadUser existed
    // still render unchanged.
    requestingHead: { type: String, required: true },

    // Structured counterpart: set when the requesting head is a known member.
    // Optional, so legacy records remain valid.
    requestingHeadUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },

    pointPersons:   [{ type: String }],

    startDate:      { type: Date },
    postingDate:    { type: Date },
    eventDate:      { type: Date },

    description:    { type: String, required: true },
    keyMessages:    { type: String },

    deliverables:   [deliverableSchema],

    referenceLinks: [{ type: String }],
    attachments:    [{ type: String }], // file paths/names

    additionalNotes: { type: String },

    status: {
        type: String,
        enum: ['Pending', 'Active', 'For Review', 'For Approval', 'Completed', 'On Hold'],
        default: 'Pending'
    },

    submittedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    refNumber: { type: String, unique: true },

    // Revision & Update Log — every create/edit/status-change is appended
    // here by the controller. Never exposed for deletion.
    revisions: [revisionSchema]
},
{
    timestamps: true
});

// Auto-generate reference number before saving
projectRequestSchema.pre('save', async function () {
    if (!this.refNumber) {
        const count = await mongoose.model('ProjectRequest').countDocuments();
        const year  = new Date().getFullYear();
        this.refNumber = `IMC-${year}-${String(count + 1).padStart(4, '0')}`;
    }
});

// Indexes backing Search & Filter (projectName search, committee/status
// filters, assignedMember lookup, deadline range) so query time stays
// well under the 3-second target as the collection grows.
projectRequestSchema.index({ projectName: 1 });
projectRequestSchema.index({ committee: 1 });
projectRequestSchema.index({ status: 1 });
projectRequestSchema.index({ eventDate: 1 });
projectRequestSchema.index({ pointPersons: 1 });
projectRequestSchema.index({ requestingHead: 1 });
projectRequestSchema.index({ requestingHeadUser: 1 });

module.exports = mongoose.model('ProjectRequest', projectRequestSchema);