// src/middleware/errorHandler.js
const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const handleCastErrorDB = (err) =>
  new AppError(`অবৈধ ${err.path}: ${err.value}`, 400);

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const messages = {
    phone: `এই ফোন নম্বর (${value}) দিয়ে আগেই নিবন্ধন করা হয়েছে`,
    email: `এই ইমেইল (${value}) দিয়ে আগেই নিবন্ধন করা হয়েছে`,
  };
  return new AppError(messages[field] || `ডুপ্লিকেট ফিল্ড: ${value}`, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  return new AppError(`যাচাই ত্রুটি: ${errors.join('. ')}`, 400);
};

const handleJWTError = () =>
  new AppError('অবৈধ টোকেন। পুনরায় লগইন করুন।', 401);

const handleJWTExpiredError = () =>
  new AppError('আপনার টোকেনের মেয়াদ শেষ। পুনরায় লগইন করুন।', 401);

const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err,
  });
};

const sendErrorProd = (err, res) => {
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
    });
  } else {
    logger.error('UNEXPECTED ERROR 💥', err);
    res.status(500).json({
      success: false,
      status: 'error',
      message: 'সার্ভারে একটি সমস্যা হয়েছে। অনুগ্রহ করে পরে চেষ্টা করুন।',
    });
  }
};

const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  logger.error(`${err.statusCode} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err, message: err.message };
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    sendErrorProd(error, res);
  }
};

// Async error wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = { errorHandler, AppError, asyncHandler };
