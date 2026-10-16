require('module-alias/register');
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios'); // เพิ่มเข้ามาสำหรับเรียกใช้งาน Google Sheets API
const config = require('@config/index');
const routes = require('@routes/index');
const Health = require('@src/Health');

const app = express();
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// --- Google Sheets Whitelist Configuration ---
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxBjKv0EwQiY3oxVfi-0VSqqWit3BzB8ss1ek1Has3xZluQlSvQej2ov1Ad3gBV9N3mKw/exec'; // <-- เปลี่ยนตรงนี้เป็น URL ของ Google Apps Script

// ฟังก์ชันดึงรายชื่อ Whitelist จาก Google Sheets
async function fetchWhitelist() {
    try {
        const response = await axios.get(GOOGLE_SCRIPT_URL);
        return response.data; // ได้เป็น Array ของ SteamID64 หรือ GSID
    } catch (error) {
        console.error("ไม่สามารถดึงข้อมูลจาก Google Sheets ได้:", error.message);
        return [];
    }
}

// --- HSHO Log API Routes ---

// 1. ตรวจสอบสถานะบทลงโทษ/แบนของผู้เล่น (และดักเช็ค Whitelist Google Sheets ที่นี่)
app.post('/logapi/v1/check/penalty', async (req, res) => {
    const gsid = req.body?.Player?.GSID || req.body?.GSID || req.body?.steamId || "";
    
    // --- ระบบเช็ค Whitelist จาก Google Sheets ---
    if (gsid) {
        const whitelist = await fetchWhitelist();
        // เช็คว่ามี GSID / SteamID นี้อยู่ใน Google Sheets หรือไม่
        const isAllowed = whitelist.includes(gsid.toString().trim());

        if (!isAllowed) {
            // ถ้าไม่มีใน Google Sheets ให้ส่งสถานะแบน/บล็อก พร้อม ERROR CODE = 0 ตามที่คุณต้องการ
            returnstatus(200).json({
                data: {
                    BanInSecond: 999999, // ล็อคไว้ไม่ให้เข้า
                    count: 0,
                    GSID: gsid,
                    PenaltyLevel: 99,
                    UnbannedDateTime: "2099-12-31T23:59:59.557Z",
                    UnBannedIn: 999999
                },
                hasUnBannedIn: 1,
                message: "ERROR CODE = 0: คุณยังไม่ได้รับสิทธิ์เข้าเซิร์ฟเวอร์ กรุณาติดต่อแอดมิน",
                status: 0 // แจ้งสถานะว่าไม่ผ่าน
            });
        }
    }
    // ------------------------------------------

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
