// src/config/redis.js
const logger = require('../utils/logger');

let redisClient = null;
let isRedisConnected = false;

const connectRedis = async () => {
  try {
    const { createClient } = require('redis');
    redisClient = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      password: process.env.REDIS_PASSWORD || undefined,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > 5) {
            logger.warn('Redis max retries reached. Running without cache.');
            return false;
          }
          return Math.min(retries * 100, 3000);
        },
      },
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      logger.warn(`Redis error: ${err.message}`);
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
      logger.info('✅ Redis connected');
    });

    redisClient.on('disconnect', () => {
      isRedisConnected = false;
      logger.warn('Redis disconnected');
    });

    await redisClient.connect();
  } catch (err) {
    logger.warn(`Redis connection failed: ${err.message}. Running without cache.`);
  }
};

// ── Cache helpers ──
const cache = {
  get: async (key) => {
    if (!isRedisConnected || !redisClient) return null;
    try {
      const val = await redisClient.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  },

  set: async (key, value, ttlSeconds = 300) => {
    if (!isRedisConnected || !redisClient) return false;
    try {
      await redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch { return false; }
  },

  del: async (key) => {
    if (!isRedisConnected || !redisClient) return false;
    try {
      await redisClient.del(key);
      return true;
    } catch { return false; }
  },

  delPattern: async (pattern) => {
    if (!isRedisConnected || !redisClient) return false;
    try {
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) await redisClient.del(keys);
      return true;
    } catch { return false; }
  },

  isConnected: () => isRedisConnected,
};

// ── Express middleware for route caching ──
const cacheMiddleware = (ttl = 300) => async (req, res, next) => {
  if (!isRedisConnected) return next();
  const key = `cache:${req.originalUrl}`;
  const cached = await cache.get(key);
  if (cached) {
    return res.status(200).json({ ...cached, fromCache: true });
  }
  const originalJson = res.json.bind(res);
  res.json = async (data) => {
    if (res.statusCode === 200) await cache.set(key, data, ttl);
    originalJson(data);
  };
  next();
};

module.exports = { connectRedis, cache, cacheMiddleware };
