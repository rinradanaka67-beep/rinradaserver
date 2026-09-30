'use strict';

const express   = require('express');
const router    = express.Router();
const { verifySession }     = require('@middleware/auth.middleware');
const inventoryController   = require('@controllers/inventory.controller');

router.post('/inventory/getAll',     verifySession, inventoryController.getInventoryAll);
router.post('/characterslot/get',    verifySession, inventoryController.getCharacterSlot);
router.post('/characterslot/edit',   verifySession, inventoryController.editCharacterSlot);
router.post('/profile/edit',         verifySession, inventoryController.editProfile);
router.post('/sticker/edit',         verifySession, inventoryController.editSticker);
router.post('/inventory/addItem',    verifySession, inventoryController.addItem);
router.post('/inventory/removeItem', verifySession, inventoryController.removeItem);

module.exports = router;
