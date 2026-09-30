'use strict';

const express  = require('express');
const router   = express.Router();
const { verifySession } = require('@middleware/auth.middleware');
const Immortal = require('@controllers/immortal.controller');

router.post('/immortal/player/get',      verifySession, Immortal.getImmortalPlayer);
router.post('/immortal/player/getmatch', Immortal.getImmortalPlayerMatch);
router.post('/immortal/player/update',   verifySession, Immortal.updateImmortalPlayer);

module.exports = router;
