'use strict';
const router = require('express').Router();
const { verifySession } = require('@middleware/auth.middleware');
const controller = require('@controllers/matchmaking.controller');
router.post('/matchmaking/queue/join', verifySession, controller.join);
router.post('/matchmaking/queue/leave', verifySession, controller.leave);
router.post('/matchmaking/queue/status', verifySession, controller.status);
module.exports = router;
