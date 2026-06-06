// src/models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const UserSchema = new mongoose.Schema({
  // ── Basic Auth ──
  phone: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    match: [/^(\+880|880|0)[1-9]\d{8,9}$/, 'সঠিক বাংলাদেশী ফোন নম্বর দিন'],
  },
  email: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'সঠিক ইমেইল ঠিকানা দিন'],
  },
  password: {
    type: String,
    minlength: [8, 'পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে'],
    select: false,
  },

  // ── Roles & Status ──
  role: {
    type: String,
    enum: ['user', 'admin', 'moderator'],
    default: 'user',
  },
  isActive: { type: Boolean, default: true },
  isVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  isEmailVerified: { type: Boolean, default: false },
  isBanned: { type: Boolean, default: false },
  banReason: String,

  // ── OTP / Reset Tokens ──
  phoneOTP: String,
  phoneOTPExpire: Date,
  emailVerifyToken: String,
  emailVerifyExpire: Date,
  resetPasswordToken: String,
  resetPasswordExpire: Date,

  // ── Subscription ──
  plan: {
    type: String,
    enum: ['basic', 'standard', 'premium', 'gold'],
    default: 'basic',
  },
  planExpiry: Date,
  stripeCustomerId: String,

  // ── Tracking ──
  lastLogin: Date,
  loginCount: { type: Number, default: 0 },
  profileCompleteness: { type: Number, default: 0 },
  fcmToken: String, // Firebase push notifications

}, { timestamps: true });

// ── Virtual: has active subscription ──
UserSchema.virtual('isPremium').get(function () {
  return this.plan !== 'basic' && this.planExpiry && this.planExpiry > new Date();
});

// ── Pre-save: hash password ──
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// ── Methods ──
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id, role: this.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

UserSchema.methods.getRefreshToken = function () {
  return jwt.sign({ id: this._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE,
  });
};

UserSchema.methods.generateOTP = function () {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  this.phoneOTP = crypto.createHash('sha256').update(otp).digest('hex');
  this.phoneOTPExpire = Date.now() + 10 * 60 * 1000; // 10 minutes
  return otp;
};

UserSchema.methods.generateEmailToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.emailVerifyToken = crypto.createHash('sha256').update(token).digest('hex');
  this.emailVerifyExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  return token;
};

UserSchema.methods.generatePasswordResetToken = function () {
  const token = crypto.randomBytes(32).toString('hex');
  this.resetPasswordToken = crypto.createHash('sha256').update(token).digest('hex');
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour
  return token;
};

// ── Index ──
UserSchema.index({ createdAt: -1 });
UserSchema.index({ plan: 1, planExpiry: 1 });

module.exports = mongoose.model('User', UserSchema);
