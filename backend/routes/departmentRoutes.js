const express = require('express');
const departmentController = require('../controllers/departmentController');
const authenticate = require('../middlewares/auth');
const { mongoIdValidator, departmentValidator } = require('../validators/common');
const validate = require('../middlewares/validate');

const router = express.Router();

router.get('/', authenticate, departmentController.list);
router.get('/:id', authenticate, mongoIdValidator('id'), validate, departmentController.getById);
router.post('/', authenticate, departmentValidator, validate, departmentController.create);
router.put('/:id', authenticate, mongoIdValidator('id'), departmentValidator, validate, departmentController.update);
router.delete('/:id', authenticate, mongoIdValidator('id'), validate, departmentController.remove);

module.exports = router;
