// src/controllers/subscriptionController.js
const User = require('../models/User');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { Subscription, Notification } = require('../models/index');
const logger = require('../utils/logger');

// ── Plan details ──
const PLANS = {
  basic: {
    name: 'Basic',
    price: 0,
    duration: 0,
    features: {
      contactView: 0,
      profileBoost: false,
      advancedSearch: false,
      prioritySupport: false,
      description: ['বায়োডাটা তৈরি', 'বায়োডাটা দেখা', '৫টি রিকোয়েস্ট/মাস'],
    },
  },
  standard: {
    name: 'Standard',
    price: parseInt(process.env.PLAN_STANDARD_PRICE) || 299,
    duration: 30,
    features: {
      contactView: 15,
      profileBoost: false,
      advancedSearch: true,
      prioritySupport: false,
      description: ['১৫টি যোগাযোগ নম্বর', 'অ্যাডভান্সড সার্চ', 'সীমাহীন রিকোয়েস্ট'],
    },
  },
  premium: {
    name: 'Premium',
    price: parseInt(process.env.PLAN_PREMIUM_PRICE) || 599,
    duration: 30,
    features: {
      contactView: 30,
      profileBoost: true,
      advancedSearch: true,
      prioritySupport: false,
      description: ['৩০টি যোগাযোগ নম্বর', 'প্রোফাইল বুস্ট', 'অ্যাডভান্সড সার্চ'],
    },
  },
  gold: {
    name: 'Gold',
    price: parseInt(process.env.PLAN_GOLD_PRICE) || 999,
    duration: 90,
    features: {
      contactView: 999,
      profileBoost: true,
      advancedSearch: true,
      prioritySupport: true,
      description: ['সীমাহীন যোগাযোগ নম্বর', 'প্রায়রিটি সাপোর্ট', '৩ মাসের সাবস্ক্রিপশন'],
    },
  },
};

// ── @route   GET /api/v1/subscriptions/plans ──
exports.getPlans = asyncHandler(async (req, res) => {
  res.status(200).json({
    success: true,
    data: Object.entries(PLANS).map(([key, plan]) => ({ key, ...plan })),
  });
});

// ── @route   POST /api/v1/subscriptions/checkout ──
exports.createCheckout = asyncHandler(async (req, res, next) => {
  const { plan, paymentMethod } = req.body;
  const planDetails = PLANS[plan];

  if (!planDetails || plan === 'basic') {
    return next(new AppError('অবৈধ প্ল্যান নির্বাচন', 400));
  }

  if (paymentMethod === 'stripe') {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    let customerId = req.user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email,
        metadata: { userId: req.user._id.toString() },
      });
      customerId = customer.id;
      await User.findByIdAndUpdate(req.user.id, { stripeCustomerId: customerId });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'bdt',
          product_data: {
            name: `Nikah.com ${planDetails.name} Plan`,
            description: planDetails.features.description.join(', '),
          },
          unit_amount: planDetails.price * 100,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&plan=${plan}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      metadata: { userId: req.user._id.toString(), plan },
    });

    return res.status(200).json({ success: true, sessionId: session.id, url: session.url });
  }

  // For bKash/Nagad/Rocket - return payment instructions
  res.status(200).json({
    success: true,
    message: `${paymentMethod.toUpperCase()} পেমেন্ট ইন্সট্রাকশন`,
    data: {
      amount: planDetails.price,
      currency: 'BDT',
      plan,
      instructions: `আমাদের ${paymentMethod} নম্বরে ${planDetails.price} টাকা পাঠান এবং Transaction ID সহ সাপোর্টে যোগাযোগ করুন।`,
      paymentNumber: '01XXXXXXXXX',
    },
  });
});

// ── @route   POST /api/v1/subscriptions/activate ──
// ── @desc    Manual activation (admin) or after webhook ──
exports.activateSubscription = asyncHandler(async (req, res, next) => {
  const { userId, plan, transactionId, paymentMethod, sessionId } = req.body;
  const planDetails = PLANS[plan];

  if (!planDetails) return next(new AppError('অবৈধ প্ল্যান', 400));

  const targetUserId = req.user.role === 'admin' ? userId : req.user.id;
  const user = await User.findById(targetUserId);
  if (!user) return next(new AppError('ব্যবহারকারী পাওয়া যায়নি', 404));

  // Verify Stripe session if applicable
  if (sessionId && paymentMethod === 'stripe') {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return next(new AppError('পেমেন্ট সম্পন্ন হয়নি', 400));
    }
  }

  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + planDetails.duration);

  const subscription = await Subscription.create({
    user: targetUserId,
    plan,
    price: planDetails.price,
    startDate,
    endDate,
    status: 'active',
    paymentMethod: paymentMethod || 'manual',
    transactionId,
    stripePaymentIntentId: sessionId,
    features: planDetails.features,
  });

  user.plan = plan;
  user.planExpiry = endDate;
  await user.save({ validateBeforeSave: false });

  await Notification.create({
    recipient: targetUserId,
    type: 'subscription_activated',
    title: `${planDetails.name} প্ল্যান সক্রিয় ✅`,
    message: `আপনার ${planDetails.name} সাবস্ক্রিপশন ${endDate.toLocaleDateString('bn-BD')} পর্যন্ত সক্রিয়`,
    data: { plan, endDate },
  });

  res.status(200).json({
    success: true,
    message: `${planDetails.name} প্ল্যান সফলভাবে সক্রিয় হয়েছে`,
    data: subscription,
  });
});

// ── @route   POST /api/v1/subscriptions/webhook ──
exports.stripeWebhook = asyncHandler(async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error(`Stripe webhook error: ${err.message}`);
    return res.status(400).json({ error: `Webhook Error: ${err.message}` });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    if (session.payment_status === 'paid') {
      const { userId, plan } = session.metadata;
      const planDetails = PLANS[plan];
      if (userId && planDetails) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + planDetails.duration);

        await Subscription.create({
          user: userId,
          plan,
          price: planDetails.price,
          startDate,
          endDate,
          status: 'active',
          paymentMethod: 'stripe',
          stripePaymentIntentId: session.payment_intent,
          features: planDetails.features,
        });

        await User.findByIdAndUpdate(userId, { plan, planExpiry: endDate });
        await Notification.create({
          recipient: userId,
          type: 'subscription_activated',
          title: `${planDetails.name} প্ল্যান সক্রিয়`,
          message: `পেমেন্ট সফল। আপনার প্ল্যান সক্রিয় হয়েছে।`,
        });
      }
    }
  }

  res.status(200).json({ received: true });
});

// ── @route   GET /api/v1/subscriptions/my ──
exports.getMySubscriptions = asyncHandler(async (req, res) => {
  const subscriptions = await Subscription.find({ user: req.user.id }).sort({ createdAt: -1 });
  res.status(200).json({ success: true, count: subscriptions.length, data: subscriptions });
});


// ════════════════════════════════════════
// REVIEW CONTROLLER
// ════════════════════════════════════════
const { Review } = require('../models/index');

exports.createReview = asyncHandler(async (req, res, next) => {
  const { rating, comment, coupleDetails, location } = req.body;
  if (!rating || !comment) return next(new AppError('রেটিং ও মন্তব্য দিন', 400));

  const existing = await Review.findOne({ user: req.user.id });
  if (existing) return next(new AppError('আপনি আগেই একটি রিভিউ দিয়েছেন', 400));

  const review = await Review.create({
    user: req.user.id,
    rating,
    comment,
    coupleDetails,
    location,
  });

  res.status(201).json({
    success: true,
    message: 'রিভিউ জমা হয়েছে। অনুমোদনের পর প্রকাশিত হবে।',
    data: review,
  });
});

exports.getReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({ isApproved: true })
    .populate('user', 'plan')
    .sort({ isFeatured: -1, createdAt: -1 })
    .limit(20);
  res.status(200).json({ success: true, count: reviews.length, data: reviews });
});

// ── Report controller ──
const { Report } = require('../models/index');

exports.reportUser = asyncHandler(async (req, res, next) => {
  const { reportedUserId, reportedBiodataId, reason, description } = req.body;

  if (reportedUserId === req.user.id.toString()) {
    return next(new AppError('নিজেকে রিপোর্ট করা যাবে না', 400));
  }

  const existing = await Report.findOne({ reporter: req.user.id, reported: reportedUserId });
  if (existing) return next(new AppError('আপনি এই ব্যবহারকারীকে আগেই রিপোর্ট করেছেন', 400));

  const report = await Report.create({
    reporter: req.user.id,
    reported: reportedUserId,
    reportedBiodata: reportedBiodataId,
    reason,
    description,
  });

  res.status(201).json({
    success: true,
    message: 'রিপোর্ট জমা হয়েছে। আমরা শীঘ্রই পর্যালোচনা করব।',
    data: { id: report._id },
  });
});
