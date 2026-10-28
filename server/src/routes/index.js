const express = require('express');

const router = express.Router();

router.use('/food', require('./food.route'));
router.use('/fridge', require('./fridge.route'));
router.use('/user/group', require('./group.route'));
router.use('/user', require('./user.route'));
router.use('/admin', require('./admin.route'));

module.exports = router;
