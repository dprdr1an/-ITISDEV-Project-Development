const mongoose = require("mongoose");

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
        trim: true
    }
},
{
    timestamps: true
});

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
        trim: true
    },

    comments: [commentSchema]
},
{
    timestamps: true
});

module.exports = mongoose.model("Discussion", discussionSchema);