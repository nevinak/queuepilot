const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, childValue]) => {
      acc[key] = sanitizeValue(childValue);
      return acc;
    }, {});
  }
  if (typeof value === 'string') {
    return value.replace(/[<>]/g, '').trim();
  }
  return value;
};

module.exports = (req, _res, next) => {
  if (req.body) req.body = sanitizeValue(req.body);
  if (req.query) req.query = sanitizeValue(req.query);
  if (req.params) req.params = sanitizeValue(req.params);
  next();
};
