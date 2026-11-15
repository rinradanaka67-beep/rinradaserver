'use strict';

const staticJson = require('@utils/static-json.util');

const TAG_MAPPINGS = Object.freeze([
  { tags: ['character', 'survivor'].sort(), file: 'static/store/taglist/C_Survivor.json' },
  { tags: ['perksurvivor'],                 file: 'static/store/taglist/P_Survivor.json' },
  { tags: ['effect', 'hunter'].sort(),      file: 'static/store/taglist/Effect_Hunter.json' },
  { tags: ['perkhunter'],                   file: 'static/store/taglist/P_Hunter.json' },
  { tags: ['character', 'hunter'].sort(),   file: 'static/store/taglist/C_Hunter.json' },
]);

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;

  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

exports.Taglist = async (req, res) => {
  try {
    const { tags } = req.body;

    if (!Array.isArray(tags) || tags.length === 0) {
      return res.status(400).json({ error: 'Invalid request', message: 'tags must be a non-empty array' });
    }

    const mapping = TAG_MAPPINGS.find((m) => arraysEqual(m.tags, tags));
    if (!mapping) {
      return res.status(404).json({
        error:   'No matching data found',
        message: `No data file found for tags: ${tags.join(', ')}`,
      });
    }

    const data = await staticJson.load(mapping.file);
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
};
