const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth');
const { verifyTokenMiddleware } = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', verifyTokenMiddleware, authController.getProfile);

module.exports = router;