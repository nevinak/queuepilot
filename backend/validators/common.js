const { param, body } = require('express-validator');

const mongoIdValidator = (fieldName) => param(fieldName).isMongoId().withMessage(`${fieldName} must be a valid MongoDB ID`);

const patientValidator = [
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name must be at least 2 characters'),
  body('email').isEmail().withMessage('A valid email address is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').trim().matches(/^\+?[0-9\s()-]{7,15}$/).withMessage('Please provide a valid phone number'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('Age must be between 1 and 120'),
  body('gender').isIn(['Female', 'Male', 'Non-binary', 'Other']).withMessage('Please choose a valid gender')
];

const doctorValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Doctor name must be at least 2 characters'),
  body('departmentId').isMongoId().withMessage('Department ID must be valid'),
  body('specialization').trim().isLength({ min: 2 }).withMessage('Specialization is required'),
  body('experience').isInt({ min: 1 }).withMessage('Experience must be a positive number'),
  body('consultationFee').isNumeric().withMessage('Consultation fee must be a number')
];

const departmentValidator = [
  body('name').trim().isLength({ min: 2 }).withMessage('Department name must be at least 2 characters'),
  body('description').trim().isLength({ min: 2 }).withMessage('Description is required')
];

module.exports = { mongoIdValidator, patientValidator, doctorValidator, departmentValidator };
