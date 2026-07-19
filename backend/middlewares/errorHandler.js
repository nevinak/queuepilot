const env = require('../config/env');
const { sendError } = require('../utils/response');

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors || {}).map((error) => ({ field: error.path, message: error.message }));
    return sendError(res, 400, 'Validation failed', details);
  }

  if (err.name === 'JsonWebTokenError') {
    return sendError(res, 401, 'Invalid or expired token');
  }

  if (err.name === 'TokenExpiredError') {
    return sendError(res, 401, 'Token expired');
  }

  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return sendError(res, 409, `${field} already exists`);
  }

  if (err.name === 'CastError') {
    return sendError(res, 400, 'Invalid identifier format');
  }

  if (err.statusCode) {
    return sendError(res, err.statusCode, err.message);
  }

  if (env.NODE_ENV !== 'production') {
    console.error(err);
  }
  return sendError(res, 500, 'Internal server error');
};

module.exports = errorHandler;
