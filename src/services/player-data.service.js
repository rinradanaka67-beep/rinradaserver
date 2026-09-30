'use strict';

const Player     = require('@models/player.model');
const staticJson = require('@utils/static-json.util');

const DEFAULT_SKINS = Object.freeze({
  Hunter_Pray:          'Skin_Nymph_D_Default',
  Hunter_Prisoner:      'Skin_Prisoner_D_Default',
  Hunter_Belle:         'Skin_Belle_D_Default',
  Hunter_Rigger:        'Skin_Rigger_D_Default',
  Hunter_Garnet:        'Skin_Garnet_D_Default',
  Hunter_Werewolf:      'Skin_Nylcan_D_Default',
  Hunter_Chan:          'Skin_Chan_D_Default',
  Hunter_GrannyKham:    'Skin_GrannyKham_D_Default',
  Hunter_Saming:        'Skin_Saming_D_Default',
  Hunter_GrimFamily:    'Skin_GrimFamily_D_Default',
  Hunter_Verona:        'Skin_Verona_D_Default',
  Hunter_Kamiko:        'Skin_Kamiko_D_Default',
  Hunter_Charlotte:     'Skin_Charlotte_D_Default',
  Hunter_SilenceMan:    'Skin_SilenceMan_D_Default',
  Hunter_Ratri:         'Skin_Ratri_D_Default',
  Survivor_Security:    'Skin_SeGuard_D_Default',
  Survivor_Pang3P:      'Skin_Pang3P_D_Default',
  Survivor_StudentF:    'Skin_Student_D_Default',
  Survivor_Manop:       'Skin_Manop_D_Default',
  Survivor_Jane:        'Skin_Jane_D_Default',
  Survivor_Jean:        'Skin_Jean_D_Default',
  Survivor_Tim:         'Skin_Tim_D_Default',
  Survivor_Aof:         'Skin_Aof_D_Default',
  Survivor_Don:         'Skin_Don_D_Default',
  Survivor_Vanz:        'Skin_Vanz_D_Default',
  Survivor_JapanTouristF: 'Skin_TouristJap_D_Default',
  Survivor_Tida:        'Skin_Tida_D_Default',
  Survivor_Zico:        'Skin_Zico_D_Default',
  Survivor_Jessi:       'Skin_Jessi_D_Default',
  Survivor_ZBing:       'Skin_zBing_D_Default',
  Survivor_TimAwake:    'Skin_TimAwake_D_Default',
  Survivor_Aisha:       'Skin_Aisha_D_Default',
  Survivor_Stephen:     'Skin_Stephen_D_Default',
  Survivor_Gwyneth:     'Skin_Gwyneth_D_Default',
});

const DEFAULT_CURRENCIES = Object.freeze({ coin: 250_000, amethyst: 0, amulet: 0 });

const NAME_COOLDOWN_MS = 12 * 60 * 60 * 1_000;

class PlayerDataService {
  constructor() {
        this._basePlayerData = null;
  }

  async _getBasePlayerData() {
    if (!this._basePlayerData) {
      this._basePlayerData = await staticJson.load('static/player/auth.json');
    }
    return this._basePlayerData;
  }

  async _loadPlayerTemplate() {
    const raw = await staticJson.load('static/player/PlayerTemplate.json');
    return this._parseDates(raw);
  }

    _parseDates(value) {
    if (value === null || value === undefined) return value;
    if (Array.isArray(value))                  return value.map((v) => this._parseDates(v));
    if (typeof value !== 'object')             return value;
    if (value.$date)                           return new Date(value.$date);
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, this._parseDates(v)])
    );
  }

  _assignDefaultSkinsToSlots(characterSlot = {}, inventory = {}) {
    const requiredSkins = new Set();

    for (const slotType of ['hunterSlot', 'survivorSlot']) {
      for (const slot of characterSlot[slotType] ?? []) {
        const defaultSkin = DEFAULT_SKINS[slot.character];
        if (!defaultSkin) continue;
        if (!slot.cosmetic_cloth || slot.cosmetic_cloth === 'None') {
          slot.cosmetic_cloth = defaultSkin;
        }
        requiredSkins.add(defaultSkin);
      }
    }

    inventory.skins = Array.isArray(inventory.skins) ? inventory.skins : [];
    for (const skin of requiredSkins) {
      if (!inventory.skins.includes(skin)) inventory.skins.push(skin);
    }

    return { characterSlot, inventory };
  }

  _ensureDefaultSkinsInInventory(inventory = {}) {
    inventory.skins = Array.isArray(inventory.skins) ? inventory.skins : [];
    for (const character of inventory.characters ?? []) {
      const skin = DEFAULT_SKINS[character];
      if (skin && !inventory.skins.includes(skin)) inventory.skins.push(skin);
    }
    return inventory;
  }

  _canUpdateName(lastNameUpdate) {
    if (!lastNameUpdate) return true;
    return Date.now() - new Date(lastNameUpdate).getTime() >= NAME_COOLDOWN_MS;
  }

  async getOrCreatePlayerData(steamId, steamName) {
    const existing = await Player.findOne({ steamId });
    if (existing) return this._syncDisplayName(existing, steamName);

    const template = await this._loadPlayerTemplate();
    const { characterSlot, inventory } = this._assignDefaultSkinsToSlots(
      template.characterSlot,
      template.inventory
    );
    this._ensureDefaultSkinsInInventory(inventory);

    const player = new Player({
      steamId,
      ...template,
      characterSlot,
      inventory,
      profile: {
        ...template.profile,
        displayName:    steamName,
        lastNameUpdate: new Date(),
        updatedAt:      new Date(),
      },
      isOnline:   true,
      lastOnline: new Date(),
    });

    await player.save();
    return player;
  }

  async _syncDisplayName(player, steamName) {
    if (
      player.profile.displayName !== steamName &&
      this._canUpdateName(player.profile.lastNameUpdate)
    ) {
      player.profile.displayName    = steamName;
      player.profile.lastNameUpdate = new Date();
      player.profile.updatedAt      = new Date();
      await player.save();
    }
    return player;
  }

  async updatePlayerSession(player, steamId, sessionToken) {
    player.session_token = sessionToken;
    player.auth = [{
      authType: 'STEAM',
      extId:    steamId,
      extraInfo: {
        microTxn: { state: '', country: '', currency: '', status: 'Active' },
      },
      authAt: new Date(),
    }];
    player.isOnline   = true;
    player.lastOnline = new Date();
    await player.save();
    return player;
  }

  checkBanStatus(player) {
    if (player?.banStatus?.permanentBanned) {
      return { banned: true, reason: 'Account permanently banned' };
    }
    const bannedUntil = player?.banStatus?.bannedUntil
      ? new Date(player.banStatus.bannedUntil)
      : null;
    if (bannedUntil && bannedUntil > new Date()) {
      return { banned: true, reason: `Account banned until ${bannedUntil.toISOString()}` };
    }
    return { banned: false };
  }

  _buildCharacterSlotResponse(player) {
    const owned         = player.inventory?.characters ?? [];
    const filterOwned   = (slots = []) =>
      slots.filter((s) => s.character === 'None' || owned.includes(s.character));
    const hunterSlots   = filterOwned(player.characterSlot?.hunterSlot);
    const survivorSlots = filterOwned(player.characterSlot?.survivorSlot);

    return {
      hunterSlot:          hunterSlots,
      survivorSlot:        survivorSlots,
      characterhunteritem: owned.includes(player.characterSlot?.characterhunteritem)
        ? player.characterSlot.characterhunteritem
        : hunterSlots[0]?.character ?? 'Hunter_Belle',
      characteritem: owned.includes(player.characterSlot?.characteritem)
        ? player.characterSlot.characteritem
        : survivorSlots[0]?.character ?? 'Survivor_Tim',
      updatedAt: (player.characterSlot?.updatedAt ?? new Date()).toISOString(),
    };
  }

  _convertInventoryToLegacy(inventory) {
    const result = { inventory: {} };
    if (!inventory) return result;

    const addItems = (arr, counts = null) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((item, i) => {
        if (item && item !== 'None') {
          result.inventory[item] = counts ? (counts[i] ?? 1) : 1;
        }
      });
    };

    [
      inventory.characters, inventory.skins,    inventory.perks,
      inventory.profiles,   inventory.stickers,  inventory.heads,
      inventory.backs,      inventory.costumes,  inventory.rituals,
      inventory.cosmeticconsume, inventory.bundles, inventory.poses,
      inventory.effects,
    ].forEach((arr) => addItems(arr));

    addItems(inventory.items, inventory.itemCounts);
    return result;
  }

    async prepareAuthResponse(player, displayName, sessionToken) {

    const response = structuredClone(await this._getBasePlayerData());
    const p        = response.data.player;

    p.characterSlot        = this._buildCharacterSlotResponse(player);
    p.role                 = player.role ?? 'survivor';
    p.session_token        = sessionToken;
    response.data.session_token = sessionToken;
    p.profile = {
      display:        player.profile?.display    ?? 'Profile_Default',
      displayName,
      lastNameUpdate: (player.profile?.lastNameUpdate ?? new Date()).toISOString(),
      updatedAt:      new Date().toISOString(),
    };
    p.inventory            = this._convertInventoryToLegacy(player.inventory);
    p.stickerSlot          = player.stickerSlot          ?? p.stickerSlot;
    p.coin                 = player.coin                  ?? DEFAULT_CURRENCIES.coin;
    p.amethyst             = player.amethyst              ?? DEFAULT_CURRENCIES.amethyst;
    p.amulet               = player.amulet                ?? DEFAULT_CURRENCIES.amulet;
    p.banStatus            = player.banStatus             ?? p.banStatus;
    p.playerRecord         = player.playerRecord          ?? p.playerRecord;
    p.playerRecordHunter   = player.playerRecordHunter    ?? p.playerRecordHunter;
    p.playerRecordSurvivor = player.playerRecordSurvivor  ?? p.playerRecordSurvivor;
    p.curseRelic           = player.curseRelic            ?? p.curseRelic;
    p.auth[0].authAt       = new Date().toISOString();
    p.auth[0].extId        = player.steamId;
    p.isOnline             = true;
    p.lastOnline           = new Date().toISOString();
    p._id                  = player.steamId;

    return response;
  }
}

module.exports = new PlayerDataService();
