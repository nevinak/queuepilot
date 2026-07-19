const express = require('express');
const patientController = require('../controllers/patientController');
const authenticate = require('../middlewares/auth');
const { mongoIdValidator, patientValidator } = require('../validators/common');
const validate = require('../middlewares/validate');

const router = express.Router();

router.post('/', authenticate, patientValidator, validate, patientController.create);
router.get('/', authenticate, patientController.list);
router.get('/:id', authenticate, mongoIdValidator('id'), validate, patientController.getById);
router.put('/:id', authenticate, mongoIdValidator('id'), patientValidator, validate, patientController.update);
router.delete('/:id', authenticate, mongoIdValidator('id'), validate, patientController.remove);

module.exports = router;
