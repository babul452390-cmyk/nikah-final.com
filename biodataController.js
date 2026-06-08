// src/controllers/biodataController.js
const Biodata = require('../models/Biodata');
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { uploadToCloudinary, deleteFromCloudinary } = require('../middleware/upload');
const { Notification } = require('../models/index');
const logger = require('../utils/logger');

// ── @route   POST /api/v1/biodatas ──
// ── @desc    Create or update own biodata ──
// ── @access  Private ──
exports.createBiodata = asyncHandler(async (req, res, next) => {
  const existing = await Biodata.findOne({ user: req.user.id });
  if (existing) {
    return next(new AppError('আপনার ইতিমধ্যে একটি বায়োডাটা আছে। আপডেট করুন।', 400));
  }

  const biodataData = {
    ...req.body,
    user: req.user.id,
    gender: req.body.type === 'পাত্রের বায়োডাটা' ? 'male' : 'female',
    status: 'pending',
    isVisible: false,
  };

  const biodata = await Biodata.create(biodataData);

  // Update user profile completeness
  await updateProfileCompleteness(req.user.id, biodata);

  // Create admin notification
  await Notification.create({
    recipient: await getAdminId(),
    type: 'system',
    title: 'নতুন বায়োডাটা অনুমোদনের জন্য',
    message: `বায়োডাটা ID: ${biodata.biodataId} অনুমোদনের অপেক্ষায়`,
    data: { biodataId: biodata._id },
  });

  res.status(201).json({
    success: true,
    message: 'বায়োডাটা জমা হয়েছে। ভেরিফিকেশনের পর প্রকাশিত হবে।',
    data: biodata,
  });
});

// ── @route   PUT /api/v1/biodatas/me ──
exports.updateMyBiodata = asyncHandler(async (req, res, next) => {
  let biodata = await Biodata.findOne({ user: req.user.id });
  if (!biodata) return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));

  // Don't allow changing certain fields after approval
  if (biodata.status === 'approved') {
    const restrictedFields = ['gender', 'type'];
    restrictedFields.forEach(field => delete req.body[field]);
    req.body.status = 'pending'; // Re-verify after update
    req.body.isVisible = false;
  }

  biodata = await Biodata.findOneAndUpdate(
    { user: req.user.id },
    req.body,
    { new: true, runValidators: true }
  );

  await updateProfileCompleteness(req.user.id, biodata);

  res.status(200).json({
    success: true,
    message: 'বায়োডাটা আপডেট হয়েছে',
    data: biodata,
  });
});

// ── @route   GET /api/v1/biodatas/me ──
exports.getMyBiodata = asyncHandler(async (req, res, next) => {
  const biodata = await Biodata.findOne({ user: req.user.id });
  if (!biodata) {
    return res.status(200).json({ success: true, data: null, hasBiodata: false });
  }
  res.status(200).json({ success: true, data: biodata, hasBiodata: true });
});

// ── @route   GET /api/v1/biodatas ──
// ── @desc    Get all approved biodatas with filters ──
// ── @access  Public (limited) / Private (full) ──
exports.getBiodatas = asyncHandler(async (req, res) => {
  const {
    gender, maritalStatus, district, ageMin, ageMax,
    education, occupation, islamicLifestyle, prayerHabit,
    sort, page = 1, limit = 12,
  } = req.query;

  const query = { status: 'approved', isVisible: true };

  // Filters
  if (gender) query.gender = gender;
  if (maritalStatus) query.maritalStatus = maritalStatus;
  if (district) query.permanentDistrict = district;
  if (education) query.education = education;
  if (occupation) query.occupation = occupation;
  if (islamicLifestyle) query.islamicLifestyle = islamicLifestyle;
  if (prayerHabit) query.prayerHabit = prayerHabit;

  // Age range (DOB range)
  if (ageMin || ageMax) {
    const today = new Date();
    query.dateOfBirth = {};
    if (ageMax) {
      query.dateOfBirth.$gte = new Date(today.getFullYear() - parseInt(ageMax), today.getMonth(), today.getDate());
    }
    if (ageMin) {
      query.dateOfBirth.$lte = new Date(today.getFullYear() - parseInt(ageMin), today.getMonth(), today.getDate());
    }
  }

  // Sort options
  const sortOptions = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    age_asc: { dateOfBirth: -1 },
    age_desc: { dateOfBirth: 1 },
    most_viewed: { views: -1 },
  };

  const sortQuery = sortOptions[sort] || sortOptions.newest;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [biodatas, total] = await Promise.all([
    Biodata.find(query)
      .sort(sortQuery)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-documents -guardianPhone -guardianName'), // Hide sensitive info
    Biodata.countDocuments(query),
  ]);

  // Increment views for visible biodatas (batch)
  if (biodatas.length > 0) {
    await Biodata.updateMany(
      { _id: { $in: biodatas.map(b => b._id) } },
      { $inc: { views: 1 } }
    );
  }

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    pages: Math.ceil(total / parseInt(limit)),
    count: biodatas.length,
    data: biodatas,
  });
});

// ── @route   GET /api/v1/biodatas/:id ──
exports.getBiodata = asyncHandler(async (req, res, next) => {
  const biodata = await Biodata.findById(req.params.id)
    .populate('user', 'plan isVerified createdAt');

  if (!biodata || biodata.status !== 'approved' || !biodata.isVisible) {
    return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));
  }

  await Biodata.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } });

  // Hide guardian phone for non-premium users
  const data = biodata.toObject();
  if (!req.user || req.user.plan === 'basic') {
    delete data.guardianPhone;
    delete data.guardianName;
  }

  res.status(200).json({ success: true, data });
});

// ── @route   GET /api/v1/biodatas/search ──
exports.searchBiodatas = asyncHandler(async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(200).json({ success: true, data: [] });
  }

  const biodatas = await Biodata.find({
    status: 'approved',
    isVisible: true,
    $or: [
      { permanentDistrict: { $regex: q, $options: 'i' } },
      { occupation: { $regex: q, $options: 'i' } },
      { education: { $regex: q, $options: 'i' } },
      { biodataId: { $regex: q, $options: 'i' } },
    ],
  })
    .limit(20)
    .select('biodataId gender maritalStatus permanentDistrict education occupation avatar dateOfBirth');

  res.status(200).json({ success: true, count: biodatas.length, data: biodatas });
});

// ── @route   POST /api/v1/biodatas/avatar ──
exports.uploadAvatar = asyncHandler(async (req, res, next) => {
  if (!req.file) return next(new AppError('ছবি আপলোড করুন', 400));

  const biodata = await Biodata.findOne({ user: req.user.id });
  if (!biodata) return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));

  // Delete old avatar from Cloudinary
  if (biodata.avatar?.public_id) {
    await deleteFromCloudinary(biodata.avatar.public_id);
  }

  const result = await uploadToCloudinary(req.file.buffer, 'avatars', {
    transformation: [
      { width: 400, height: 400, crop: 'fill', gravity: 'face' },
      { quality: 'auto', fetch_format: 'auto' },
    ],
  });

  biodata.avatar = { public_id: result.public_id, url: result.secure_url };
  await biodata.save();

  res.status(200).json({
    success: true,
    message: 'প্রোফাইল ছবি আপলোড হয়েছে',
    data: { url: result.secure_url },
  });
});

// ── @route   PUT /api/v1/biodatas/visibility ──
exports.toggleVisibility = asyncHandler(async (req, res, next) => {
  const biodata = await Biodata.findOne({ user: req.user.id });
  if (!biodata) return next(new AppError('বায়োডাটা পাওয়া যায়নি', 404));
  if (biodata.status !== 'approved') {
    return next(new AppError('বায়োডাটা অনুমোদিত না হওয়া পর্যন্ত দৃশ্যমানতা পরিবর্তন করা যাবে না', 400));
  }

  biodata.isProfileHidden = !biodata.isProfileHidden;
  biodata.isVisible = !biodata.isProfileHidden;
  await biodata.save();

  res.status(200).json({
    success: true,
    message: biodata.isVisible ? 'বায়োডাটা দৃশ্যমান করা হয়েছে' : 'বায়োডাটা লুকানো হয়েছে',
    isVisible: biodata.isVisible,
  });
});

// ── @route   GET /api/v1/biodatas/stats ──
// ── @access  Admin ──
exports.getBiodataStats = asyncHandler(async (req, res) => {
  const stats = await Biodata.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
      },
    },
  ]);

  const genderStats = await Biodata.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$gender', count: { $sum: 1 } } },
  ]);

  const districtStats = await Biodata.aggregate([
    { $match: { status: 'approved', isVisible: true } },
    { $group: { _id: '$permanentDistrict', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
  ]);

  res.status(200).json({ success: true, data: { stats, genderStats, districtStats } });
});

// ── Helper: update profile completeness ──
const updateProfileCompleteness = async (userId, biodata) => {
  const fields = [
    'type', 'maritalStatus', 'dateOfBirth', 'height', 'permanentDistrict',
    'fatherName', 'motherName', 'familyEconomicStatus', 'education',
    'occupation', 'prayerHabit', 'islamicLifestyle', 'guardianPhone',
    'partnerExpectations', 'avatar',
  ];
  const filled = fields.filter(f => {
    const val = f === 'avatar' ? biodata.avatar?.url : biodata[f];
    return val !== undefined && val !== null && val !== '';
  });
  const completeness = Math.round((filled.length / fields.length) * 100);
  await User.findByIdAndUpdate(userId, { profileCompleteness: completeness });
  return completeness;
};

// ── Helper: get admin user id ──
const getAdminId = async () => {
  const admin = await User.findOne({ role: 'admin' });
  return admin?._id;
};
