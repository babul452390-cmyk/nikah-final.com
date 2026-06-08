// src/routes/subscriptions.js
const express = require('express');
const router = express.Router();
const {
  getPlans, createCheckout, activateSubscription,
  stripeWebhook, getMySubscriptions,
  createReview, getReviews,
  reportUser,
} = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/auth');

// ── Plans ──
router.get('/plans', getPlans);
router.get('/my', protect, getMySubscriptions);
router.post('/checkout', protect, createCheckout);
router.post('/activate', protect, activateSubscription);

// ── Stripe webhook (raw body needed) ──
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

module.exports = router;


// ─────────────────────────────────────────
// src/routes/reviews.js
// ─────────────────────────────────────────
const reviewRouter = express.Router();
const { protect: authProtect } = require('../middleware/auth');
const { createReview: create, getReviews: getAll } = require('../controllers/subscriptionController');

reviewRouter.get('/', getAll);
reviewRouter.post('/', authProtect, create);

module.exports = reviewRouter;


// ─────────────────────────────────────────
// src/routes/notifications.js
// ─────────────────────────────────────────
const notifRouter = express.Router();
const { getNotifications, markAsRead } = require('../controllers/connectionController');
const { protect: notifProtect } = require('../middleware/auth');

notifRouter.get('/', notifProtect, getNotifications);
notifRouter.put('/read', notifProtect, markAsRead);

module.exports = notifRouter;


// ─────────────────────────────────────────
// src/routes/admin.js
// ─────────────────────────────────────────
const adminRouter = express.Router();
const { protect: adminProtect, authorize: adminAuth } = require('../middleware/auth');
const { adminDashboardStats, adminManageUser } = require('../controllers/connectionController');

adminRouter.get('/dashboard', adminProtect, adminAuth('admin'), adminDashboardStats);
adminRouter.put('/users/:id', adminProtect, adminAuth('admin'), adminManageUser);

module.exports = adminRouter;
