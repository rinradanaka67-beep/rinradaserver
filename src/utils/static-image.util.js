'use strict';

const fs   = require('fs');
const fsp  = require('fs').promises;
const path = require('path');

const DATA_ROOT  = path.resolve(__dirname, '../../data');
const IMAGE_ROOT = path.resolve(DATA_ROOT, 'static/images');

const EXT_CONTENT_TYPE = Object.freeze({
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
});
const SUPPORTED_EXTS = Object.keys(EXT_CONTENT_TYPE);

class StaticImageUtil {
  constructor() {
    
    this.cache = new Map();
    this.cacheEnabled = process.env.NODE_ENV === 'production';
  }

    _sanitizeKey(key) {
    if (typeof key !== 'string' || !key.trim()) return null;
    if (!/^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$/.test(key)) return null;
    return key;
  }

    async _resolve(key) {
    const safeKey = this._sanitizeKey(key);
    if (!safeKey) return null;

    if (this.cacheEnabled && this.cache.has(safeKey)) {
      return this.cache.get(safeKey);
    }

    const hasExt = path.extname(safeKey).toLowerCase();
    const candidates = hasExt && EXT_CONTENT_TYPE[hasExt]
      ? [safeKey]
      : SUPPORTED_EXTS.map((ext) => `${safeKey}${ext}`);

    for (const filename of candidates) {
      const fullPath = path.resolve(IMAGE_ROOT, filename);
      
      if (!fullPath.startsWith(IMAGE_ROOT + path.sep)) continue;

      try {
        await fsp.access(fullPath, fs.constants.R_OK);
        const result = { fullPath, contentType: EXT_CONTENT_TYPE[path.extname(fullPath).toLowerCase()] };
        if (this.cacheEnabled) this.cache.set(safeKey, result);
        return result;
      } catch {
        
      }
    }

    return null;
  }

    serve(key) {
    return async (req, res) => {
      const found = await this._resolve(key);
      if (!found) {
        return res.status(404).json({ status: 0, data: null, error: 'Image not found' });
      }
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.sendFile(found.fullPath, {
        headers: { 'Content-Type': found.contentType },
      });
    };
  }

    serveByParam(paramName = 'key') {
    return async (req, res) => {
      const key = req.params[paramName];
      const found = await this._resolve(key);
      if (!found) {
        return res.status(404).json({ status: 0, data: null, error: 'Image not found' });
      }
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.sendFile(found.fullPath, {
        headers: { 'Content-Type': found.contentType },
      });
    };
  }

  clearCache(key) {
    if (key) this.cache.delete(key);
    else this.cache.clear();
  }
}

module.exports = new StaticImageUtil();
