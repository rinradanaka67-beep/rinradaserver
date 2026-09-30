'use strict';

const MAX_RETRIES = 3;

async function saveWithRetry(doc, applyChanges, maxRetries = MAX_RETRIES) {
  const Model = doc.constructor;
  let current = doc;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    await applyChanges(current);
    try {
      await current.save();
      return current;
    } catch (err) {
      const isVersionConflict = err.name === 'VersionError';
      if (!isVersionConflict || attempt === maxRetries) throw err;

      const fresh = await Model.findById(doc._id);
      if (!fresh) throw err;
      current = fresh;
    }
  }
}

module.exports = { saveWithRetry };
