const router = require('express').Router();
const staticJson = require('@utils/static-json.util');

const { Taglist } = require('@controllers/store.taglist.controller');
const { purchase } = require('@controllers/store.purchase.controller');
const { verifySession } = require('@middleware/auth.middleware');

router.post('/productlisting/list', staticJson.serve('static/store/P_List.json'));
router.post('/item/listall', staticJson.serve('static/store/I_List.json'));
router.post('/store/list', staticJson.serve('static/store/S_List.json'));
router.post('/store/productlisting/list/tag', Taglist);

// Authenticated in-game purchase routes. All aliases share the same server-side validation.
router.post('/store/purchase', verifySession, purchase);
router.post('/purchase/finalize', verifySession, purchase);
router.post('/store/purchasing/finalize', verifySession, purchase);
router.post('/store/purchase/finalize', verifySession, purchase);
router.post('/purchasing/finalize', verifySession, purchase);

module.exports = router;
