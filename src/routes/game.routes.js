const express = require('express');
const router = express.Router();

const game = require("@controllers/game.controller");

const { verifySession } = require('@middleware/auth.middleware');

router.post('/player/gameplay/checkversion', game.checkVersion);
router.post('/player/getban', game.getBan);
router.post('/player/gameplay/endgameresult', verifySession, game.endGameResult);

module.exports = router;