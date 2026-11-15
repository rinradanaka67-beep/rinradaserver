require('module-alias/register');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const config = require('@config/index');
const routes = require('@routes/index');
const Health = require('@src/Health');

const app = express();

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Express 5 leaves req.body undefined when a request has no (parsable) body; every handler
// destructures it, which used to end in a 500. Always give handlers an object.
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null || typeof req.body !== 'object') req.body = {};
  next();
});

// Log every request: method, path, status and (for errors) the message sent back.
app.use((req, res, next) => {
  const started = Date.now();
  const origJson = res.json.bind(res);
  let errMsg = null;
  res.json = (body) => {
    if (body && body.status === 0) errMsg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
    return origJson(body);
  };
  res.on('finish', () => {
    if (req.path === '/health') return;
    console.log(`[req] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - started}ms)` +
      (errMsg ? ` error="${errMsg}"` : ''));
  });
  next();
});

// --- HSHO Log API Routes ---

// 1. ตรวจสอบสถานะบทลงโทษ/แบนของผู้เล่น
app.post('/logapi/v1/check/penalty', (req, res) => {
    const gsid = req.body?.Player?.GSID || req.body?.GSID || req.body?.steamId || "";
    
    return res.status(200).json({
        data: {
            BanInSecond: 0,
            count: 243,
            GSID: gsid,
            PenaltyLevel: 0,
            UnbannedDateTime: "2026-09-27T15:37:20.557Z",
            UnBannedIn: 0
        },
        hasUnBannedIn: 0,
        message: "All transaction success",
        status: 1
    });
});

// 2. บันทึกประวัติการจับคู่/เข้าเล่นเกม
app.post('/logapi/v1/add/matchlog', (req, res) => {
    return res.status(200).json({
        data: null,
        error: null,
        status: 1
    });
});

// 3. ตรวจสอบสถานะเซิร์ฟเวอร์และผู้เล่นในระบบ
app.post('/logapi/v1/check/serverdetect', (req, res) => {
    const playerIds = req.body?.playerIds || [];
    const gsid = playerIds.length > 0 ? playerIds[0] : "";

    return res.status(200).json({
        data: {
            GSID: gsid
        },
        error: null,
        status: 1
    });
});

// --- Existing Routes & System Handlers ---

app.use('/', routes);
app.use('/', Health);

// Unknown routes: answer JSON like every other error (Express's default is an HTML page).
app.use((req, res) => res.status(404).json({ status: 0, data: null, error: 'Not found' }));

// Malformed JSON / oversized bodies used to return Express's HTML error page.
app.use((err, req, res, next) => {
  const status = err?.status || err?.statusCode || 500;
  if (status >= 500) console.error('[Server] Unhandled error:', err);
  const message = status === 400 ? 'Invalid request body' : status === 413 ? 'Request body too large' : 'Internal server error';
  return res.status(status >= 400 && status < 600 ? status : 500).json({ status: 0, data: null, error: message });
});

async function start() {
  try {
    await mongoose.mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName,
    });
    console.log(`MongoDB connected to: ${config.mongo.dbName}`);

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Environment: ${config.env}`);
    });
  } catch (err) {
    console.error('Startup error:', err.message);
    process.exit(1);
  }
}

async function shutdown() {
  try {
    await mongoose.connection.close();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err.message);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
