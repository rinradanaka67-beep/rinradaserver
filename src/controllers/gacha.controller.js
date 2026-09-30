'use strict';

const staticJson         = require('@utils/static-json.util');
const inventoryService   = require('@services/inventory.service');

const RARITY_WEIGHTS = Object.freeze({
  '1': 70,
  '2': 20,
  '3':  7,
  '4':  2,
  '5':  1,
});

const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((s, w) => s + w, 0);

const LOOT_BOX_FILE_MAP = Object.freeze({
  Default_Gacha: 'static/pots/greedy.json',
  Bullet_Gacha:  'static/pots/bullet.json',
});

function selectRandomRarity() {
  let rand = Math.random() * TOTAL_WEIGHT;
  for (const [rarity, weight] of Object.entries(RARITY_WEIGHTS)) {
    rand -= weight;
    if (rand <= 0) return rarity;
  }
  return '1';
}

function pickItemByRarity(items, rarity) {
  const pool = items.filter((item) => String(item.rarity) === rarity);
  const src  = pool.length > 0 ? pool : items;
  return src[Math.floor(Math.random() * src.length)];
}

const isProd = process.env.NODE_ENV === 'production';

exports.OpenLootBox = async (req, res) => {
  try {
    const { loot_box_short_code, amount } = req.body;

    if (!loot_box_short_code) {
      return res.status(400).json({ status: 'error', message: 'loot_box_short_code is required' });
    }

    const parsedAmount = parseInt(amount, 10);
    if (!parsedAmount || parsedAmount < 1 || parsedAmount > 100) {
      return res.status(400).json({ status: 'error', message: 'amount must be between 1 and 100' });
    }

    const filePath = LOOT_BOX_FILE_MAP[loot_box_short_code];
    if (!filePath) {
      return res.status(400).json({ status: 'error', message: 'Invalid loot box type' });
    }

    const bannerData = await staticJson.load(filePath);
    const items = bannerData?.data?.items ?? bannerData?.items ?? [];

    if (items.length === 0) {
      return res.status(500).json({ status: 'error', message: 'Banner has no items configured' });
    }

    const lootdrops = [];
    const player    = req.player ?? null;
    const grantedThisPull = new Set();

    for (let i = 0; i < parsedAmount; i++) {
      const rarity       = selectRandomRarity();
      const selectedItem = pickItemByRarity(items, rarity);

      const isDuplicate = player
        ? (inventoryService.playerOwnsItem(player, selectedItem.short_code) || grantedThisPull.has(selectedItem.short_code))
        : false;

      if (!isDuplicate) grantedThisPull.add(selectedItem.short_code);

      lootdrops.push({
        short_code: selectedItem.short_code,
        name:       selectedItem.name,
        type:       selectedItem.type,
        rarity:     selectedItem.rarity,
        amount:     1,
        duplicate_exchange: selectedItem.duplicate_exchange ?? {
          enable:     true,
          short_code: 'coin',
          amount:     parseInt(selectedItem.rarity, 10) * 100,
          type:       'currency',
        },
        is_dup: isDuplicate,
      });
    }

    if (player) {
      for (const drop of lootdrops) {
        if (!drop.is_dup) {
          await inventoryService.addItemToInventory(player, drop.short_code, 1).catch((err) => {
          });
        }
      }
    }

    return res.status(200).json({
      status: 'success',
      data: {
        loot_box_type_str: loot_box_short_code,
        loot_box_amount:   parsedAmount,
        lootdrops,
      },
    });
  } catch (error) {

    if (error.code === 'ENOENT') {
      return res.status(404).json({ status: 'error', message: 'Loot box configuration not found' });
    }

    return res.status(500).json({
      status: 'error',
      message: 'Failed to open loot box',

      ...(isProd ? {} : { debug: error.message }),
    });
  }
};
