# Changelog (hsho-nongche)
- server.js: req.body always an object; JSON 404; request logger [req]
- Reject non-string ids / NoSQL operator injection (game.service, auth, immortal, inventory, gacha, loot-box lookup)
- immortal update: owner or developer only (403 otherwise)
- inventory: type validation for profile/sticker/addItem/removeItem
- player-data: ISO dates, first-login duplicate-key race
- characterSlot.updatedAt maintained
- version check lenient by default (ENFORCE_CLIENT_VERSION=true for strict)
- startup warning if STEAM_API_KEY unset
