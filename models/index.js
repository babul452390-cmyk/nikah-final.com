// src/models/ConnectionRequest.js
const mongoose = require('mongoose');

const ConnectionRequestSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  receiver: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  senderBiodata: {
    type: mongoose.Schema.ObjectId,
    ref: 'Biodata',
    required: true,
  },
  receiverBiodata: {
    type: mongoose.Schema.ObjectId,
    ref: 'Biodata',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
  },
  message: {
    type: String,
    maxlength: 500,
  },
  respondedAt: Date,
  isContactShared: { type: Boolean, default: false },
}, { timestamps: true });

// Prevent duplicate requests
ConnectionRequestSchema.index({ sender: 1, receiver: 1 }, { unique: true });
ConnectionRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ConnectionRequest', ConnectionRequestSchema);


// ─────────────────────────────────────────
// src/models/Shortlist.js
// ─────────────────────────────────────────
const ShortlistSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  biodata: {
    type: mongoose.Schema.ObjectId,
    ref: 'Biodata',
    required: true,
  },
  note: { type: String, maxlength: 200 },
}, { timestamps: true });

ShortlistSchema.index({ user: 1, biodata: 1 }, { unique: true });

const Shortlist = mongoose.model('Shortlist', ShortlistSchema);


// ─────────────────────────────────────────
// src/models/Notification.js
// ─────────────────────────────────────────
const NotificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  type: {
    type: String,
    enum: [
      'connection_request',
      'request_accepted',
      'request_rejected',
      'new_shortlist',
      'profile_verified',
      'profile_rejected',
      'subscription_activated',
      'subscription_expiring',
      'new_match',
      'system',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  data: mongoose.Schema.Types.Mixed,
  isRead: { type: Boolean, default: false },
  readAt: Date,
}, { timestamps: true });

NotificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', NotificationSchema);


// ─────────────────────────────────────────
// src/models/Review.js
// ─────────────────────────────────────────
const ReviewSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
    required: true,
  },
  comment: {
    type: String,
    maxlength: 1000,
    required: true,
  },
  coupleDetails: String,
  location: String,
  isApproved: { type: Boolean, default: false },
  isFeatured: { type: Boolean, default: false },
}, { timestamps: true });

const Review = mongoose.model('Review', ReviewSchema);


// ─────────────────────────────────────────
// src/models/Subscription.js
// ─────────────────────────────────────────
const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  plan: {
    type: String,
    enum: ['standard', 'premium', 'gold'],
    required: true,
  },
  price: { type: Number, required: true },
  currency: { type: String, default: 'BDT' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'refunded'],
    default: 'active',
  },
  paymentMethod: {
    type: String,
    enum: ['stripe', 'bkash', 'nagad', 'rocket', 'bank_transfer'],
  },
  transactionId: String,
  stripePaymentIntentId: String,
  features: {
    contactView: { type: Number, default: 0 },
    profileBoost: { type: Boolean, default: false },
    advancedSearch: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
  },
}, { timestamps: true });

SubscriptionSchema.index({ user: 1, status: 1 });

const Subscription = mongoose.model('Subscription', SubscriptionSchema);


// ─────────────────────────────────────────
// src/models/Report.js
// ─────────────────────────────────────────
const ReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  reported: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true,
  },
  reportedBiodata: {
    type: mongoose.Schema.ObjectId,
    ref: 'Biodata',
  },
  reason: {
    type: String,
    enum: ['fake_profile', 'inappropriate_content', 'harassment', 'spam', 'fraud', 'other'],
    required: true,
  },
  description: { type: String, maxlength: 500 },
  status: {
    type: String,
    enum: ['pending', 'reviewed', 'resolved', 'dismissed'],
    default: 'pending',
  },
  resolvedBy: { type: mongoose.Schema.ObjectId, ref: 'User' },
  resolvedAt: Date,
}, { timestamps: true });

const Report = mongoose.model('Report', ReportSchema);


module.exports = {
  ConnectionRequest: mongoose.model('ConnectionRequest') || module.exports.ConnectionRequest,
  Shortlist,
  Notification,
  Review,
  Subscription,
  Report,
};

// Re-export ConnectionRequest properly
module.exports.ConnectionRequest = mongoose.models.ConnectionRequest || mongoose.model('ConnectionRequest', ConnectionRequestSchema);
