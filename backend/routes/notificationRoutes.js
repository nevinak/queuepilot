const express = require('express');
const notificationController = require('../controllers/notificationController');
const authenticate = require('../middlewares/auth');
const { mongoIdValidator } = require('../validators/common');
const validate = require('../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, notificationController.list);
router.patch('/:id/read', authenticate, mongoIdValidator('id'), validate, notificationController.markAsRead);

module.exports = router;
