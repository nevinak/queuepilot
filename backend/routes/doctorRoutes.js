const express = require('express');
const doctorController = require('../controllers/doctorController');
const authenticate = require('../middlewares/auth');
const { mongoIdValidator, doctorValidator } = require('../validators/common');
const validate = require('../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, doctorController.list);
router.get('/:id', authenticate, mongoIdValidator('id'), validate, doctorController.getById);
router.post('/', authenticate, doctorValidator, validate, doctorController.create);
router.post('/:id/status', authenticate, mongoIdValidator('id'), validate, doctorController.updateStatus);
router.put('/:id', authenticate, mongoIdValidator('id'), doctorValidator, validate, doctorController.update);
router.delete('/:id', authenticate, mongoIdValidator('id'), validate, doctorController.remove);

module.exports = router;
