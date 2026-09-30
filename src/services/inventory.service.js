'use strict';

const { saveWithRetry } = require('@utils/save-retry.util');

const OWNERSHIP_CATEGORIES = Object.freeze([
  'characters', 'skins', 'perks', 'profiles', 'stickers',
  'heads', 'backs', 'costumes', 'rituals', 'cosmeticconsume',
  'bundles', 'poses', 'effects', 'items',
]);

const CHARACTER_SKIN_MAP = Object.freeze({
  Hunter_Pray:             'Skin_Nymph_D_Default',
  Skin_Pray_D_Default:     'Skin_Nymph_D_Default',
  Hunter_Werewolf:         'Skin_Nylcan_D_Default',
  Skin_Werewolf_D_Default: 'Skin_Nylcan_D_Default',
  Survivor_Security:       'Skin_SeGuard_D_Default',
  Skin_Security_D_Default: 'Skin_SeGuard_D_Default',
  Survivor_StudentF:       'Skin_Student_D_Default',
  Skin_StudentF_D_Default: 'Skin_Student_D_Default',
  Survivor_JapanTouristF:  'Skin_TouristJap_D_Default',
  Skin_JapanTouristF_D_Default: 'Skin_TouristJap_D_Default',
});

const INVENTORY_DEFAULTS = Object.freeze({
  devAccount:      false,
  characters:      [],
  items:           [],
  itemCounts:      [],
  skins:           [],
  perks:           [],
  profiles:        [],
  stickers:        [],
  heads:           [],
  backs:           [],
  costumes:        [],
  rituals:         [],
  cosmeticconsume: [],
  bundles:         [],
  poses:           [],
  effects:         [],
  lootBoxAmount:   50,
  bulletAmount:    50,
});

const ITEM_CATEGORY_RULES = Object.freeze([
  { test: (id) => id.startsWith('Hunter_') || id.startsWith('Survivor_'),    category: 'characters' },
  { test: (id) => id.startsWith('Skin_'),                                     category: 'skins' },
  { test: (id) => id.startsWith('PP_'),                                       category: 'perks' },
  { test: (id) => id.startsWith('Profile_'),                                  category: 'profiles' },
  { test: (id) => id.startsWith('Sticker_'),                                  category: 'stickers' },
  { test: (id) => id.startsWith('Head_'),                                     category: 'heads' },
  { test: (id) => id.startsWith('Back_'),                                     category: 'backs' },
  { test: (id) => id.startsWith('Pose_'),                                     category: 'poses' },
  { test: (id) => id.startsWith('Bundle_'),                                   category: 'bundles' },
  { test: (id) => id.startsWith('FX_Warden_Transform_'),                     category: 'effects' },
  {
    test: (id) =>
      id.startsWith('Item_Ritual') || id.startsWith('Ritual_') || id.startsWith('Item_Sacrifice'),
    category: 'rituals',
  },
  {
    test: (id) =>
      id.startsWith('Item_')       || id.startsWith('HolyRice_')   ||
      id.startsWith('HolyWater_')  || id.startsWith('Holywater_')  ||
      id.startsWith('EnergyDrink_')|| id.startsWith('SacredThread_')||
      id.startsWith('Syringe_')    || id.startsWith('Error_'),
    category: 'cosmeticconsume',
  },
]);

const COSTUME_KEYWORDS = Object.freeze([
  '_Mask_', '_Puppet_', '_Scissors_', '_Cutter_', '_Armband_', '_Anklets_',
  '_Earring_', '_Earing_', '_Collar_', '_Belt_', '_Bracelet_', '_Necklace_',
  '_Gaiters_', '_KeyChain_', '_Chain_', '_Hook_', '_Katana_', '_Rapier_',
  '_Knife_', '_Pet_', '_Rabbit_', '_Sheep_', '_Deer_', '_Bag_',
  '_Keyboard_', '_KeyBoard_', '_Mic_',
]);

const HUNTER_COSMETIC_FIELDS  = ['cosmetic_hat', 'cosmetic_cloth', 'cosmetic_back', 'cosmetic_acc1', 'cosmetic_acc2', 'cosmetic_acc3'];
const SURVIVOR_COSMETIC_FIELDS = ['cosmetic_hat', 'cosmetic_cloth', 'cosmetic_back'];

class InventoryService {
    getInventoryState(player) {
    return {
      ...INVENTORY_DEFAULTS,
      ...(player.inventory ?? {}),
      coin:      player.coin      ?? 0,
      amethyst:  player.amethyst  ?? 0,
      amulet:    player.amulet    ?? 0,
    };
  }

    _getAliases(itemId) {
    const mapped = CHARACTER_SKIN_MAP[itemId];
    return mapped ? [itemId, mapped] : [itemId];
  }

    playerOwnsItem(player, itemId) {
    if (!itemId || itemId === 'None') return true;
    const inventory = this.getInventoryState(player);
    const aliases   = this._getAliases(itemId);
    return OWNERSHIP_CATEGORIES.some((cat) =>
      aliases.some((alias) => inventory[cat]?.includes(alias))
    );
  }

  async updatePlayerProfile(player, profileId) {
    if (!this.playerOwnsItem(player, profileId)) {
      throw new Error(`Profile not owned by player: ${profileId}`);
    }
    const saved = await saveWithRetry(player, (doc) => {
      doc.profile.display   = profileId;
      doc.profile.updatedAt = new Date();
    });
    return {
      display:     saved.profile.display,
      displayName: saved.profile.displayName,
      updatedAt:   saved.profile.updatedAt,
    };
  }

  _validateStickerData(stickerInfo) {
    const errors = [];
    if (stickerInfo.stickerpreset === undefined || stickerInfo.stickerpreset < 0 || stickerInfo.stickerpreset > 2) {
      errors.push('stickerpreset must be 0, 1, or 2');
    }
    if (!Array.isArray(stickerInfo.stickerSet) || stickerInfo.stickerSet.length !== 3) {
      errors.push('stickerSet must contain exactly 3 presets');
      return errors;
    }
    stickerInfo.stickerSet.forEach((preset, i) => {
      if (!Array.isArray(preset) || preset.length !== 8) {
        errors.push(`stickerSet[${i}] must contain exactly 8 stickers`);
      }
    });
    return errors;
  }

  async updatePlayerStickers(player, stickerInfo) {
    const errors = this._validateStickerData(stickerInfo);
    if (errors.length > 0) throw new Error(errors.join('; '));

    for (const preset of stickerInfo.stickerSet) {
      for (const sticker of preset) {
        if (!this.playerOwnsItem(player, sticker)) {
          throw new Error(`Sticker not owned: ${sticker}`);
        }
      }
    }

    const saved = await saveWithRetry(player, (doc) => {
      doc.stickerSlot.stickerpreset = stickerInfo.stickerpreset;
      doc.stickerSlot.stickerSet    = stickerInfo.stickerSet;
      doc.markModified('stickerSlot');
    });
    return {
      stickerpreset: saved.stickerSlot.stickerpreset,
      stickerSet:    saved.stickerSlot.stickerSet,
    };
  }

  getCharacterSlotData(player) {
    if (!player.characterSlot) return null;
    const owned = player.inventory?.characters ?? [];
    const filterOwned = (slots = []) =>
      slots.filter((s) => s.character === 'None' || owned.includes(s.character));

    return {
      hunterSlot:          filterOwned(player.characterSlot.hunterSlot),
      survivorSlot:        filterOwned(player.characterSlot.survivorSlot),
      characterhunteritem: owned.includes(player.characterSlot.characterhunteritem)
        ? player.characterSlot.characterhunteritem : 'Hunter_Belle',
      characteritem: owned.includes(player.characterSlot.characteritem)
        ? player.characterSlot.characteritem : 'Survivor_Tim',
    };
  }

  _collectSlotErrors(player, slots = [], label, cosmeticFields) {
    const errors = [];
    for (const slot of slots) {
      if (slot.character && slot.character !== 'None' && !this.playerOwnsItem(player, slot.character)) {
        errors.push(`${label} character not owned: ${slot.character}`);
      }
      for (const field of cosmeticFields) {
        const val = slot[field];
        if (val && val !== 'None' && !this.playerOwnsItem(player, val)) {
          errors.push(`Cosmetic not owned: ${val}`);
        }
      }
      for (const perk of slot.perkPassive ?? []) {
        if (perk && perk !== 'None' && !this.playerOwnsItem(player, perk)) {
          errors.push(`Perk not owned: ${perk}`);
        }
      }
    }
    return errors;
  }

  _validateCharacterSlot(player, slotData) {
    const errors = [
      ...this._collectSlotErrors(player, slotData.hunterSlot,   'Hunter',   HUNTER_COSMETIC_FIELDS),
      ...this._collectSlotErrors(player, slotData.survivorSlot, 'Survivor', SURVIVOR_COSMETIC_FIELDS),
    ];
    if (slotData.characterhunteritem && !this.playerOwnsItem(player, slotData.characterhunteritem)) {
      errors.push(`Hunter character not owned: ${slotData.characterhunteritem}`);
    }
    if (slotData.characteritem && !this.playerOwnsItem(player, slotData.characteritem)) {
      errors.push(`Survivor character not owned: ${slotData.characteritem}`);
    }
    return errors;
  }

  _sanitizeSlots(player, slotData) {
    const owned    = player.inventory?.characters ?? [];
    const filterFn = (slots) =>
      Array.isArray(slots)
        ? slots.filter((s) => s.character === 'None' || owned.includes(s.character))
        : slots;
    return {
      ...slotData,
      hunterSlot:   filterFn(slotData.hunterSlot),
      survivorSlot: filterFn(slotData.survivorSlot),
    };
  }

  async updateCharacterSlot(player, slotData, role) {
    const sanitized = this._sanitizeSlots(player, slotData);
    const errors    = this._validateCharacterSlot(player, sanitized);
    if (errors.length > 0) throw new Error(errors.join('; '));

    let changed = false;
    const applySlotChanges = (doc) => {
      for (const key of ['hunterSlot', 'survivorSlot', 'characterhunteritem', 'characteritem']) {
        if (sanitized[key] !== undefined) {
          doc.characterSlot[key] = sanitized[key];
          changed = true;
        }
      }
      if (role !== undefined && ['hunter', 'survivor'].includes(role)) {
        doc.role = role;
        changed = true;
      }
      if (changed) doc.markModified('characterSlot');
    };

    applySlotChanges(player);
    const saved = changed
      ? await saveWithRetry(player, applySlotChanges)
      : player;

    return { slots: this.getCharacterSlotData(saved), role: saved.role };
  }

  resolveInventoryCategory(itemId) {
    const rule = ITEM_CATEGORY_RULES.find((r) => r.test(itemId));
    if (rule) return rule.category;
    if (COSTUME_KEYWORDS.some((kw) => itemId.includes(kw))) return 'costumes';
    return 'items';
  }

  _ensureArrays(inventory) {
    for (const [key, val] of Object.entries(INVENTORY_DEFAULTS)) {
      if (Array.isArray(val) && !Array.isArray(inventory[key])) {
        inventory[key] = [];
      }
    }
  }

  async addItemToInventory(player, itemId, quantity = 1) {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('itemId must be a non-empty string');
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error('quantity must be a positive integer');
    }

    const category = this.resolveInventoryCategory(itemId);

    
    
    
    await saveWithRetry(player, (doc) => {
      const inventory = doc.inventory;
      this._ensureArrays(inventory);

      if (category === 'items') {
        const idx = inventory.items.indexOf(itemId);
        if (idx > -1) {
          inventory.itemCounts[idx] = (inventory.itemCounts[idx] ?? 0) + quantity;
        } else {
          inventory.items.push(itemId);
          inventory.itemCounts.push(quantity);
        }
      } else if (!inventory[category].includes(itemId)) {
        inventory[category].push(itemId);
      }

      doc.markModified('inventory');
    });

    return { success: true, itemId, quantity };
  }

  async removeItemFromInventory(player, itemId) {
    if (!itemId || typeof itemId !== 'string') {
      throw new Error('itemId must be a non-empty string');
    }

    let removed = false;

    await saveWithRetry(player, (doc) => {
      removed = false;
      const inventory = doc.inventory;
      for (const category of OWNERSHIP_CATEGORIES) {
        const idx = inventory[category]?.indexOf(itemId) ?? -1;
        if (idx < 0) continue;
        inventory[category].splice(idx, 1);
        if (category === 'items') inventory.itemCounts.splice(idx, 1);
        removed = true;
        break;
      }
      if (removed) doc.markModified('inventory');
    });

    return { success: removed, itemId };
  }
}

module.exports = new InventoryService();
