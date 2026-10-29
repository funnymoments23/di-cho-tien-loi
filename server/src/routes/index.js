const express = require('express');

const router = express.Router();

router.use('/food', require('./food.route'));
router.use('/fridge', require('./fridge.route'));
router.use('/shopping', require('./shopping.route'));
router.use('/meal', require('./meal.route'));
router.use('/recipe', require('./recipe.route'));
router.use('/report', require('./report.route'));
router.use('/user/group', require('./group.route'));
router.use('/user', require('./user.route'));
router.use('/admin', require('./admin.route'));

module.exports = router;
