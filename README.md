# Home Sweet Home Online API — NONGCHE

คู่มือการติดตั้งและใช้งาน API Server สำหรับโปรเจกต์ Home Sweet Home Online (HSHO)

> **หมายเหตุสำคัญ:** โปรเจกต์นี้เป็น API Server ที่พัฒนาต่อยอดจากโค้ดเดิม ไม่ใช่เซิร์ฟเวอร์ทางการของเกม และยังไม่ได้ยืนยันความเข้ากันได้ครบทุกระบบกับ Home Sweet Home Online Client ต้นฉบับ การมี API endpoint ไม่ได้แปลว่า Client จะเรียกใช้งาน endpoint นั้นโดยอัตโนมัติ

## 1. ระบบที่ต้องเตรียม

- Windows 10/11 หรือ Linux Server
- Node.js 18 ขึ้นไป (แนะนำรุ่น LTS)
- MongoDB ที่เปิดใช้งานและเข้าถึงได้จากเครื่อง API
- ไฟล์โปรเจกต์ API นี้
- อินเทอร์เน็ตสำหรับติดตั้งแพ็กเกจ และสำหรับให้ Client ติดต่อ Server หากเล่นจากเครื่องอื่น

## 2. ติดตั้ง Node.js และ MongoDB

1. ติดตั้ง Node.js รุ่น LTS จาก <https://nodejs.org/>
2. เตรียม MongoDB โดยใช้ MongoDB Community Server หรือ MongoDB Atlas
3. จด MongoDB connection string และชื่อ Database ที่จะใช้
4. แตกไฟล์ ZIP ไปยังโฟลเดอร์ที่ต้องการ เช่น `C:\HSHO-NONGCHE-API`

## 3. ตั้งค่าไฟล์ .env

ในโฟลเดอร์หลักที่มี `package.json` ให้สร้างไฟล์ชื่อ `.env` (ไม่มีนามสกุลอื่น) แล้วใส่ค่าตัวอย่างต่อไปนี้และแก้ให้ตรงกับ MongoDB ของคุณ

```env
NODE_ENV=development
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017
MONGO_DB_NAME=hsho_nongche
JWT_SECRET=เปลี่ยนเป็นรหัสลับยาวและสุ่มเดายาก
STEAM_API_KEY=
STEAM_APP_ID=2334220
VERSION=prod
DEVELOPERS=
```

**ห้ามนำค่า `JWT_SECRET` จริง, MongoDB URI ที่มีรหัสผ่าน หรือ Steam API Key ไปเผยแพร่** และอย่าอัปโหลดไฟล์ `.env` ขึ้น GitHub หรือส่งให้ผู้อื่น

- `MONGO_URI`: ที่อยู่ MongoDB ตัวอย่างข้างบนใช้กรณี MongoDB อยู่ในเครื่องเดียวกัน
- `MONGO_DB_NAME`: ชื่อฐานข้อมูลที่จะใช้
- `JWT_SECRET`: คีย์ลับสำหรับลงนาม Session Token ต้องเปลี่ยนเป็นค่าของตัวเอง
- `PORT`: พอร์ต API ค่าเริ่มต้น 3000
- `STEAM_API_KEY`: ไม่บังคับในโค้ดนี้ หากใส่จะเปิดทางให้ระบบตรวจ Steam ticket ผ่าน Steam API ตามการทำงานของ Auth
- `STEAM_APP_ID`: ค่าเริ่มต้น 2334220
- `VERSION`: เวอร์ชันที่ API รายงาน
- `DEVELOPERS`: SteamID หลายบัญชีคั่นด้วย comma หากต้องกำหนด

## 4. ติดตั้งแพ็กเกจและเปิด API

เปิด Command Prompt หรือ PowerShell ในโฟลเดอร์หลักของโปรเจกต์ ซึ่งต้องเห็นไฟล์ `package.json` จากนั้นรัน:

```bash
npm install
npm start
```

คำสั่งสำหรับโหมดพัฒนา (ต้องมี nodemon ตาม package dependencies):

```bash
npm run dev
```

เมื่อเริ่มทำงานสำเร็จ Terminal จะแสดงข้อความลักษณะนี้:

```text
MongoDB connected to: hsho_nongche
Server running on port 3000
Environment: development
```

หากขึ้น `Startup error` ให้ตรวจ `.env`, สถานะ MongoDB, URI, ชื่อ Database และการเชื่อมต่อเครือข่ายก่อน

## 5. ตรวจสอบว่า API ทำงานอยู่

เปิดเบราว์เซอร์บนเครื่องที่รัน API แล้วเข้า:

```text
http://127.0.0.1:3000/health
```

ถ้าทำงานปกติจะได้ JSON ที่มี `status: "OK"` และ `database.status: "connected"`

หากต้องการให้เครื่องอื่นในเครือข่ายเข้าถึง API ให้ใช้ IP ภายในของเครื่อง Server เช่น `http://192.168.x.x:3000` (เปลี่ยนเป็น IP จริงของคุณ) และตั้งค่า Firewall ให้เปิดรับ TCP port 3000 เฉพาะเครือข่ายที่เชื่อถือได้ อย่าเปิด MongoDB port สู่สาธารณะ

การให้ผู้เล่นนอกเครือข่ายเข้าถึงต้องตั้งค่า Hosting/Cloud, Firewall, Domain และ HTTPS ให้เรียบร้อยก่อน อย่าใช้ IP ตัวอย่างในคู่มือนี้เป็น URL จริง

## 6. API routes ที่มีอยู่ในโค้ดชุดนี้

Base URL ในตัวอย่างคือ `http://127.0.0.1:3000` โดย endpoint ที่มี `verifySession` ต้องแนบ Session Token ตามรูปแบบที่ระบบ Auth ออกให้

### ผู้เล่นและข้อมูลบัญชี

| Method | Path | การใช้งาน |
|---|---|---|
| POST | `/live/player/authen` | เข้าสู่ระบบ / ตรวจสอบ Steam ticket |
| POST | `/live/player/inventory/getAll` | อ่าน Inventory |
| POST | `/live/player/characterslot/get` | อ่าน Character Slot |
| POST | `/live/player/characterslot/edit` | แก้ Character Slot |
| POST | `/live/player/profile/edit` | แก้ Profile |
| POST | `/live/player/sticker/edit` | แก้ Sticker |
| POST | `/live/player/inventory/addItem` | เพิ่มไอเทม (ต้องมี Session) |
| POST | `/live/player/inventory/removeItem` | ลบไอเทม (ต้องมี Session) |

### ร้านค้า

| Method | Path | การใช้งาน |
|---|---|---|
| POST | `/live/productlisting/list` | รายการสินค้า |
| POST | `/live/item/listall` | รายการ Item |
| POST | `/live/store/list` | รายการ Store |
| POST | `/live/store/productlisting/list/tag` | รายการสินค้าตาม Tag |

**ข้อจำกัด:** Routes ข้างต้นเป็นการอ่านรายการสินค้า/ข้อมูลร้านตามโค้ดที่มี ไม่ควรเข้าใจว่าเป็นระบบซื้อสินค้าและตัดเงินที่สมบูรณ์แล้ว ต้องตรวจสอบและพัฒนาขั้นตอน Purchase/Finalize ให้ตรงกับ Client ก่อนใช้งานจริง

### Gacha / Pot

| Method | Path | การใช้งาน |
|---|---|---|
| GET | `/live/gacha/static/api/banner` | อ่านข้อมูล Banner กาชา |
| GET | `/live/lootboxgo/api/items?loot_box_short_code=Default_Gacha` | อ่านรายการ Greedy Pot |
| GET | `/live/lootboxgo/api/items?loot_box_short_code=Bullet_Gacha` | อ่านรายการ Bullet Pot |
| POST | `/live/lootboxgo/api/open` | เปิด Pot (ต้องมี Session) |

รหัสกล่องสุ่มใน API:

- `Default_Gacha` = Greedy Pot
- `Bullet_Gacha` = Bullet Pot

ระบบเปิด Pot อ่านข้อมูลจาก `data/static/pots/` และ Banner จาก `data/static/gacha/` โดยคิดเงินตาม `cost` ใน Banner และตรวจ/หักจำนวน Pot จาก `inventory.lootBoxAmount` (Greedy) หรือ `inventory.bulletAmount` (Bullet) ตามจำนวนที่เปิด โค้ดกำหนดจำนวนเปิดต่อคำขอ 1–100 ครั้ง

Greedy Pot ใช้ค่า `greedyPity` ในข้อมูลผู้เล่นเพื่อเก็บความคืบหน้าการันตี โดยโค้ดปัจจุบันบังคับ Legendary เมื่อ pity ถึงเงื่อนไขที่กำหนด (ก่อนสุ่มครั้งถัดไปเมื่อค่าเดิมอย่างน้อย 49) ทั้งนี้ต้องทดสอบผลจริงกับฐานข้อมูลและ Client ก่อนเปิดให้ผู้เล่นใช้งาน

### เกมและผลการแข่งขัน

| Method | Path | การใช้งาน |
|---|---|---|
| POST | `/live/player/gameplay/checkversion` | ตรวจเวอร์ชันเกม |
| POST | `/live/player/getban` | ตรวจสถานะแบน |
| POST | `/live/player/gameplay/endgameresult` | ส่งผลหลังจบเกม (ต้องมี Session) |
| POST | `/live/matchmaking/queue/join` | เข้าคิว Matchmaking แบบ API ที่เพิ่มในโปรเจกต์ |
| POST | `/live/matchmaking/queue/status` | ตรวจสถานะคิว |
| POST | `/live/matchmaking/queue/leave` | ออกจากคิว |

Matchmaking routes เป็น API เพิ่มเติมของโปรเจกต์ ไม่ได้ยืนยันว่า Client เกมต้นฉบับเรียกใช้ และการสร้าง Match record ไม่ได้สร้าง Dedicated Game Server หรือเปิดห้องเกมจริงด้วยตัวเอง

### Immortal และระบบอื่น

| Method | Path | การใช้งาน |
|---|---|---|
| POST | `/live/immortal/player/get` | อ่านข้อมูล Immortal (ต้องมี Session) |
| POST | `/live/immortal/player/getmatch` | อ่านข้อมูล Match Immortal |
| POST | `/live/immortal/player/update` | อัปเดต Immortal (ต้องมี Session) |
| POST | `/treasure/api/progress/get` | อ่าน Treasure Progress (ต้องมี Session) |
| POST | `/mailbox/get` | อ่าน Mailbox (ต้องมี Session) |
| POST | `/ogilvy/genqr` | สร้าง QR (ต้องมี Session) |
| POST | `/exprk/api/table` | อ่านตาราง EXP Rank (ต้องมี Session) |
| GET | `/banner/:key` | อ่านภาพ Banner ตาม key |
| GET | `/` | ภาพ Main Menu Banner |

### Log API

| Method | Path |
|---|---|
| POST | `/logapi/v1/add/ingame` |
| POST | `/logapi/v1/add/matchlog` |
| POST | `/logapi/v1/add/errorlog` |
| POST | `/logapi/v1/check/penalty` |
| POST | `/logapi/v1/check/serverdetect` |

Log routes บางรายการตอบกลับสถานะสำเร็จเพื่อให้ Client เดินหน้าต่อ แต่ไม่ได้หมายความว่ามีการเก็บ Log ลงฐานข้อมูลครบถ้วน

## 7. ไฟล์ข้อมูลที่แก้ไขได้

| โฟลเดอร์/ไฟล์ | หน้าที่ |
|---|---|
| `data/static/store/` | รายการสินค้าและข้อมูลร้าน |
| `data/static/pots/greedy.json` | Pool ของ Greedy Pot |
| `data/static/pots/bullet.json` | Pool ของ Bullet Pot |
| `data/static/gacha/banner_greedy.json` | ราคาและการตั้งค่า Banner Greedy |
| `data/static/gacha/banner_bullet.json` | ราคาและการตั้งค่า Banner Bullet |
| `data/static/inventory/` | Catalog ไอเทมที่ใช้ประกอบข้อมูล Inventory |
| `data/static/images/` | รูปภาพที่ API ให้บริการ (ถ้ามีไฟล์อยู่ในชุดโปรเจกต์) |

ก่อนแก้ JSON ให้สำรองไฟล์เดิม และตรวจว่า `short_code` ของรางวัลมีอยู่ใน Catalog และระบบ Inventory รองรับจริง อย่าเพิ่มรหัสไอเทมที่เดาขึ้นเอง เพราะอาจสุ่มได้แต่เพิ่มเข้าคลังไม่ได้

## 8. การสำรองข้อมูล

ก่อนอัปเดต API หรือแก้ไขข้อมูลผู้เล่น ให้สำรอง:

1. MongoDB Database ทั้งฐาน (รวม Player, Match และ Collection อื่น)
2. โฟลเดอร์ `data/static/`
3. ไฟล์ `.env` เก็บไว้ในที่ปลอดภัย ห้ามแนบไปกับ ZIP ที่แจกจ่าย

## 9. แก้ปัญหาเบื้องต้น

- **เปิด API ไม่ได้:** ตรวจ Node.js, `npm install`, `.env` และข้อความ Error ใน Terminal
- **MongoDB disconnected:** ตรวจว่า MongoDB ทำงานอยู่หรือไม่ และ `MONGO_URI` ถูกต้องหรือไม่
- **เข้า `/health` แล้ว 503:** ตรวจสถานะ MongoDB และสิทธิ์เชื่อมต่อฐานข้อมูล
- **เกมแจ้ง Cannot connect to the Internet:** ตรวจว่า Client/Launcher ชี้ไปยัง Host และ Port ของ API ที่เปิดจริง, Server เปิดอยู่, Firewall อนุญาต และ HTTPS/ใบรับรองถูกต้องหากใช้ HTTPS ข้อความนี้อาจเกิดจาก Endpoint หรือรูปแบบ Response ไม่ตรงกับที่ Client คาดหวังได้เช่นกัน
- **จบแมตช์แล้วขึ้น Error:** ตรวจ Log ของ API และ Request ที่ Client ส่งไปยัง `/live/player/gameplay/endgameresult` โดยเฉพาะ Session และ `roomId`/`room_id`/`matchId`
- **ขึ้น Not enough Pots:** ตรวจ `inventory.lootBoxAmount` สำหรับ Greedy หรือ `inventory.bulletAmount` สำหรับ Bullet ของผู้เล่นคนนั้น
- **กาชาไม่ให้ของ:** ตรวจ Pool JSON, `short_code`, rarity, Catalog และหมวดที่ `inventory.service.js` รองรับ
- **ร้านค้าแสดงของแต่ซื้อไม่ได้:** รายการร้านเป็น Static Listing; ต้องมี Purchase API ที่ Client ใช้ได้จริงก่อน

## 10. ข้อควรระวังและสถานะการทดสอบ

- ทดสอบในเครื่องส่วนตัวก่อนเปิดให้คนอื่นใช้งาน
- อย่าเปิด MongoDB ให้เข้าถึงจากอินเทอร์เน็ตโดยตรง
- อย่าใช้ `JWT_SECRET` ตัวอย่างหรือรหัสผ่านที่เดาง่าย
- API นี้ยังต้องทดสอบร่วมกับ Client ต้นฉบับ, MongoDB จริง และรูปแบบ Request/Response ของเกมก่อนสรุปว่าใช้งานได้ครบทุกระบบ
- Matchmaking API ที่เพิ่มในโปรเจกต์เป็น API ฝั่ง Server เท่านั้น ไม่ได้ยืนยันการเชื่อมต่อกับระบบ Matchmaking/Dedicated Server ของเกมต้นฉบับ

## เครดิต

ชื่อชุด API: **Home Sweet Home Online API NONGCHE**

โค้ดต้นทางมีเครดิตผู้พัฒนาเดิมเป็น **Malakor** โปรดคงเครดิตและปฏิบัติตามเงื่อนไขการใช้งานที่มากับต้นฉบับ ห้ามนำไปอ้างว่าเป็นผลงานต้นฉบับของตนเอง

## In-game store purchases

Authenticated purchase routes are available under `/live`:
- `POST /live/store/purchase`
- `POST /live/purchase/finalize`
- `POST /live/store/purchasing/finalize`
- `POST /live/store/purchase/finalize`
- `POST /live/purchasing/finalize`

Send the selected `productListingId` (or `productListingID`) and optional `quantity` / `selectedPriceTagIndex`. The server looks up the price in `P_List.json`, maps currency type `1` to Coin, `2` to Amethyst, and `4` to Amulet, checks the player's real balance, deducts it atomically, and grants the bundle contents. The client must send its authenticated session token. The endpoint never trusts a price or currency amount supplied by the client.

The Amulet Store now includes `เขี้ยวหนุมาน` (`Relic_Manop`) for 200 Amulet. It is granted into the player's `curseRelic` collection.

### Loot reward ownership / persistence
- Opening a pot now grants each selected reward to the authenticated player's saved data before returning success.
- `Relic_` and `Curse_` rewards are stored in the dedicated `curseRelic` field (with level and durability data), rather than being incorrectly placed in the ordinary item list.
- The gacha response includes the refreshed `inventory` and `curseRelic` data so clients can refresh ownership immediately.
- `POST /live/player/inventory/getAll` also returns `curseRelic`.
