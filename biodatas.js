// src/routes/biodatas.js
const express = require('express');
const router = express.Router();
const {
  createBiodata, updateMyBiodata, getMyBiodata, getBiodatas,
  getBiodata, searchBiodatas, uploadAvatar, toggleVisibility,
  getBiodataStats, adminGetPendingBiodatas, adminVerifyBiodata,
} = require('../controllers/biodataController');
const { protect, authorize, requireVerified } = require('../middleware/auth');
const { uploadAvatar: multerAvatar } = require('../middleware/upload');

// ── Public ──
router.get('/', getBiodatas);
router.get('/search', searchBiodatas);

// ── Private - user ──
router.get('/my/biodata', protect, getMyBiodata);
router.post('/', protect, requireVerified, createBiodata);
router.put('/me', protect, updateMyBiodata);
router.post('/me/avatar', protect, multerAvatar, uploadAvatar);
router.put('/me/visibility', protect, toggleVisibility);

// ── Admin ──
router.get('/admin/stats', protect, authorize('admin'), getBiodataStats);
router.get('/admin/pending', protect, authorize('admin', 'moderator'), adminGetPendingBiodatas);
router.put('/admin/:id/verify', protect, authorize('admin', 'moderator'), adminVerifyBiodata);

// ── Public with ID (must be last) ──
router.get('/:id', getBiodata);

module.exports = router;
