'use strict';

const express = require('express');

const staticJson        = require('@utils/static-json.util');
const staticImage       = require('@utils/static-image.util');
const playerRoutes      = require('./player.routes');
const storeRoutes       = require('./store.routes');
const inventoryRoutes   = require('./inventory.routes');
const immortalRoutes    = require('./Immortal.routes');
const gameRoutes        = require('./game.routes');
const gachaRoutes       = require('./gacha.routes');
const miscRoutes        = require('./misc.routes');
const logapiRoutes      = require('./logapi.routes');
const misc              = require('@controllers/misc.controller');

const router = express.Router();

router.get('/', staticImage.serve('mainmenu_banner'));
router.use('/live/player',       playerRoutes);
router.use('/live/player',       inventoryRoutes);
router.use('/live',              gameRoutes);
router.use('/live',              storeRoutes);
router.use('/live',              immortalRoutes);
router.use('/live/lootboxgo',    gachaRoutes);
router.use('/live',              miscRoutes);
router.use('/logapi/v1',         logapiRoutes);

router.use('/live/immortal/get',            staticJson.serve('static/player/immortal.json'));
router.use('/live/player/curserelic/get',   staticJson.serve('static/player/curserelic.json'));

const LOOT_BOX_FILE_MAP = Object.freeze({
  Default_Gacha: 'static/pots/greedy.json',
  Bullet_Gacha:  'static/pots/bullet.json',
});

router.get('/live/lootboxgo/api/items', (req, res) => {
  const file = LOOT_BOX_FILE_MAP[req.query.loot_box_short_code];
  if (!file) {
    return res.status(404).json({ error: 'Loot box not found' });
  }
  return staticJson.serve(file)(req, res);
});

module.exports = router;
