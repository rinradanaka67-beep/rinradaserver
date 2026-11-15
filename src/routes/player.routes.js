'use strict';

const router = require('express').Router();
const { authenticate } = require('@controllers/auth.controller');

router.post('/authen', authenticate);

module.exports = router;
