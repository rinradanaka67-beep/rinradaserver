'use strict';

const REQUIRED = ['MONGO_URI', 'MONGO_DB_NAME', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
}

const WEAK_SECRETS = ['very-good-key', 'secret', 'changeme', 'c6fcbf11479b44007e6129b'];
if (WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
}

module.exports = {
  env: process.env.NODE_ENV || 'development',

  port: parseInt(process.env.PORT || process.env.API_PORT || '3000', 10),

  version: process.env.VERSION || 'prod',

  developers: process.env.DEVELOPERS
    ? process.env.DEVELOPERS.split(',').map((id) => id.trim()).filter(Boolean)
    : [],

  mongo: {
    uri:    process.env.MONGO_URI,
    dbName: process.env.MONGO_DB_NAME,
  },

  jwt: {

    secret:        process.env.JWT_SECRET,
    sessionExpiry: '24h',
  },

  steam: {
    apiKey: process.env.STEAM_API_KEY || null,
    appId:  parseInt(process.env.STEAM_APP_ID || '2334220', 10),
  },

  cors: {
    allowedOrigins: [
      'http://localhost:3000',
      'https://api.homesweethomegame.com',
    ],
  },

  server: {
    version: '1.0.0',
  },
};
