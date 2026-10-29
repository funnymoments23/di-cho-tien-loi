const express = require('express');
const auth = require('../middlewares/auth.middleware');
const reportController = require('../controllers/report.controller');

const router = express.Router();

// Nhóm API bổ sung cho đề mục B.6 — đặc tả API gốc không có (docs/02 mục 3.3).
// Mọi endpoint đều chỉ đọc, phạm vi là nhóm hiện tại của người dùng.

// GET /report/overview — gộp số liệu mua sắm / tiêu thụ / lãng phí / tủ lạnh.
router.get('/overview', auth, reportController.getOverview); // 00380

// GET /report/shopping?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/shopping', auth, reportController.getShoppingReport); // 00381

// GET /report/consumption?from=&to=
router.get('/consumption', auth, reportController.getConsumptionReport); // 00382

// GET /report/waste?from=&to=
router.get('/waste', auth, reportController.getWasteReport); // 00383

// GET /report/fridge — ảnh chụp tủ lạnh hiện tại, không lọc theo thời gian.
router.get('/fridge', auth, reportController.getFridgeReport); // 00384

module.exports = router;
