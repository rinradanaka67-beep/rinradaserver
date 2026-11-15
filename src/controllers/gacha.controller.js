'use strict';
const Player = require('@models/player.model');
const staticJson = require('@utils/static-json.util');
const inventoryService = require('@services/inventory.service');

const RARITY_WEIGHTS = Object.freeze({ '1': 70, '2': 20, '3': 7, '4': 2, '5': 1 });
const TOTAL_WEIGHT = Object.values(RARITY_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
const LOOT_BOX_FILE_MAP = Object.freeze({
  Default_Gacha: { pot: 'static/pots/greedy.json', banner: 'static/gacha/banner_greedy.json', potField: 'lootBoxAmount', bannerId: 'greedy' },
  Bullet_Gacha: { pot: 'static/pots/bullet.json', banner: 'static/gacha/banner_bullet.json', potField: 'bulletAmount', bannerId: 'bullet' },
});

// Use the reward type supplied by the official pot table. Cosmetic rewards are
// stored in the legacy costumes array, which Authen serializes back to the client.
const TYPE_CATEGORY = Object.freeze({
  skin: 'skins', back: 'backs', head: 'heads', sticker: 'stickers',
  pose: 'poses', ritual: 'rituals', effect: 'effects', cosmetic: 'costumes',
  character: 'characters', perk: 'perks', profile: 'profiles', bundle: 'bundles',
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
function categoryForReward(item) {
  const type = String(item?.type || '').toLowerCase();
  return TYPE_CATEGORY[type] || inventoryService.resolveInventoryCategory(item?.short_code || '');
}
function ownsReward(inventory, curseRelic, itemId) {
  // playerOwnsItem checks every inventory category (and relics), so an item bought in the
  // store under another category is still seen as owned here.
  return inventoryService.playerOwnsItem({ inventory, curseRelic }, itemId);
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

    const [pot, banner] = await Promise.all([staticJson.load(config.pot), staticJson.load(`static/gacha/banner_${config.bannerId}.json`)]);
    const items = pot?.data?.items ?? pot?.items;
    const bannerData = banner?.data ?? banner;
    const bannerItems = bannerData?.items;
    const potCodes = Array.isArray(items) ? items.map((x) => x?.short_code).filter(Boolean).sort() : [];
    const bannerCodes = Array.isArray(bannerItems) ? bannerItems.map((x) => x?.short_code).filter(Boolean).sort() : [];
    if (!Array.isArray(items) || !items.length || bannerData?.banner_id !== config.bannerId ||
        potCodes.length !== bannerCodes.length || potCodes.some((code, i) => code !== bannerCodes[i])) {
      return res.status(503).json({ status: 'error', message: 'Loot box reward table does not match its banner' });
    }

    const validItems = items.filter((item) => item && typeof item.short_code === 'string' &&
      item.short_code.length > 0 && ['1', '2', '3', '4', '5'].includes(String(item.rarity)));
    if (!validItems.length) return res.status(503).json({ status: 'error', message: 'Loot box has no valid rewards' });
    const legendaryPool = validItems.filter((item) => String(item.rarity) === '5');
    if (loot_box_short_code === 'Default_Gacha' && !legendaryPool.length) {
      return res.status(503).json({ status: 'error', message: 'Greedy Pot has no Legendary rewards configured' });
    }

    // Read current persisted Authen player data, not the possibly stale req.player copy.
    const current = await Player.findById(playerId).lean();
    if (!current) return res.status(401).json({ status: 'error', message: 'Player not found' });
    const currentInventory = current.inventory || {};
    const available = Number(currentInventory[config.potField]) || 0;
    if (available < parsedAmount) {
      return res.status(409).json({ status: 'error', message: 'Not enough Pots', required: parsedAmount, available });
    }

    let pity = Number(current.greedyPity) || 0;
    let duplicateCoin = 0;
    const ownedThisPull = new Set();
    const additions = new Map();
    const itemAdds = new Map(); // short_code -> count for inventory.items / itemCounts
    const lootdrops = [];

    const addReward = (itemId, category, count = 1) => {
      if (itemId.startsWith('Relic_') || itemId.startsWith('Curse_')) return;
      if (category === 'items') {
        itemAdds.set(itemId, (itemAdds.get(itemId) || 0) + count);
      } else {
        if (!additions.has(category)) additions.set(category, new Set());
        additions.get(category).add(itemId);
      }
      ownedThisPull.add(itemId);
    };

    for (let i = 0; i < parsedAmount; i++) {
      const guaranteedLegendary = loot_box_short_code === 'Default_Gacha' && pity >= 49;
      const selected = guaranteedLegendary
        ? legendaryPool[Math.floor(Math.random() * legendaryPool.length)]
        : pickItemByRarity(validItems, selectRandomRarity());
      if (!selected?.short_code) throw new Error('Invalid item in loot box configuration');

      const category = categoryForReward(selected);
      const duplicate = ownsReward(currentInventory, current.curseRelic, selected.short_code) || ownedThisPull.has(selected.short_code);
      if (!duplicate) {
        addReward(selected.short_code, category, Number(selected.amount) || 1);
      } else if (selected.duplicate_exchange?.enable) {
        const exchange = selected.duplicate_exchange;
        const exchangeAmount = Number(exchange.amount) || 0;
        if (exchange.type === 'currency' && exchange.short_code === 'coin') {
          duplicateCoin += exchangeAmount;
        } else if (exchange.type === 'currency' && exchange.short_code) {
          // Other currencies (the Bullet Pot pays "token") are kept as a counted item so
          // /authen returns the balance; before, only one "token" was ever granted.
          if (exchangeAmount > 0) itemAdds.set(exchange.short_code, (itemAdds.get(exchange.short_code) || 0) + exchangeAmount);
        } else if (exchange.short_code) {
          const exchangeCategory = inventoryService.resolveInventoryCategory(exchange.short_code);
          if (!ownsReward(currentInventory, current.curseRelic, exchange.short_code)) {
            addReward(exchange.short_code, exchangeCategory);
          }
        }
      }

      if (loot_box_short_code === 'Default_Gacha') pity = String(selected.rarity) === '5' ? 0 : pity + 1;
      lootdrops.push({
        short_code: selected.short_code, name: selected.name, type: selected.type,
        rarity: selected.rarity, amount: Number(selected.amount) || 1,
        duplicate_exchange: selected.duplicate_exchange ?? null, is_dup: duplicate,
      });
    }

    // Persist reward ownership, pot consumption, duplicate compensation and pity
    // in ONE MongoDB atomic update. This is the same Player document read by /authen.
    const update = { $inc: { [`inventory.${config.potField}`]: -parsedAmount }, $set: { lastOnline: new Date() } };
    if (duplicateCoin > 0) update.$inc.coin = duplicateCoin;
    if (loot_box_short_code === 'Default_Gacha') update.$set.greedyPity = pity;
    for (const [category, ids] of additions.entries()) {
      if (!ids.size) continue;
      update.$addToSet ||= {};
      update.$addToSet[`inventory.${category}`] = { $each: [...ids] };
    }
    if (itemAdds.size) {
      const items = Array.isArray(currentInventory.items) ? [...currentInventory.items] : [];
      const counts = Array.isArray(currentInventory.itemCounts) ? [...currentInventory.itemCounts] : [];
      while (counts.length < items.length) counts.push(1); // repair arrays that drifted apart
      counts.length = items.length;
      for (const [code, n] of itemAdds) {
        const idx = items.indexOf(code);
        if (idx > -1) counts[idx] = (Number(counts[idx]) || 0) + n;
        else { items.push(code); counts.push(n); }
      }
      update.$set['inventory.items'] = items;
      update.$set['inventory.itemCounts'] = counts;
    }
    const saved = await Player.findOneAndUpdate(
      { _id: playerId, [`inventory.${config.potField}`]: { $gte: parsedAmount } },
      update,
      { new: true, runValidators: true }
    ).lean();

    if (!saved) {
      const latest = await Player.findById(playerId).select(`inventory.${config.potField}`).lean();
      return res.status(409).json({ status: 'error', message: 'Not enough Pots', required: parsedAmount, available: Number(latest?.inventory?.[config.potField]) || 0 });
    }

    return res.status(200).json({
      status: 'success',
      data: {
        loot_box_type_str: loot_box_short_code,
        loot_box_amount: parsedAmount,
        cost: { currency: 'pot', amount: parsedAmount },
        balance: { coin: saved.coin ?? 0, amethyst: saved.amethyst ?? 0, amulet: saved.amulet ?? 0 },
        inventory: saved.inventory ?? {},
        curseRelic: saved.curseRelic ?? [],
        greedy_pity: Number(saved.greedyPity) || 0,
        pots_remaining: Number(saved.inventory?.[config.potField]) || 0,
        lootdrops,
        saved: true,
      },
    });
  } catch (error) {
    console.error('[Gacha] OpenLootBox failed:', error);
    return res.status(500).json({ status: 'error', message: 'Failed to open loot box', debug: process.env.NODE_ENV === 'production' ? undefined : error.message });
  }
};
