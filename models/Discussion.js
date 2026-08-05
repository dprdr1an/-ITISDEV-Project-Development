const mongoose = require("mongoose");

/**
 * One posted message in a project's discussion thread.
 *
 * Migrated from the Project Discussion and Updates branch. The shape is
 * unchanged (project / author / update / comments) so existing records stay
 * readable; the current UI renders each document as a single message and
 * `comments` remains available for threaded replies later.
 */
const commentSchema = new mongoose.Schema(
    {
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        }
    },
    {
        timestamps: true
    }
);

const discussionSchema = new mongoose.Schema(
    {
        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "ProjectRequest",
            required: true
        },

        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        update: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000
        },

        comments: [commentSchema]
    },
    {
        timestamps: true
    }
);

// Thread reads are always "this project, in order"
discussionSchema.index({ project: 1, createdAt: 1 });

module.exports = mongoose.model("Discussion", discussionSchema);
