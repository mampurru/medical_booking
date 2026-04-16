const express = require('express');
const router = express.Router();
const doctorsController = require('../controllers/doctors');
const { verifyTokenMiddleware } = require('../middleware/auth');

// Protegemos la ruta para que solo usuarios logueados vean la lista
router.get('/', verifyTokenMiddleware, doctorsController.getAllDoctors);

module.exports = router;