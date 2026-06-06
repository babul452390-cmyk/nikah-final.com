// src/controllers/connectionController.js
const mongoose = require('mongoose');
const Biodata = require('../models/Biodata');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Notification, ConnectionRequest } = require('../models/index');

// ── @route   POST /api/v1/connections/request ──
exports.sendRequest = asyncHandler(async (req, res, next) => {
  const { receiverBiodataId, message } = req.body;

  const receiverBiodata = await Biodata.findById(receiverBiodataId);
  if (!receiverBiodata || receiverBiodata.status !== 'approved') {
    return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));
  }

  const senderBiodata = await Biodata.findOne({ user: req.user.id });
  if (!senderBiodata) {
    return next(new AppError('রিকোয়েস্ট পাঠাতে আগে আপনার বায়োডাটা তৈরি করুন', 400));
  }

  if (receiverBiodata.user.toString() === req.user.id.toString()) {
    return next(new AppError('নিজের বায়োডাটায় রিকোয়েস্ট পাঠানো যাবে না', 400));
  }

  // Check same gender
  if (senderBiodata.gender === receiverBiodata.gender) {
    return next(new AppError('একই লিঙ্গের বায়োডাটায় রিকোয়েস্ট পাঠানো যাবে না', 400));
  }

  const existingRequest = await ConnectionRequest.findOne({
    $or: [
      { sender: req.user.id, receiver: receiverBiodata.user },
      { sender: receiverBiodata.user, receiver: req.user.id },
    ],
  });

  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      return next(new AppError('ইতিমধ্যে একটি রিকোয়েস্ট পেন্ডিং আছে', 400));
    }
    if (existingRequest.status === 'accepted') {
      return next(new AppError('এই সংযোগ ইতিমধ্যে গৃহীত হয়েছে', 400));
    }
  }

  const connectionReq = await ConnectionRequest.create({
    sender: req.user.id,
    receiver: receiverBiodata.user,
    senderBiodata: senderBiodata._id,
    receiverBiodata: receiverBiodata._id,
    message,
  });

  // Update stats
  await Biodata.findByIdAndUpdate(senderBiodata._id, { $inc: { requestsSent: 1 } });
  await Biodata.findByIdAndUpdate(receiverBiodata._id, { $inc: { requestsReceived: 1 } });

  // Notify receiver
  await Notification.create({
    recipient: receiverBiodata.user,
    type: 'connection_request',
    title: 'নতুন সংযোগ অনুরোধ',
    message: `${senderBiodata.biodataId} থেকে একটি সংযোগ অনুরোধ এসেছে`,
    data: { connectionId: connectionReq._id, senderBiodataId: senderBiodata._id },
  });

  res.status(201).json({
    success: true,
    message: 'সংযোগ অনুরোধ পাঠানো হয়েছে',
    data: connectionReq,
  });
});

// ── @route   PUT /api/v1/connections/:id/respond ──
exports.respondToRequest = asyncHandler(async (req, res, next) => {
  const { action } = req.body; // 'accept' or 'reject'
  const request = await ConnectionRequest.findById(req.params.id);

  if (!request) return next(new AppError('রিকোয়েস্ট পাওয়া যায়নি', 404));
  if (request.receiver.toString() !== req.user.id.toString()) {
    return next(new AppError('এই রিকোয়েস্টে সাড়া দেওয়ার অনুমতি নেই', 403));
  }
  if (request.status !== 'pending') {
    return next(new AppError('এই রিকোয়েস্টে আগেই সাড়া দেওয়া হয়েছে', 400));
  }

  request.status = action === 'accept' ? 'accepted' : 'rejected';
  request.respondedAt = new Date();
  if (action === 'accept') request.isContactShared = true;
  await request.save();

  const notifType = action === 'accept' ? 'request_accepted' : 'request_rejected';
  const notifMsg = action === 'accept'
    ? 'আপনার সংযোগ অনুরোধ গৃহীত হয়েছে'
    : 'আপনার সংযোগ অনুরোধ প্রত্যাখ্যাত হয়েছে';

  await Notification.create({
    recipient: request.sender,
    type: notifType,
    title: action === 'accept' ? 'অনুরোধ গৃহীত ✅' : 'অনুরোধ প্রত্যাখ্যাত',
    message: notifMsg,
    data: { connectionId: request._id },
  });

  res.status(200).json({
    success: true,
    message: action === 'accept' ? 'সংযোগ গৃহীত হয়েছে' : 'সংযোগ প্রত্যাখ্যাত হয়েছে',
    data: request,
  });
});

// ── @route   GET /api/v1/connections/sent ──
exports.getSentRequests = asyncHandler(async (req, res) => {
  const requests = await ConnectionRequest.find({ sender: req.user.id })
    .populate('receiverBiodata', 'biodataId gender permanentDistrict education occupation avatar dateOfBirth')
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: requests.length, data: requests });
});

// ── @route   GET /api/v1/connections/received ──
exports.getReceivedRequests = asyncHandler(async (req, res) => {
  const requests = await ConnectionRequest.find({ receiver: req.user.id })
    .populate('senderBiodata', 'biodataId gender permanentDistrict education occupation avatar dateOfBirth')
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: requests.length, data: requests });
});

// ── @route   GET /api/v1/connections/accepted ──
exports.getAcceptedConnections = asyncHandler(async (req, res) => {
  const connections = await ConnectionRequest.find({
    $or: [{ sender: req.user.id }, { receiver: req.user.id }],
    status: 'accepted',
  })
    .populate('senderBiodata receiverBiodata', 'biodataId gender permanentDistrict education occupation avatar guardianPhone dateOfBirth')
    .sort({ respondedAt: -1 });
  res.status(200).json({ success: true, count: connections.length, data: connections });
});

// ── @route   DELETE /api/v1/connections/:id ──
exports.cancelRequest = asyncHandler(async (req, res, next) => {
  const request = await ConnectionRequest.findById(req.params.id);
  if (!request) return next(new AppError('রিকোয়েস্ট পাওয়া যায়নি', 404));
  if (request.sender.toString() !== req.user.id.toString()) {
    return next(new AppError('এই রিকোয়েস্ট বাতিল করার অনুমতি নেই', 403));
  }
  if (request.status !== 'pending') {
    return next(new AppError('শুধুমাত্র পেন্ডিং রিকোয়েস্ট বাতিল করা যাবে', 400));
  }
  await request.deleteOne();
  res.status(200).json({ success: true, message: 'রিকোয়েস্ট বাতিল করা হয়েছে' });
});


// ════════════════════════════════════════
// SHORTLIST CONTROLLER
// ════════════════════════════════════════
const { Shortlist } = require('../models/index');

exports.toggleShortlist = asyncHandler(async (req, res, next) => {
  const { biodataId } = req.params;
  const biodata = await Biodata.findById(biodataId);
  if (!biodata || biodata.status !== 'approved') {
    return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));
  }

  const existing = await Shortlist.findOne({ user: req.user.id, biodata: biodataId });
  if (existing) {
    await existing.deleteOne();
    await Biodata.findByIdAndUpdate(biodataId, { $inc: { shortlists: -1 } });
    return res.status(200).json({ success: true, message: 'শর্টলিস্ট থেকে সরানো হয়েছে', isShortlisted: false });
  }

  await Shortlist.create({ user: req.user.id, biodata: biodataId });
  await Biodata.findByIdAndUpdate(biodataId, { $inc: { shortlists: 1 } });

  await Notification.create({
    recipient: biodata.user,
    type: 'new_shortlist',
    title: 'শর্টলিস্টে যোগ হয়েছে',
    message: 'কেউ আপনার বায়োডাটা শর্টলিস্ট করেছে',
  });

  res.status(200).json({ success: true, message: 'শর্টলিস্টে যোগ হয়েছে', isShortlisted: true });
});

exports.getShortlist = asyncHandler(async (req, res) => {
  const shortlists = await Shortlist.find({ user: req.user.id })
    .populate('biodata', 'biodataId gender maritalStatus permanentDistrict education occupation avatar dateOfBirth islamicLifestyle')
    .sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: shortlists.length, data: shortlists });
});


// ════════════════════════════════════════
// NOTIFICATION CONTROLLER
// ════════════════════════════════════════

exports.getNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (page - 1) * limit;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    Notification.countDocuments({ recipient: req.user.id }),
    Notification.countDocuments({ recipient: req.user.id, isRead: false }),
  ]);

  res.status(200).json({
    success: true,
    total,
    unreadCount,
    page: parseInt(page),
    data: notifications,
  });
});

exports.markAsRead = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  const query = { recipient: req.user.id };
  if (ids && ids.length > 0) query._id = { $in: ids };

  await Notification.updateMany(query, { isRead: true, readAt: new Date() });
  res.status(200).json({ success: true, message: 'পড়া হিসেবে চিহ্নিত করা হয়েছে' });
});


// ════════════════════════════════════════
// ADMIN CONTROLLER
// ════════════════════════════════════════

exports.adminGetPendingBiodatas = asyncHandler(async (req, res) => {
  const biodatas = await Biodata.find({ status: 'pending' })
    .populate('user', 'phone email plan')
    .sort({ createdAt: 1 });
  res.status(200).json({ success: true, count: biodatas.length, data: biodatas });
});

exports.adminVerifyBiodata = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;
  const biodata = await Biodata.findById(req.params.id).populate('user');
  if (!biodata) return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));

  if (action === 'approve') {
    biodata.status = 'approved';
    biodata.isVisible = true;
    biodata.verifiedBy = req.user.id;
    biodata.verifiedAt = new Date();
  } else {
    biodata.status = 'rejected';
    biodata.isVisible = false;
    biodata.rejectionReason = reason;
  }
  await biodata.save();

  await Notification.create({
    recipient: biodata.user._id,
    type: action === 'approve' ? 'profile_verified' : 'profile_rejected',
    title: action === 'approve' ? 'বায়োডাটা অনুমোদিত ✅' : 'বায়োডাটা প্রত্যাখ্যাত',
    message: action === 'approve'
      ? 'আপনার বায়োডাটা অনুমোদন হয়েছে এবং এখন দৃশ্যমান'
      : `আপনার বায়োডাটা প্রত্যাখ্যাত হয়েছে। কারণ: ${reason}`,
    data: { biodataId: biodata._id },
  });

  res.status(200).json({
    success: true,
    message: action === 'approve' ? 'বায়োডাটা অনুমোদন হয়েছে' : 'বায়োডাটা প্রত্যাখ্যাত হয়েছে',
    data: biodata,
  });
});

exports.adminDashboardStats = asyncHandler(async (req, res) => {
  const { Subscription, Review } = require('../models/index');
  const [
    totalUsers, totalBiodatas, pendingBiodatas, approvedBiodatas,
    totalConnections, acceptedConnections, totalSubscriptions, reviews,
  ] = await Promise.all([
    User.countDocuments(),
    Biodata.countDocuments(),
    Biodata.countDocuments({ status: 'pending' }),
    Biodata.countDocuments({ status: 'approved' }),
    ConnectionRequest.countDocuments(),
    ConnectionRequest.countDocuments({ status: 'accepted' }),
    Subscription.countDocuments({ status: 'active' }),
    Review.countDocuments({ isApproved: true }),
  ]);

  const recentUsers = await User.find().sort({ createdAt: -1 }).limit(10).select('phone email plan createdAt isVerified');
  const recentBiodatas = await Biodata.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5);

  res.status(200).json({
    success: true,
    data: {
      stats: {
        totalUsers, totalBiodatas, pendingBiodatas, approvedBiodatas,
        totalConnections, acceptedConnections, totalSubscriptions, reviews,
      },
      recentUsers,
      recentBiodatas,
    },
  });
});

exports.adminManageUser = asyncHandler(async (req, res, next) => {
  const { action, reason } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('ব্যবহারকারী পাওয়া যায়নি', 404));

  if (action === 'ban') {
    user.isBanned = true;
    user.banReason = reason || 'নীতিমালা লঙ্ঘন';
    await Biodata.findOneAndUpdate({ user: user._id }, { isVisible: false });
  } else if (action === 'unban') {
    user.isBanned = false;
    user.banReason = undefined;
  } else if (action === 'verify') {
    user.isVerified = true;
  }

  await user.save({ validateBeforeSave: false });
  res.status(200).json({ success: true, message: 'ব্যবহারকারী আপডেট হয়েছে', data: user });
});
