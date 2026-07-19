const { sendError } = require('../utils/response');

module.exports = (req, res) => {
  sendError(res, 404, 'Route not found');
};
