const { body } = require('express-validator');

const registerValidator = [
  body('fullName').trim().isLength({ min: 2 }).withMessage('Full name is required'),
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('age').isInt({ min: 1, max: 120 }).withMessage('Age must be a valid number'),
  body('gender').isIn(['Female', 'Male', 'Non-binary', 'Other']).withMessage('Invalid gender')
];

const loginValidator = [
  body('email').isEmail().withMessage('A valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

module.exports = { registerValidator, loginValidator };
