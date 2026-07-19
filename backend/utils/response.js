const sendSuccess = (res, statusCode = 200, payload = {}, message = 'Success') => {
  return res.status(statusCode).json({ success: true, message, data: payload });
};

const sendError = (res, statusCode = 500, message = 'Something went wrong', details = null) => {
  const payload = { success: false, message };
  if (details) payload.details = details;
  return res.status(statusCode).json(payload);
};

module.exports = { sendSuccess, sendError };
