'use strict';
const matchmaking = require('@services/matchmaking.service');
const { sendSuccess, sendError } = require('@utils/response.util');

exports.join = async (req, res) => {
  try { return sendSuccess(res, await matchmaking.join(req.player)); }
  catch (err) { return sendError(res, 500, err.message || 'Failed to join matchmaking'); }
};
exports.leave = async (req, res) => {
  try { return sendSuccess(res, await matchmaking.leave(req.player)); }
  catch (err) { return sendError(res, 500, err.message || 'Failed to leave matchmaking'); }
};
exports.status = async (req, res) => {
  try { return sendSuccess(res, await matchmaking.status(req.player)); }
  catch (err) { return sendError(res, 500, err.message || 'Failed to get matchmaking status'); }
};
