// src/controllers/authController.js
const crypto = require('crypto');
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { sendEmail } = require('../utils/email');
const { sendSMS } = require('../utils/sms');
const logger = require('../utils/logger');

// ── Helper: send token response ──
const sendTokenResponse = (user, statusCode, res, message = 'সফল') => {
  const token = user.getSignedJwtToken();
  const refreshToken = user.getRefreshToken();

  const cookieOptions = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  };

  res
    .status(statusCode)
    .cookie('token', token, cookieOptions)
    .json({
      success: true,
      message,
      token,
      refreshToken,
      user: {
        id: user._id,
        phone: user.phone,
        email: user.email,
        role: user.role,
        plan: user.plan,
        isVerified: user.isVerified,
        isPhoneVerified: user.isPhoneVerified,
      },
    });
};

// ── @route   POST /api/v1/auth/register ──
// ── @access  Public ──
exports.register = asyncHandler(async (req, res, next) => {
  const { phone, email, password } = req.body;

  if (!phone && !email) {
    return next(new AppError('ফোন নম্বর বা ইমেইল দিন', 400));
  }
  if (!password) return next(new AppError('পাসওয়ার্ড দিন', 400));

  const existingUser = await User.findOne({
    $or: [phone ? { phone } : null, email ? { email } : null].filter(Boolean),
  });

  if (existingUser) {
    return next(new AppError('এই তথ্য দিয়ে আগেই নিবন্ধন করা আছে', 400));
  }

  const user = await User.create({ phone, email, password });

  // Send OTP if phone provided
  if (phone) {
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });
    try {
      await sendSMS(phone, `আপনার Nikah.com যাচাই কোড: ${otp}। এটি ১০ মিনিট পর্যন্ত বৈধ।`);
    } catch (err) {
      logger.error(`OTP SMS failed: ${err.message}`);
      user.phoneOTP = undefined;
      user.phoneOTPExpire = undefined;
      await user.save({ validateBeforeSave: false });
    }
  }

  // Send verification email if email provided
  if (email) {
    const token = user.generateEmailToken();
    await user.save({ validateBeforeSave: false });
    const verifyUrl = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: 'Nikah.com - ইমেইল ভেরিফিকেশন',
        template: 'emailVerification',
        data: { verifyUrl },
      });
    } catch (err) {
      logger.error(`Verification email failed: ${err.message}`);
    }
  }

  sendTokenResponse(user, 201, res, 'নিবন্ধন সফল হয়েছে। OTP যাচাই করুন।');
});

// ── @route   POST /api/v1/auth/verify-otp ──
exports.verifyOTP = asyncHandler(async (req, res, next) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) return next(new AppError('ফোন নম্বর ও OTP দিন', 400));

  const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');

  const user = await User.findOne({
    phone,
    phoneOTP: hashedOTP,
    phoneOTPExpire: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('OTP অবৈধ বা মেয়াদোত্তীর্ণ', 400));

  user.isPhoneVerified = true;
  user.isVerified = true;
  user.phoneOTP = undefined;
  user.phoneOTPExpire = undefined;
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, 'ফোন ভেরিফিকেশন সফল!');
});

// ── @route   POST /api/v1/auth/resend-otp ──
exports.resendOTP = asyncHandler(async (req, res, next) => {
  const { phone } = req.body;
  if (!phone) return next(new AppError('ফোন নম্বর দিন', 400));

  const user = await User.findOne({ phone });
  if (!user) return next(new AppError('এই ফোন নম্বরে কোনো অ্যাকাউন্ট নেই', 404));
  if (user.isPhoneVerified) return next(new AppError('এই নম্বর ইতিমধ্যে ভেরিফাই করা আছে', 400));

  const otp = user.generateOTP();
  await user.save({ validateBeforeSave: false });
  await sendSMS(phone, `আপনার Nikah.com যাচাই কোড: ${otp}। এটি ১০ মিনিট পর্যন্ত বৈধ।`);

  res.status(200).json({ success: true, message: 'OTP পুনরায় পাঠানো হয়েছে' });
});

// ── @route   POST /api/v1/auth/login ──
exports.login = asyncHandler(async (req, res, next) => {
  const { identifier, password } = req.body;
  if (!identifier || !password) {
    return next(new AppError('ফোন/ইমেইল এবং পাসওয়ার্ড দিন', 400));
  }

  const isPhone = /^(\+880|880|0)[1-9]\d{8,9}$/.test(identifier);
  const query = isPhone ? { phone: identifier } : { email: identifier.toLowerCase() };

  const user = await User.findOne(query).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    return next(new AppError('ফোন/ইমেইল বা পাসওয়ার্ড সঠিক নয়', 401));
  }

  if (user.isBanned) {
    return next(new AppError(`আপনার অ্যাকাউন্ট স্থগিত: ${user.banReason}`, 403));
  }

  user.lastLogin = new Date();
  user.loginCount += 1;
  await user.save({ validateBeforeSave: false });

  sendTokenResponse(user, 200, res, 'লগইন সফল!');
});

// ── @route   POST /api/v1/auth/logout ──
exports.logout = asyncHandler(async (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({ success: true, message: 'লগআউট সফল' });
});

// ── @route   GET /api/v1/auth/me ──
exports.getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

// ── @route   POST /api/v1/auth/forgot-password ──
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { identifier } = req.body;
  if (!identifier) return next(new AppError('ফোন নম্বর বা ইমেইল দিন', 400));

  const isPhone = /^(\+880|880|0)[1-9]\d{8,9}$/.test(identifier);
  const query = isPhone ? { phone: identifier } : { email: identifier.toLowerCase() };

  const user = await User.findOne(query);
  if (!user) return next(new AppError('এই তথ্য দিয়ে কোনো অ্যাকাউন্ট নেই', 404));

  if (isPhone) {
    const otp = user.generateOTP();
    await user.save({ validateBeforeSave: false });
    await sendSMS(identifier, `Nikah.com পাসওয়ার্ড রিসেট OTP: ${otp}। ১০ মিনিটের মধ্যে ব্যবহার করুন।`);
    res.status(200).json({ success: true, message: 'রিসেট OTP পাঠানো হয়েছে', via: 'sms' });
  } else {
    const resetToken = user.generatePasswordResetToken();
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${process.env.CLIENT_URL}/reset-password?token=${resetToken}`;
    await sendEmail({
      to: identifier,
      subject: 'Nikah.com - পাসওয়ার্ড রিসেট',
      template: 'passwordReset',
      data: { resetUrl },
    });
    res.status(200).json({ success: true, message: 'রিসেট লিংক পাঠানো হয়েছে', via: 'email' });
  }
});

// ── @route   PUT /api/v1/auth/reset-password ──
exports.resetPassword = asyncHandler(async (req, res, next) => {
  const { token, otp, phone, password } = req.body;

  if (!password || password.length < 8) {
    return next(new AppError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে', 400));
  }

  let user;

  if (otp && phone) {
    const hashedOTP = crypto.createHash('sha256').update(otp).digest('hex');
    user = await User.findOne({
      phone,
      phoneOTP: hashedOTP,
      phoneOTPExpire: { $gt: Date.now() },
    });
  } else if (token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
  }

  if (!user) return next(new AppError('অবৈধ বা মেয়াদোত্তীর্ণ টোকেন', 400));

  user.password = password;
  user.phoneOTP = undefined;
  user.phoneOTPExpire = undefined;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
});

// ── @route   PUT /api/v1/auth/update-password ──
exports.updatePassword = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('+password');
  const { currentPassword, newPassword } = req.body;

  if (!await user.matchPassword(currentPassword)) {
    return next(new AppError('বর্তমান পাসওয়ার্ড সঠিক নয়', 401));
  }
  if (newPassword.length < 8) {
    return next(new AppError('নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে', 400));
  }

  user.password = newPassword;
  await user.save();
  sendTokenResponse(user, 200, res, 'পাসওয়ার্ড আপডেট হয়েছে');
});

// ── @route   POST /api/v1/auth/refresh-token ──
exports.refreshToken = asyncHandler(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return next(new AppError('রিফ্রেশ টোকেন দিন', 400));

  const jwt = require('jsonwebtoken');
  const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  const user = await User.findById(decoded.id);
  if (!user) return next(new AppError('ব্যবহারকারী পাওয়া যায়নি', 404));

  const newToken = user.getSignedJwtToken();
  res.status(200).json({ success: true, token: newToken });
});
