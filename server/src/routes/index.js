const express = require('express');

const router = express.Router();

router.use('/user/group', require('./group.route'));
router.use('/user', require('./user.route'));

module.exports = router;
