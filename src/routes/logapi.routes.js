'use strict';

const router = require('express').Router();
const misc = require('@controllers/misc.controller');

router.post('/add/ingame',        misc.addIngameLog);
router.post('/add/matchlog',      misc.addMatchLog);
router.post('/add/errorlog',      misc.addErrorLog);
router.post('/check/penalty',     misc.checkPenalty);
router.post('/check/serverdetect', misc.checkServerDetect);

module.exports = router;
