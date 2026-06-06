// src/middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const logger = require('../utils/logger');

// ── Protect routes (must be logged in) ──
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'এই রিসোর্স অ্যাক্সেস করতে লগইন করুন',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'এই টোকেনের ব্যবহারকারী আর নেই',
      });
    }

    if (user.isBanned) {
      return res.status(403).json({
        success: false,
        message: `আপনার অ্যাকাউন্ট স্থগিত করা হয়েছে। কারণ: ${user.banReason}`,
      });
    }

    req.user = user;
    next();
  } catch (err) {
    logger.error(`Auth middleware error: ${err.message}`);
    return res.status(401).json({
      success: false,
      message: 'অবৈধ টোকেন। পুনরায় লগইন করুন।',
    });
  }
};

// ── Authorize roles ──
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `'${req.user.role}' ভূমিকার এই কাজটি করার অনুমতি নেই`,
      });
    }
    next();
  };
};

// ── Require verified phone ──
exports.requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      message: 'এই ফিচার ব্যবহার করতে আপনার অ্যাকাউন্ট ভেরিফাই করুন',
    });
  }
  next();
};

// ── Require premium plan ──
exports.requirePremium = (req, res, next) => {
  if (req.user.plan === 'basic' || (req.user.planExpiry && req.user.planExpiry < new Date())) {
    return res.status(402).json({
      success: false,
      message: 'এই ফিচারটি প্রিমিয়াম সদস্যদের জন্য। আপগ্রেড করুন।',
      upgradePath: '/api/v1/subscriptions/plans',
    });
  }
  next();
};

// ── Optional auth (does not fail if no token) ──
exports.optionalAuth = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies?.token) {
    token = req.cookies.token;
  }
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    } catch (_) {
      /* continue without user */
    }
  }
  next();
};
