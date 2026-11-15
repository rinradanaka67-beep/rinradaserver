'use strict';

const fs   = require('fs').promises;
const path = require('path');

const DATA_ROOT = path.resolve(__dirname, '../../data');

class StaticJsonUtil {
  constructor() {
        this.cache = new Map();
    this.cacheEnabled = process.env.NODE_ENV === 'production';
  }

    _resolveSafePath(jsonPath) {
    const resolved = path.resolve(DATA_ROOT, jsonPath);
    if (!resolved.startsWith(DATA_ROOT + path.sep) && resolved !== DATA_ROOT) {
      throw new Error(`[StaticJson] Path traversal attempt blocked: "${jsonPath}"`);
    }
    return resolved;
  }

    serve(jsonPath) {
    return async (req, res) => {
      try {
        const data = await this.load(jsonPath);
        return res.json(data);
      } catch (error) {
        const statusCode = error.code === 'ENOENT' ? 404 : 500;
        return res.status(statusCode).json({
          status: 0,
          data: null,
          error: statusCode === 404 ? 'Resource not found' : 'Failed to load data',
        });
      }
    };
  }

    async load(jsonPath) {
    if (this.cacheEnabled && this.cache.has(jsonPath)) {
      return this.cache.get(jsonPath);
    }

    const fullPath = this._resolveSafePath(jsonPath);

    let fileContent;
    try {
      fileContent = await fs.readFile(fullPath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw Object.assign(new Error(`[StaticJson] File not found: "${jsonPath}"`), { code: 'ENOENT' });
      }
      throw err;
    }

    let data;
    try {
      data = JSON.parse(fileContent);
    } catch {
      throw new Error(`[StaticJson] Invalid JSON in file: "${jsonPath}"`);
    }

    if (this.cacheEnabled) {
      this.cache.set(jsonPath, data);
    }

    return data;
  }

    clearCache(jsonPath) {
    if (jsonPath) {
      this.cache.delete(jsonPath);
    } else {
      this.cache.clear();
    }
  }

    async reload(jsonPath) {
    this.cache.delete(jsonPath);
    return this.load(jsonPath);
  }
}

module.exports = new StaticJsonUtil();
