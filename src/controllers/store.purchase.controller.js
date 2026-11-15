'use strict';

const Player = require('@models/player.model');
const inventoryService = require('@services/inventory.service');
const staticJson = require('@utils/static-json.util');
const { sendError, sendSuccess } = require('@utils/response.util');

const CURRENCY_FIELDS = Object.freeze({ 1: 'coin', 2: 'amethyst', 4: 'amulet' });

function getListingId(body = {}) {
  return body.productListingId || body.productListingID || body.product_listing_id || body.productId || body.product_id || body._id || body.id;
}

exports.purchase = async (req, res) => {
  const playerId = req.player?._id;
  if (!playerId) return sendError(res, 401, 'Unauthorized');

  let debitedCurrency = null;
  let debitedAmount = 0;
  try {
    const listingId = getListingId(req.body);
    const quantity = Number.parseInt(req.body?.quantity ?? req.body?.amount ?? 1, 10);
    const priceIndex = Number.parseInt(req.body?.selectedPriceTagIndex ?? 0, 10);
    if (!listingId || !Number.isInteger(quantity) || quantity < 1 || quantity > 20 || !Number.isInteger(priceIndex) || priceIndex < 0) {
      return sendError(res, 400, 'Invalid product or quantity');
    }

    const catalog = await staticJson.load('static/store/P_List.json');
    const listings = catalog?.data?.productListing;
    const listing = Array.isArray(listings) ? listings.find((p) => p._id === String(listingId) || p.shortCode === String(listingId)) : null;
    if (!listing || listing.isActive === false) return sendError(res, 404, 'Product not found or inactive');

    if (Number.isInteger(listing.maxQuantityPerUser) && listing.maxQuantityPerUser > 0 && quantity > listing.maxQuantityPerUser) {
      return sendError(res, 400, `Maximum quantity per purchase is ${listing.maxQuantityPerUser}`);
    }
    const priceTag = listing.priceTags?.[priceIndex];
    const currencyField = CURRENCY_FIELDS[Number(priceTag?.currencyType)];
    const unitPrice = Number(priceTag?.price);
    if (!currencyField || !Number.isSafeInteger(unitPrice) || unitPrice < 0) {
      return sendError(res, 400, 'Unsupported product currency or price');
    }
    if (!Array.isArray(listing.itemsInBundle) || listing.itemsInBundle.length === 0) {
      return sendError(res, 400, 'Product has no deliverable items');
    }
    if (listing.itemsInBundle.some((entry) => String(entry?.shortCode || '').startsWith('Relic_')) &&
        Array.isArray(req.player.curseRelic) && listing.itemsInBundle.some((entry) => req.player.curseRelic.some((r) => r.ShortCode === entry.shortCode))) {
      return res.status(409).json({ status: 0, data: null, error: 'Item already owned' });
    }
    const totalPrice = unitPrice * quantity;
    if (!Number.isSafeInteger(totalPrice)) return sendError(res, 400, 'Invalid total price');

    const debited = await Player.findOneAndUpdate(
      { _id: playerId, [currencyField]: { $gte: totalPrice } },
      { $inc: { [currencyField]: -totalPrice } },
      { new: true }
    );
    if (!debited) {
      const current = await Player.findById(playerId).select(currencyField).lean();
      return res.status(409).json({ status: 0, data: { currency: currencyField, required: totalPrice, balance: Number(current?.[currencyField]) || 0 }, error: 'Insufficient funds' });
    }
    debitedCurrency = currencyField;
    debitedAmount = totalPrice;

    const player = debited;
    const granted = [];
    try {
      for (const entry of listing.itemsInBundle) {
        const itemId = entry?.shortCode;
        const itemAmount = Number(entry?.amount ?? 1) * quantity;
        if (typeof itemId !== 'string' || !itemId || !Number.isInteger(itemAmount) || itemAmount < 1) {
          throw new Error('Invalid item in product bundle');
        }
        // Relics are stored in the dedicated curseRelic field used by this API.
        if (itemId.startsWith('Relic_')) {
          const fresh = await Player.findById(playerId);
          const currentRelics = Array.isArray(fresh?.curseRelic) ? fresh.curseRelic : [];
          const existing = currentRelics.find((r) => r.ShortCode === itemId);
          if (!existing) {
            currentRelics.push({ ShortCode: itemId, Level: 1, MaxDurability: 20, CurrentDurability: 20 });
            fresh.curseRelic = currentRelics;
            fresh.markModified('curseRelic');
            await fresh.save();
          }
        } else {
          for (let i = 0; i < itemAmount; i++) await inventoryService.addItemToInventory(player, itemId, 1);
        }
        granted.push({ shortCode: itemId, amount: itemAmount });
      }
    } catch (grantError) {
      await Player.updateOne({ _id: playerId }, { $inc: { [currencyField]: totalPrice } });
      debitedCurrency = null;
      throw grantError;
    }

    const latest = await Player.findById(playerId).select('coin amethyst amulet').lean();
    return sendSuccess(res, {
      purchased: true,
      productListingId: listing._id,
      shortCode: listing.shortCode,
      quantity,
      currency: currencyField,
      price: totalPrice,
      granted,
      currentCurrency: { coin: latest?.coin ?? 0, amethyst: latest?.amethyst ?? 0, amulet: latest?.amulet ?? 0 },
    });
  } catch (err) {
    if (debitedCurrency && debitedAmount > 0) {
      try { await Player.updateOne({ _id: playerId }, { $inc: { [debitedCurrency]: debitedAmount } }); } catch (_) { /* preserve original error */ }
    }
    console.error('[StorePurchase] Purchase failed:', err);
    return sendError(res, 500, 'Purchase failed');
  }
};
