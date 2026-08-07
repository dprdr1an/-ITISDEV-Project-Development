const mongoose = require("mongoose");

const projectFileSchema = new mongoose.Schema(
{
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "ProjectRequest",
        required: true
    },

    originalName: {
        type: String,
        required: true
    },

    storedName: {
        type: String,
        required: true
    },

    filePath: {
        type: String,
        required: true
    },

    category: {
        type: String,
        enum: [
            "Pubmat",
            "Photo",
            "Caption",
            "Presentation",
            "Document",
            "Rollout Form",
            "Other"
        ],
        default: "Other"
    },

    folder: {
        type: String,
        default: "General"
    },

    mimeType: String,

    size: Number,

    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }

},
{
    timestamps: true
});

module.exports = mongoose.model("ProjectFile", projectFileSchema);
