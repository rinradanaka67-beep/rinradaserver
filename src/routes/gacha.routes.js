'use strict';
const router = require('express').Router();
const gacha = require('@controllers/gacha.controller');
const { verifySession } = require('@middleware/auth.middleware');
router.post('/api/open', verifySession, gacha.OpenLootBox);
module.exports = router;
