// src/routes/auth.js
const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  register, login, logout, getMe, verifyOTP, resendOTP,
  forgotPassword, resetPassword, updatePassword, refreshToken,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: 'অনেক বার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' },
});
const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, max: 5,
  message: { success: false, message: 'OTP সীমা অতিক্রান্ত। ১ ঘণ্টা পরে চেষ্টা করুন।' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', otpLimiter, resendOTP);
router.post('/forgot-password', otpLimiter, forgotPassword);
router.put('/reset-password', resetPassword);
router.put('/update-password', protect, updatePassword);
router.post('/refresh-token', refreshToken);

module.exports = router;
