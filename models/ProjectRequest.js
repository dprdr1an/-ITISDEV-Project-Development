const mongoose = require('mongoose');

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

    requestingHead: { type: String, required: true },
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

    refNumber: { type: String, unique: true }
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

module.exports = mongoose.model('ProjectRequest', projectRequestSchema);