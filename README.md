# Home Sweet Home: Online — MalakorAPI (LITE)

*(English below — เลื่อนลงด้านล่างสำหรับภาษาไทย)*

This is a private backend server for **Home Sweet Home: Online**, built with **Node.js**, **Express**, and **MongoDB**. Basically it's a stand-in for the official game server — login, player data, inventory, store, gacha, immortal mode, all handled here — so you can run and connect to the game on your own server.

## What it does

- **Login with Steam** — checks the Steam ticket the game client sends over (can double-check it against real Steam if you give it a `STEAM_API_KEY`, otherwise it just parses it locally) and hands back a JWT token so the player stays logged in.
- **Player data, inventory & store** — makes a new save file the first time someone logs in, and has endpoints for managing characters, cosmetics, items, character slots, profile, stickers, plus the store listings.
- **Gacha / loot boxes** — opens loot boxes from whatever pools you've set up (like `Default_Gacha`, `Bullet_Gacha`) and gives the player whatever they get.
- **Immortal mode** — its own separate save/progress system with get/update/match endpoints.
- **Game log endpoints** — the game client likes to fire off log calls (ingame log, match log, error log, penalty check, etc). These just accept them and reply OK so the client doesn't throw errors — nothing gets saved anywhere.
- **Main menu banner** — one image file (`data/static/images/mainmenu_banner`) shown on the main menu. Swap it out to post announcements. **Heads up** — if you change it and it doesn't show up in-game, it's almost never a caching thing, see below.
- **End-of-match rewards** — when a match ends, the client sends a `roomId` and the server pays out rewards for it. Each `roomId` can only be claimed once, so people can't spam the endpoint for free rewards.
- **Barely any logging** — on purpose. It only logs "server started" and "someone logged in." No per-request logging, nothing saved for random/unmatched requests.

## What you need

- Node.js 18+
- A MongoDB database (local or hosted somewhere)

## Getting it running

1. Install everything:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and fill it in:

   ```bash
   cp .env.example .env
   ```

   | Variable         | What it's for                                    |
   |------------------|-------------------------------------------------|
   | `NODE_ENV`       | `development` or `production`                   |
   | `PORT`           | What port to run on (defaults to `3000`)      |
   | `MONGO_URI`      | Your MongoDB connection string                        |
   | `MONGO_DB_NAME`  | Which database to use                            |
   | `JWT_SECRET`     | Used to sign login tokens — **change this from any default/example value, don't just leave it** |
   | `STEAM_API_KEY`  | Optional — lets the server verify tickets with real Steam (how to get one below) |
   | `STEAM_APP_ID`   | This game's Steam App ID                       |
   | `VERSION`        | Version string shown to clients        |
   | `DEVELOPERS`     | Comma-separated SteamIDs of devs       |

3. Run it:

   ```bash
   npm start
   ```

   Or for dev (auto-restarts when you edit files):

   ```bash
   npm run dev
   ```

If it worked, you'll see:

```
[Server] Running on port 3000
```

And when someone logs in successfully:

```
[Auth] Player authenticated — <steamName> (<steamId>)
```

### Getting a Steam API Key

You don't *have* to have one — without it the server just parses tickets locally (works fine, just less verified). If you want the real deal:

1. Go to https://steamcommunity.com/dev/apikey and log in.
2. Type anything in **Domain Name** — it doesn't need to be a real website, just put your project name or whatever.
3. Hit **Register** and you'll get a key.
4. Paste it into `.env`:

   ```
   STEAM_API_KEY=paste_your_key_here
   ```

5. Restart the server.

**Don't** post your `STEAM_API_KEY` anywhere public (like pushing it to GitHub) — it's tied to your Steam account.

## Setting up server info in MongoDB

The version-check endpoint (`checkversion`) reads its answer from one document in a collection called **`serverinfo`**. If there's nothing there, it just uses built-in defaults — but you'll want to add your own so you can control the version and turn maintenance mode on/off.

Add a document like this to the `serverinfo` collection (using `mongosh`, Compass, Atlas, whatever you're comfortable with):

```json
{
  "correctversion": true,
  "serverVersion": "1.0.6.0",
  "ServerDevVersion": "0.0.0.1",
  "IsOnline": true,
  "IsDevOnline": false,
  "__v": 0
}
```

What each field means:

| Field              | Type    | What it does                                                  |
|--------------------|---------|-------------------------------------------------------------|
| `correctversion`   | Boolean | Just informational — the real check is against `serverVersion` |
| `serverVersion`    | String  | The version clients need to match to connect                |
| `ServerDevVersion` | String  | Internal/dev build version                                   |
| `IsOnline`         | Boolean | Set to `false` to show "under maintenance" to everyone         |
| `IsDevOnline`      | Boolean | Same idea, but for the dev server flag                        |
| `__v`              | Number  | Just leave this as `0`, it's a Mongoose thing                  |

You only need one document — the server just grabs whichever one it finds first.

## Project layout

```
src/
  config/        environment config
  controllers/    request handlers
  services/       the actual business logic
  models/         mongoose schemas
  middleware/      auth middleware
  routes/         express route definitions
  utils/          shared helper stuff (serving static files, formatting responses, etc.)
data/
  static/         JSON/image files the game client pulls from
```

## About the banner image

That `data/static/images/mainmenu_banner` image doubles as your announcement banner.

If you swap it out and it's still showing the old one in-game, **it's not a caching problem** on this server — check your **Launcher** first. The launcher has to point at this server's IP/host. If it's still pointing at an old one, the game will just keep grabbing the banner from wherever that old server is, no matter how many times you change the file here.

## A couple things worth knowing

- There's no matchmaking system here — the client just sends a `roomId` when a match ends, and that's what's used to pay out rewards.
- Logging is minimal on purpose (just server start + login success, nothing more).

## License / how you're allowed to use this

This was made by **Malakor**. If you're using it, just stick to these:

1. **Don't say it's yours.** Use the code, sure, but don't claim you made it or scrub the credit.
2. **Give credit.** Just mention **"Malakor"** somewhere — README, credits page, description, wherever.
3. **Don't re-post or share it.** Don't upload this code (or the whole repo) anywhere else — no other GitHub, forums, Discord, code marketplaces, file-share sites, nothing.
4. **Don't use it as a blueprint.** Don't copy the structure/logic to make a "new" API that's really just this one renamed.

If you're using this repo at all, you're agreeing to the above.

---

# Home Sweet Home: Online — MalakorAPI (LITE) (ภาษาไทย)

นี่คือ backend server ส่วนตัวสำหรับเกม **Home Sweet Home: Online** เขียนด้วย **Node.js**, **Express** และ **MongoDB** พูดง่ายๆ คือมันมาแทน server ของทางเกมเอง — login, ข้อมูลผู้เล่น, inventory, ร้านค้า, gacha, immortal mode ทำหมดในนี้ — เพื่อให้เล่นเกมผ่าน server ที่โฮสต์เองได้

## มันทำอะไรได้บ้าง

- **Login ด้วย Steam** — เช็ค Steam ticket ที่เกมส่งมา (จะให้เช็คกับ Steam จริงก็ได้ถ้าใส่ `STEAM_API_KEY` ไว้ ถ้าไม่ใส่ก็แปลง ticket แบบ local แทน) แล้วออก JWT token ให้ ผู้เล่นก็ล็อกอินค้างไว้ได้
- **ข้อมูลผู้เล่น, inventory, ร้านค้า** — สร้าง save file ให้อัตโนมัติตอน login ครั้งแรก มี endpoint จัดการตัวละคร, คอสตูม, ไอเทม, character slot, profile, sticker รวมถึงร้านค้าด้วย
- **Gacha / กล่องสุ่ม** — เปิดกล่องสุ่มจาก pool ที่ตั้งไว้ (เช่น `Default_Gacha`, `Bullet_Gacha`) แล้วให้ของที่สุ่มได้กับผู้เล่น
- **Immortal mode** — มีระบบ save/progress แยกของตัวเอง มี endpoint get/update/match แยกต่างหาก
- **Endpoint รับ log จากเกม** — ตัวเกมชอบยิง log มาเรื่อยๆ (ingame log, match log, error log, เช็ค penalty ฯลฯ) ตรงนี้แค่รับแล้วตอบ OK กลับไปเฉยๆ ไม่ให้เกม error ไม่ได้เก็บอะไรไว้จริงจัง
- **แบนเนอร์หน้าเมนูหลัก** — รูปเดียว (`data/static/images/mainmenu_banner`) ที่ขึ้นหน้าเมนูหลัก เปลี่ยนรูปได้เพื่อประกาศข่าว **ข้อควรรู้** — ถ้าเปลี่ยนแล้วในเกมไม่ขึ้น ปกติไม่ใช่ปัญหา cache นะ ดูด้านล่าง
- **รางวัลจบแมตช์** — จบแมตช์แล้ว client จะส่ง `roomId` มา แล้ว server จ่ายรางวัลตามนั้น แต่ละ `roomId` เคลมได้แค่ครั้งเดียว กันคนยิงซ้ำเอารางวัลฟรี
- **Log น้อยมาก** — ตั้งใจให้เป็นแบบนี้ จะ log แค่ "server เปิดแล้ว" กับ "มีคน login สำเร็จ" เท่านั้น ไม่ log ทุก request ไม่เก็บ request แปลกๆ ไว้

## ของที่ต้องมี

- Node.js 18 ขึ้นไป
- MongoDB สักตัว (รันในเครื่องหรือใช้ตัวออนไลน์ก็ได้)

## วิธีรัน

1. ติดตั้งของทั้งหมด:

   ```bash
   npm install
   ```

2. copy `.env.example` เป็น `.env` แล้วกรอกให้ครบ:

   ```bash
   cp .env.example .env
   ```

   | ตัวแปร           | ใช้ทำอะไร                                          |
   |------------------|-----------------------------------------------------|
   | `NODE_ENV`       | `development` หรือ `production`                     |
   | `PORT`           | จะรันที่พอร์ตไหน (ค่า default คือ `3000`)              |
   | `MONGO_URI`      | connection string ของ MongoDB                        |
   | `MONGO_DB_NAME`  | จะใช้ database ไหน                              |
   | `JWT_SECRET`     | ใช้เซ็น login token — **ต้องเปลี่ยนจากค่า default นะ อย่าปล่อยไว้เฉยๆ** |
   | `STEAM_API_KEY`  | ไม่บังคับ — ใส่แล้ว server จะเช็ค ticket กับ Steam จริง (วิธีขอดูด้านล่าง) |
   | `STEAM_APP_ID`   | Steam App ID ของเกมนี้                                |
   | `VERSION`        | เวอร์ชันที่จะโชว์ให้ client เห็น                  |
   | `DEVELOPERS`     | SteamID ของ dev คั่นด้วย comma            |

3. สั่งรัน:

   ```bash
   npm start
   ```

   หรือถ้าเป็นตอน dev (แก้โค้ดแล้ว auto-restart ให้เอง):

   ```bash
   npm run dev
   ```

ถ้ารันติดจะเห็นแบบนี้:

```
[Server] Running on port 3000
```

ถ้ามีคน login สำเร็จจะเห็น:

```
[Auth] Player authenticated — <steamName> (<steamId>)
```

### วิธีขอ Steam API Key

ไม่ใส่ก็ได้ — ไม่ใส่ server ก็จะแปลง ticket แบบ local แทน (ก็ใช้ได้ปกติ แค่เช็คได้น้อยกว่า) ถ้าอยากเช็คกับ Steam จริงๆ ทำตามนี้:

1. เข้า https://steamcommunity.com/dev/apikey แล้ว login
2. ช่อง **Domain Name** ใส่อะไรก็ได้ ไม่ต้องเป็นเว็บจริง ใส่ชื่อโปรเจกต์ตัวเองไปก็ได้
3. กด **Register** จะได้ key มา
4. เอา key ไปใส่ใน `.env`:

   ```
   STEAM_API_KEY=วางคีย์ที่ได้ตรงนี้
   ```

5. รีสตาร์ท server

**อย่า**เอา `STEAM_API_KEY` ไปโพสต์ที่ไหนสาธารณะ (เช่น push ขึ้น GitHub) เพราะมันผูกกับบัญชี Steam ของคุณตรงๆ

## ตั้งค่า server info ใน MongoDB

endpoint เช็คเวอร์ชัน (`checkversion`) จะอ่านคำตอบจาก document เดียวใน collection ชื่อ **`serverinfo`** ถ้ายังไม่มีเลย server จะใช้ค่า default ที่ฝังไว้ในโค้ดแทน — แต่ควรเพิ่มเองเพื่อคุมเวอร์ชันกับเปิด/ปิด maintenance ได้

เพิ่ม document แบบนี้เข้า collection `serverinfo` (จะใช้ `mongosh`, Compass, Atlas อะไรก็ได้ที่ถนัด):

```json
{
  "correctversion": true,
  "serverVersion": "1.0.6.0",
  "ServerDevVersion": "0.0.0.1",
  "IsOnline": true,
  "IsDevOnline": false,
  "__v": 0
}
```

แต่ละ field คืออะไร:

| Field              | ชนิด    | ทำอะไร                                                  |
|--------------------|---------|-----------------------------------------------------------|
| `correctversion`   | Boolean | เอาไว้แจ้งข้อมูลเฉยๆ ตัวเช็คจริงคือ `serverVersion`        |
| `serverVersion`    | String  | เวอร์ชันที่ client ต้องตรงถึงจะเชื่อมต่อได้                    |
| `ServerDevVersion` | String  | เวอร์ชัน build dev/ภายใน                                     |
| `IsOnline`         | Boolean | ตั้งเป็น `false` เมื่อไหร่ ทุกคนจะเห็นว่า server ปิดปรับปรุง |
| `IsDevOnline`      | Boolean | เหมือนกันแต่เป็น flag ของ dev server                          |
| `__v`              | Number  | ปล่อยไว้เป็น `0` ไปเถอะ เป็นของ Mongoose เฉยๆ                       |

มี document เดียวพอ — server จะหยิบอันแรกที่เจอไปใช้เลย

## โครงสร้างโปรเจกต์

```
src/
  config/        environment config
  controllers/    request handlers
  services/       business logic จริงๆ
  models/         mongoose schemas
  middleware/      auth middleware
  routes/         express route definitions
  utils/          helper ต่างๆ (เสิร์ฟ static file, format response ฯลฯ)
data/
  static/         ไฟล์ JSON/รูปที่ game client ดึงไปใช้
```

## เรื่องรูปแบนเนอร์

รูป `data/static/images/mainmenu_banner` ทำหน้าที่เป็นแบนเนอร์ประกาศในเกมด้วย

ถ้าเปลี่ยนรูปแล้วในเกมยังขึ้นรูปเก่าอยู่ **ไม่ใช่ปัญหา cache** ของ server นี้แน่นอน — ให้เช็ค **Launcher** ก่อนเลย launcher ต้องชี้ไปที่ IP/host ของ server นี้ ถ้ามันยังชี้ไป IP เก่าอยู่ เกมก็จะดึงแบนเนอร์จาก server เก่าตลอด ต่อให้เปลี่ยนไฟล์ในนี้กี่รอบก็ไม่ขึ้น

## เรื่องที่ควรรู้เพิ่ม

- ไม่มีระบบ matchmaking ในนี้ — client จะส่ง `roomId` มาตอนจบแมตช์เอง แล้วเอา roomId นั้นไปจ่ายรางวัล
- ตั้งใจให้ log น้อยมาก (แค่ server เปิดกับ login สำเร็จเท่านั้น ไม่มีอย่างอื่นแล้ว)

## License / เอาไปใช้ได้แค่ไหน

อันนี้ทำโดย **Malakor** ถ้าจะเอาไปใช้ ขอแค่นี้:

1. **อย่าบอกว่าเป็นของตัวเอง** จะเอาโค้ดไปใช้ก็ได้ แต่ห้ามบอกว่าตัวเองเป็นคนเขียน หรือลบเครดิตทิ้ง
2. **ให้เครดิตด้วย** แค่ใส่คำว่า **"Malakor"** ไว้สักที่ก็พอ (README, credit, คำอธิบายโปรเจกต์ ที่ไหนก็ได้)
3. **อย่าเอาไปแชร์หรืออัปโหลดซ้ำ** อย่าเอาโค้ดนี้ (หรือทั้ง repo) ไปโพสต์ที่อื่น ไม่ว่า repo อื่น เว็บบอร์ด Discord ตลาดขายโค้ด เว็บแชร์ไฟล์ ที่ไหนก็ห้าม
4. **อย่าเอาไปเป็นแบบทำ API ใหม่** อย่า copy โครงสร้าง/แนวคิดไปทำเป็นโปรเจกต์ "ใหม่" ที่จริงๆ ก็คืออันนี้แค่เปลี่ยนชื่อ

ถ้าเอา repo นี้ไปใช้ ถือว่ายอมรับเงื่อนไขข้างบนแล้วนะ
