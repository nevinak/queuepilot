const { validationResult } = require('express-validator');
const { sendError } = require('../utils/response');

module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, 'Validation failed', errors.array().map((error) => ({ field: error.param, message: error.msg })));
  }
  next();
};
