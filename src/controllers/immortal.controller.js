'use strict';

const Player = require('@models/player.model');

async function findPlayerById(playerId) {

  if (/^[a-f\d]{24}$/i.test(playerId)) {
    const byId = await Player.findById(playerId);
    if (byId) return byId;
  }
  return Player.findOne({ steamId: playerId });
}

const errorResponse = (res, status, error) =>
  res.status(status).json({ data: [], error });

exports.getImmortalPlayer = async (req, res) => {
  try {
    const player = req.player;
    if (!player) return errorResponse(res, 401, 'Unauthorized');

    const activeSkins = player.immortalData ?? [];

    const formattedData = activeSkins.map((skin) => ({
      skin_shortcode: skin.skin_shortcode,
      isActive:       skin.isActive,
      activity:       (skin.activity ?? []).map((act) => ({
        skin_activity:      act.skin_activity,
        goal:               act.goal,
        skin_quest_status:  act.skin_quest_status,
      })),
    }));

    return res.status(200).json({ data: formattedData, error: null });
  } catch (err) {
    return errorResponse(res, 500, 'Internal server error');
  }
};

exports.getImmortalPlayerMatch = async (req, res) => {
  try {
    const playerId = req.body?.player_id ?? req.query?.player_id;
    if (!playerId) return errorResponse(res, 400, 'player_id is required');

    const player = await findPlayerById(playerId);
    if (!player) return errorResponse(res, 404, 'Player not found');

    const immortalSkins = player.immortalData ?? [];
    const data = [{
      player_id:     player.steamId ?? player.auth?.[0]?.extId,
      immortal_data: immortalSkins.map((skin) => ({
        skin_shortcode: skin.skin_shortcode,
        activity:       (skin.activity ?? []).map((act) => ({
          skin_activity:     act.skin_activity,
          goal:              act.goal,
          skin_quest_status: act.skin_quest_status,
        })),
      })),
    }];

    return res.status(200).json({ data, error: null });
  } catch (err) {
    return errorResponse(res, 500, 'Internal server error');
  }
};

exports.updateImmortalPlayer = async (req, res) => {
  try {
    const { player_id, skin_shortcode, skin_quest_status, skin_activity } = req.body;

    if (!player_id) return errorResponse(res, 400, 'player_id is required');
    if (!skin_shortcode || skin_quest_status === undefined || !skin_activity) {
      return errorResponse(res, 400, 'Missing required fields: skin_shortcode, skin_quest_status, skin_activity');
    }

    const player = await findPlayerById(player_id);
    if (!player) return errorResponse(res, 404, 'Player not found');

    if (typeof skin_quest_status !== 'number') {
      return errorResponse(res, 400, 'skin_quest_status must be a number');
    }

    if (!Array.isArray(player.immortalData)) player.immortalData = [];

    const skinIdx = player.immortalData.findIndex((s) => s.skin_shortcode === skin_shortcode);

    if (skinIdx === -1) {
      player.immortalData.push({
        skin_shortcode,
        isActive: true,
        activity: [{ skin_activity, goal: 0, skin_quest_status }],
      });
    } else {
      const skin    = player.immortalData[skinIdx];
      const actIdx  = skin.activity.findIndex((a) => a.skin_activity === skin_activity);
      if (actIdx === -1) {
        skin.activity.push({ skin_activity, goal: 0, skin_quest_status });
      } else {
        skin.activity[actIdx].skin_quest_status = skin_quest_status;
      }
    }

    player.markModified('immortalData');
    await player.save();

    return res.status(200).json({
      data: {
        player_id:         player.steamId ?? player.auth?.[0]?.extId,
        skin_shortcode,
        skin_activity,
        skin_quest_status,
      },
      error: null,
    });
  } catch (err) {
    return errorResponse(res, 500, 'Internal server error');
  }
};
