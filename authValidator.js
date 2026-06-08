// src/validators/authValidator.js
const { body, validationResult } = require('express-validator');

// ── Helper: run validators and return errors ──
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'ইনপুট যাচাই ব্যর্থ হয়েছে',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Register rules ──
exports.registerRules = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('পাসওয়ার্ডে বড় হাতের অক্ষর, ছোট হাতের অক্ষর ও সংখ্যা থাকতে হবে'),
  body('phone')
    .optional()
    .matches(/^(\+880|880|0)[1-9]\d{8,9}$/)
    .withMessage('সঠিক বাংলাদেশী ফোন নম্বর দিন'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('সঠিক ইমেইল ঠিকানা দিন')
    .normalizeEmail(),
];

// ── Login rules ──
exports.loginRules = [
  body('identifier')
    .notEmpty()
    .withMessage('ফোন নম্বর বা ইমেইল দিন'),
  body('password')
    .notEmpty()
    .withMessage('পাসওয়ার্ড দিন'),
];

// ── OTP rules ──
exports.otpRules = [
  body('phone')
    .matches(/^(\+880|880|0)[1-9]\d{8,9}$/)
    .withMessage('সঠিক ফোন নম্বর দিন'),
  body('otp')
    .isLength({ min: 6, max: 6 })
    .isNumeric()
    .withMessage('৬ সংখ্যার OTP দিন'),
];

// ── Reset password rules ──
exports.resetPasswordRules = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে'),
];
