'use strict';
const Player = require('@models/player.model');
const staticJson = require('@utils/static-json.util');
const inventoryService = require('@services/inventory.service');

const RARITY_WEIGHTS = Object.freeze({ '1': 70, '2': 20, '3': 7, '4': 2, '5': 1 });
const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
const LOOT_BOX_FILE_MAP = Object.freeze({
  Default_Gacha: { pot: 'static/pots/greedy.json', banner: 'static/gacha/banner_greedy.json' },
  Bullet_Gacha: { pot: 'static/pots/bullet.json', banner: 'static/gacha/banner_bullet.json' },
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
  const source = pool.length ? pool : items;
  return source[Math.floor(Math.random() * source.length)];
}

exports.OpenLootBox = async (req, res) => {
  const playerId = req.player?._id;
  if (!playerId) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
  try {
    const { loot_box_short_code, amount } = req.body ?? {};
    const parsedAmount = Number.parseInt(amount, 10);
    if (!loot_box_short_code || !Number.isInteger(parsedAmount) || parsedAmount < 1 || parsedAmount > 100) {
      return res.status(400).json({ status: 'error', message: 'Invalid loot box or amount (1-100)' });
    }
    const config = LOOT_BOX_FILE_MAP[loot_box_short_code];
    if (!config) return res.status(400).json({ status: 'error', message: 'Invalid loot box type' });

    const [pot, banner] = await Promise.all([staticJson.load(config.pot), staticJson.load(config.banner)]);
    const items = pot?.data?.items ?? pot?.items ?? banner?.data?.items ?? [];
    const cost = banner?.data?.cost;
    if (!items.length || !cost?.short_code || !Number.isFinite(Number(cost.amount)) || Number(cost.amount) < 0) {
      return res.status(503).json({ status: 'error', message: 'Loot box is not configured correctly' });
    }
    const currencyField = cost.short_code === 'coin' ? 'coin' : cost.short_code === 'amethyst' ? 'amethyst' : null;
    if (!currencyField) return res.status(503).json({ status: 'error', message: 'Unsupported gacha currency' });
    const totalCost = Number(cost.amount) * parsedAmount;
    const debited = await Player.findOneAndUpdate(
      { _id: playerId, [currencyField]: { $gte: totalCost } },
      { $inc: { [currencyField]: -totalCost } },
      { new: true }
    );
    if (!debited) return res.status(409).json({ status: 'error', message: `Insufficient ${cost.short_code}` });

    const player = debited;
    const lootdrops = [];
    const newlyGranted = [];
    let greedyPity = Number(player.greedyPity) || 0;
    const legendaryPool = items.filter((item) => String(item.rarity) === '5');
    if (loot_box_short_code === 'Default_Gacha' && legendaryPool.length === 0) {
      await Player.updateOne({ _id: playerId }, { $inc: { [currencyField]: totalCost } });
      return res.status(503).json({ status: 'error', message: 'Greedy Pot has no Legendary rewards configured' });
    }
    const grantedThisPull = new Set();
    let duplicateCoin = 0;
    try {
      for (let i = 0; i < parsedAmount; i++) {
        const guaranteedLegendary = loot_box_short_code === 'Default_Gacha' && greedyPity >= 49;
        const selected = guaranteedLegendary
          ? legendaryPool[Math.floor(Math.random() * legendaryPool.length)]
          : pickItemByRarity(items, selectRandomRarity());
        if (!selected?.short_code) throw new Error('Invalid item in loot box configuration');
        const duplicate = inventoryService.playerOwnsItem(player, selected.short_code) || grantedThisPull.has(selected.short_code);
        if (!duplicate) {
          await inventoryService.addItemToInventory(player, selected.short_code, Number(selected.amount) || 1);
          newlyGranted.push(selected.short_code);
          grantedThisPull.add(selected.short_code);
        } else if (selected.duplicate_exchange?.enable) {
          const exchange = selected.duplicate_exchange;
          if (exchange.type === 'currency' && exchange.short_code === 'coin') duplicateCoin += Number(exchange.amount) || 0;
          else if (exchange.short_code && exchange.type !== 'currency') await inventoryService.addItemToInventory(player, exchange.short_code, Number(exchange.amount) || 1);
        }
        if (loot_box_short_code === 'Default_Gacha') {
          greedyPity = String(selected.rarity) === '5' ? 0 : greedyPity + 1;
        }
        lootdrops.push({
          short_code: selected.short_code,
          name: selected.name,
          type: selected.type,
          rarity: selected.rarity,
          amount: Number(selected.amount) || 1,
          duplicate_exchange: selected.duplicate_exchange ?? null,
          is_dup: duplicate,
        });
      }
      if (duplicateCoin > 0) await Player.updateOne({ _id: playerId }, { $inc: { coin: duplicateCoin } });
      if (loot_box_short_code === 'Default_Gacha') {
        await Player.updateOne({ _id: playerId }, { $set: { greedyPity } });
      }
    } catch (grantError) {
      for (const itemId of newlyGranted.reverse()) {
        try { await inventoryService.removeItemFromInventory(player, itemId); } catch (_) { /* report original error */ }
      }
      await Player.updateOne({ _id: playerId }, { $inc: { [currencyField]: totalCost } });
      throw grantError;
    }

    const latest = await Player.findById(playerId).select('coin amethyst').lean();
    return res.status(200).json({
      status: 'success',
      data: {
        loot_box_type_str: loot_box_short_code,
        loot_box_amount: parsedAmount,
        cost: { currency: cost.short_code, amount: totalCost },
        balance: latest,
        lootdrops,
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Failed to open loot box', debug: process.env.NODE_ENV === 'production' ? undefined : error.message });
  }
};
