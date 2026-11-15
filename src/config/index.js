'use strict';

const REQUIRED = ['MONGO_URI', 'MONGO_DB_NAME', 'JWT_SECRET'];
const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length > 0) {
  throw new Error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
}

const WEAK_SECRETS = ['very-good-key', 'secret', 'changeme', 'c6fcbf11479b44007e6129b'];
if (WEAK_SECRETS.includes(process.env.JWT_SECRET)) {
  console.warn('[Config] JWT_SECRET is a well-known weak value — anyone can forge session tokens. Change it.');
}

if (!process.env.STEAM_API_KEY) {
  console.warn('[Config] STEAM_API_KEY is not set: Steam tickets are read locally and NOT verified with Steam. ' +
    'Fine for a private server with friends; set the key before opening it to the public.');
}

module.exports = {
  env: process.env.NODE_ENV || 'development',

  port: parseInt(process.env.PORT || process.env.API_PORT || '3000', 10),

  version: process.env.VERSION || 'prod',

  // By default any client version is accepted (and echoed back as the server version).
  // Set ENFORCE_CLIENT_VERSION=true to require clientversion === serverVersion (default 1.0.6.0).
  enforceVersion: String(process.env.ENFORCE_CLIENT_VERSION || '').toLowerCase() === 'true',

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
