const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // Needed for password hashing

const UserSchema = new mongoose.Schema({
    // --- Authentication Fields ---
    email: {
        type: String,
        required: [true, 'Please add an email address'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [
            /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
            'Please enter a valid email address'
        ]
    },
    password: {
        type: String,
        required: [true, 'Please enter a password'],
        minlength: [6, 'Password must be at least 6 characters'],
        select: false // SECURITY: Password hash should NOT be returned by default queries
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'editor'], // Account types you defined
        default: 'user'
    },
    
    // --- Profile Information ---
    name: {
        type: String,
        required: [true, 'Please add a name'],
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    
    // --- Security & Utility Fields (For forgot password functionality) ---
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    // --- Timestamps ---
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// [Mongoose Middleware] Encrypt password using bcrypt before saving the user
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// [Mongoose Method] Add a method to compare password hashes during login
UserSchema.methods.matchPassword = async function (enteredPassword) {
    // Select the password explicitly since 'select: false' is used in the schema
    const user = await this.model('User').findOne({ _id: this._id }).select('+password'); 
    if (!user) return false;
    return await bcrypt.compare(enteredPassword, user.password);
};

module.exports = mongoose.model('User', UserSchema);