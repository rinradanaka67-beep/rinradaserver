'use strict';

const router = require('express').Router();
const misc = require('@controllers/misc.controller');
const { verifySession } = require('@middleware/auth.middleware');

router.post('/treasure/api/progress/get', verifySession, misc.getTreasureProgress);
router.post('/mailbox/get',               verifySession, misc.getMailbox);
router.get('/gacha/static/api/banner',    misc.getGachaBanner);
router.post('/ogilvy/genqr',              verifySession, misc.genQr);
router.post('/exprk/api/table',           misc.getExpRankTable);

router.get('/banner/:key',                misc.getBannerImage);

module.exports = router;
