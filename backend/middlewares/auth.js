const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { sendError } = require('../utils/response');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return sendError(res, 401, 'Authentication required');

  try {
    req.user = jwt.verify(token, env.JWT_SECRET);
    next();
  } catch (error) {
    return sendError(res, 401, 'Invalid or expired token');
  }
};
