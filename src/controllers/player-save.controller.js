'use strict';

const { saveWithRetry } = require('@utils/save-retry.util');
const { sendError, sendSuccess } = require('@utils/response.util');

// Persist the authenticated player's complete server-side document.
// The client cannot choose another player's ID or overwrite currency/inventory.
exports.savePlayerData = async (req, res) => {
  try {
    if (!req.player) return sendError(res, 401, 'Unauthorized — invalid session');

    const saved = await saveWithRetry(req.player, async (doc) => {
      // Mongoose Mixed fields need explicit marking to guarantee persistence.
      for (const field of [
        'profile', 'characterSlot', 'banStatus', 'playerRecord',
        'playerRecordHunter', 'playerRecordSurvivor', 'curseRelic',
        'treasureProgress', 'stickerSlot', 'inventory', 'immortalData',
      ]) {
        doc.markModified(field);
      }
      doc.lastOnline = new Date();
      doc.isOnline = true;
    });

    return sendSuccess(res, {
      saved: true,
      savedAt: saved.updatedAt,
      currencies: {
        coin: saved.coin ?? 0,
        amethyst: saved.amethyst ?? 0,
        amulet: saved.amulet ?? 0,
      },
      inventory: {
        lootBoxAmount: saved.inventory?.lootBoxAmount ?? 0,
        bulletAmount: saved.inventory?.bulletAmount ?? 0,
      },
    });
  } catch (err) {
    console.error('[PlayerSave] Failed to save player data:', err);
    return sendError(res, 500, 'Could not save player data');
  }
};
