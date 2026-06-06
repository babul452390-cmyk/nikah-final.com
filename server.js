// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const http = require('http');

const connectDB = require('./config/database');
const logger = require('./utils/logger');
const { errorHandler } = require('./middleware/errorHandler');

// ── Route imports ──
const authRoutes = require('./routes/auth');
const biodataRoutes = require('./routes/biodatas');
const connectionRoutes = require('./routes/connections');
const subscriptionRoutes = require('./routes/subscriptions');

// ── Init ──
const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── Connect Database ──
connectDB();

// ══════════════════════════════════════════
// MIDDLEWARE
// ══════════════════════════════════════════

// Security headers
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS
const corsOptions = {
  origin: (origin, callback) => {
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:3000',
      'http://localhost:5173',
      'https://nikah.com',
      'https://www.nikah.com',
    ].filter(Boolean);
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}`);
      callback(new Error('CORS policy violation'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};
app.use(cors(corsOptions));

// Rate limiting
const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX || 100),
  message: {
    success: false,
    message: 'অনেক বেশি অনুরোধ করা হয়েছে। পরে আবার চেষ্টা করুন।',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', globalLimiter);

// Body parsing
// Raw body for Stripe webhook (must be before express.json())
app.use('/api/v1/subscriptions/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Raw body capture for Stripe
app.use((req, res, next) => {
  if (req.rawBody === undefined && req.method !== 'GET') {
    req.rawBody = '';
    req.on('data', (chunk) => { req.rawBody += chunk; });
  }
  next();
});

app.use(cookieParser());
app.use(compression());
app.use(mongoSanitize());

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
    skip: (req) => req.url.includes('/health'),
  }));
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ══════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════

const API = '/api/v1';

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/biodatas`, biodataRoutes);
app.use(`${API}/connections`, connectionRoutes);
app.use(`${API}/subscriptions`, subscriptionRoutes);

// Shortlist routes
const shortlistRouter = express.Router();
const { toggleShortlist, getShortlist } = require('./controllers/connectionController');
const { protect } = require('./middleware/auth');
shortlistRouter.get('/', protect, getShortlist);
shortlistRouter.post('/:biodataId', protect, toggleShortlist);
app.use(`${API}/shortlists`, shortlistRouter);

// Notification routes
const notifRouter = express.Router();
const { getNotifications, markAsRead } = require('./controllers/connectionController');
notifRouter.get('/', protect, getNotifications);
notifRouter.put('/read', protect, markAsRead);
app.use(`${API}/notifications`, notifRouter);

// Review routes
const reviewRouter = express.Router();
const { createReview, getReviews } = require('./controllers/subscriptionController');
reviewRouter.get('/', getReviews);
reviewRouter.post('/', protect, createReview);
app.use(`${API}/reviews`, reviewRouter);

// Admin routes
const adminRouter = express.Router();
const { adminDashboardStats, adminManageUser, adminGetPendingBiodatas, adminVerifyBiodata } = require('./controllers/connectionController');
const { authorize } = require('./middleware/auth');
adminRouter.get('/dashboard', protect, authorize('admin'), adminDashboardStats);
adminRouter.put('/users/:id', protect, authorize('admin'), adminManageUser);
adminRouter.get('/biodatas/pending', protect, authorize('admin', 'moderator'), adminGetPendingBiodatas);
adminRouter.put('/biodatas/:id/verify', protect, authorize('admin', 'moderator'), adminVerifyBiodata);
app.use(`${API}/admin`, adminRouter);

// Report route
const reportRouter = express.Router();
const { reportUser } = require('./controllers/subscriptionController');
reportRouter.post('/', protect, reportUser);
app.use(`${API}/reports`, reportRouter);

// ── Health check ──
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  res.status(200).json({
    success: true,
    status: 'running',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    uptime: `${Math.round(process.uptime())}s`,
  });
});

// ── API docs info ──
app.get(`${API}`, (req, res) => {
  res.json({
    success: true,
    name: 'Nikah.com API',
    version: '1.0.0',
    endpoints: {
      auth: `${API}/auth`,
      biodatas: `${API}/biodatas`,
      connections: `${API}/connections`,
      shortlists: `${API}/shortlists`,
      notifications: `${API}/notifications`,
      subscriptions: `${API}/subscriptions`,
      reviews: `${API}/reviews`,
      admin: `${API}/admin`,
      reports: `${API}/reports`,
    },
  });
});

// ── 404 handler ──
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `রুট '${req.originalUrl}' পাওয়া যায়নি`,
  });
});

// ── Global error handler ──
app.use(errorHandler);

// ══════════════════════════════════════════
// SOCKET.IO — Real-time notifications
// ══════════════════════════════════════════
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

const onlineUsers = new Map();

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.userId}`);
  onlineUsers.set(socket.userId, socket.id);
  io.emit('online_users', onlineUsers.size);

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.userId);
    io.emit('online_users', onlineUsers.size);
    logger.info(`Socket disconnected: ${socket.userId}`);
  });

  socket.on('send_notification', (data) => {
    const receiverSocket = onlineUsers.get(data.receiverId);
    if (receiverSocket) {
      io.to(receiverSocket).emit('notification', data);
    }
  });
});

// Make io accessible to controllers
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// ══════════════════════════════════════════
// SCHEDULED JOBS
// ══════════════════════════════════════════
const cron = require('node-cron');
const User = require('./models/User');

// Check expiring subscriptions daily at midnight
cron.schedule('0 0 * * *', async () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const expiringUsers = await User.find({
    plan: { $ne: 'basic' },
    planExpiry: {
      $gte: new Date(),
      $lte: tomorrow,
    },
  });

  for (const user of expiringUsers) {
    const { Notification } = require('./models/index');
    await Notification.create({
      recipient: user._id,
      type: 'subscription_expiring',
      title: '⚠️ সাবস্ক্রিপশন মেয়াদ শেষ হতে চলেছে',
      message: 'আপনার সাবস্ক্রিপশন কাল শেষ হবে। নবায়ন করুন।',
    });
  }

  // Expire old plans
  await User.updateMany(
    { plan: { $ne: 'basic' }, planExpiry: { $lt: new Date() } },
    { plan: 'basic', planExpiry: null }
  );

  logger.info('Daily subscription check complete');
}, { timezone: 'Asia/Dhaka' });

// ── Start server ──
server.listen(PORT, () => {
  logger.info(`🚀 Nikah.com API running on port ${PORT} [${process.env.NODE_ENV}]`);
  logger.info(`📡 Health: http://localhost:${PORT}/health`);
  logger.info(`📋 API: http://localhost:${PORT}/api/v1`);
});

// Unhandled rejection handler
process.on('unhandledRejection', (err) => {
  logger.error(`Unhandled Rejection: ${err.message}`);
  server.close(() => process.exit(1));
});

process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`);
  process.exit(1);
});

module.exports = { app, server };
