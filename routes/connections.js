// src/routes/connections.js
const express = require('express');
const router = express.Router();
const {
  sendRequest, respondToRequest, getSentRequests,
  getReceivedRequests, getAcceptedConnections, cancelRequest,
  toggleShortlist, getShortlist,
  getNotifications, markAsRead,
} = require('../controllers/connectionController');
const { protect, requireVerified } = require('../middleware/auth');

// ── Connection Requests ──
router.post('/request', protect, requireVerified, sendRequest);
router.put('/:id/respond', protect, requireVerified, respondToRequest);
router.delete('/:id', protect, cancelRequest);
router.get('/sent', protect, getSentRequests);
router.get('/received', protect, getReceivedRequests);
router.get('/accepted', protect, getAcceptedConnections);

module.exports = router;


// ─────────────────────────────────────────
// src/routes/shortlists.js
// ─────────────────────────────────────────
const shortlistRouter = express.Router();
const { protect: authProtect } = require('../middleware/auth');
const { toggleShortlist: toggle, getShortlist: getList } = require('../controllers/connectionController');

shortlistRouter.get('/', authProtect, getList);
shortlistRouter.post('/:biodataId', authProtect, toggle);
shortlistRouter.delete('/:biodataId', authProtect, toggle);

module.exports = shortlistRouter;
