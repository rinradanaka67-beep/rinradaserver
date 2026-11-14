'use strict';

const inventoryService         = require('@services/inventory.service');
const { sendError, sendSuccess } = require('@utils/response.util');

function requirePlayer(req, res) {
  if (!req.player) {
    sendError(res, 401, 'Unauthorized — invalid session');
    return null;
  }
  return req.player;
}

function httpStatusFromError(message = '') {
  const clientErrors = ['not owned', 'not found', 'Invalid', 'must contain', 'required', 'must be'];
  return clientErrors.some((s) => message.includes(s)) ? 400 : 500;
}

exports.getInventoryAll = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    return sendSuccess(res, inventoryService.getInventoryState(player));
  } catch (err) {
    return sendError(res, 500, err.message || 'Server error');
  }
};

exports.getCharacterSlot = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    const slots = inventoryService.getCharacterSlotData(player);
    if (!slots) return sendError(res, 404, 'Character slot not found');
    return sendSuccess(res, { session_token: player.session_token, slots, role: player.role });
  } catch (err) {
    return sendError(res, 500, err.message || 'Server error');
  }
};

exports.editCharacterSlot = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    const { role, slots = {} } = req.body;
    const result = await inventoryService.updateCharacterSlot(player, slots, role);
    return sendSuccess(res, { session_token: player.session_token, ...result });
  } catch (err) {
    return sendError(res, httpStatusFromError(err.message), err.message || 'Server error');
  }
};

exports.editProfile = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    if (!req.body.profile) return sendError(res, 400, 'profile is required');
    const updated = await inventoryService.updatePlayerProfile(player, req.body.profile);
    return sendSuccess(res, { profile: updated, session_token: player.session_token });
  } catch (err) {
    return sendError(res, httpStatusFromError(err.message), err.message || 'Internal server error');
  }
};

exports.editSticker = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    if (!req.body.stickerInfo) return sendError(res, 400, 'stickerInfo is required');
    const updated = await inventoryService.updatePlayerStickers(player, req.body.stickerInfo);
    return sendSuccess(res, { stickerSlot: updated, session_token: player.session_token });
  } catch (err) {
    return sendError(res, httpStatusFromError(err.message), err.message || 'Internal server error');
  }
};

exports.addItem = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    const { itemId, quantity = 1 } = req.body;
    if (!itemId) return sendError(res, 400, 'itemId is required');
    const result = await inventoryService.addItemToInventory(player, itemId, quantity);
    return sendSuccess(res, { ...result, session_token: player.session_token });
  } catch (err) {
    return sendError(res, httpStatusFromError(err.message), err.message || 'Internal server error');
  }
};

exports.removeItem = async (req, res) => {
  try {
    const player = requirePlayer(req, res);
    if (!player) return;
    if (!req.body.itemId) return sendError(res, 400, 'itemId is required');
    const result = await inventoryService.removeItemFromInventory(player, req.body.itemId);
    return sendSuccess(res, { ...result, session_token: player.session_token });
  } catch (err) {
    return sendError(res, 500, err.message || 'Internal server error');
  }
};
