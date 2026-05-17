const express = require('express');
const router = express.Router();
const { getAvailability, updateAvailability } = require('../controllers/doctorAvailability');
const { verifyTokenMiddleware } = require('../middleware/auth');

router.get('/:doctor_id', getAvailability);
router.put('/update', verifyTokenMiddleware, updateAvailability);

module.exports = router;