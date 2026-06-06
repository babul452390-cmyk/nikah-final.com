// src/middleware/upload.js
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { AppError } = require('./errorHandler');

// ── Multer memory storage (files go to Cloudinary) ──
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('শুধুমাত্র JPEG, PNG বা WebP ছবি আপলোড করুন', 400), false);
  }
};

const docFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'application/pdf'];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new AppError('শুধুমাত্র ছবি বা PDF আপলোড করুন', 400), false);
  }
};

// ── Avatar upload (single image, max 5MB) ──
exports.uploadAvatar = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).single('avatar');

// ── Document upload (multiple, max 5MB each) ──
exports.uploadDocuments = multer({
  storage,
  fileFilter: docFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
}).array('documents', 3);

// ── Cloudinary helper ──
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadToCloudinary = async (buffer, folder, options = {}) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `nikah/${folder}`,
        resource_type: 'auto',
        transformation: options.transformation || [],
        public_id: uuidv4(),
        ...options,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

exports.deleteFromCloudinary = async (publicId) => {
  return cloudinary.uploader.destroy(publicId);
};

exports.cloudinary = cloudinary;
