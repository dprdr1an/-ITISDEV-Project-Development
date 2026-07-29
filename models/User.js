const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
{
    // Kept as the canonical display name so existing code and records keep
    // working. Derived from firstName/lastName whenever those are supplied.
    name: {
        type: String,
        required: true,
        trim: true
    },

    firstName: {
        type: String,
        trim: true,
        default: ''
    },

    lastName: {
        type: String,
        trim: true,
        default: ''
    },

    committee: {
        type: String,
        required: true
    },

    position: {
        type: String,
        required: true,
        enum: ['Chairperson', 'Executive']
    },

    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },

    password: {
        type: String,
        required: true
    },

    // Web path to the uploaded avatar, e.g. /uploads/avatars/<file>.png
    avatarUrl: {
        type: String,
        default: ''
    }
},
{
    timestamps: true
});

/**
 * Keep `name` and the first/last pair in sync in both directions so older
 * records (name only) and newer ones (first/last) behave identically.
 */
userSchema.pre('validate', function () {
    const first = (this.firstName || '').trim();
    const last = (this.lastName || '').trim();

    if (first || last) {
        this.name = [first, last].filter(Boolean).join(' ');
        return;
    }

    if (this.name) {
        const parts = this.name.trim().split(/\s+/);
        this.firstName = parts.shift() || '';
        this.lastName = parts.join(' ');
    }
});

/** Shape sent to the client. Never includes the password hash. */
userSchema.methods.toPublic = function () {
    return {
        id: this._id,
        name: this.name,
        firstName: this.firstName,
        lastName: this.lastName,
        committee: this.committee,
        position: this.position,
        email: this.email,
        avatarUrl: this.avatarUrl || ''
    };
};

module.exports = mongoose.model('User', userSchema);
