const getPagination = (page, limit, total) => ({
  page: Math.max(1, Number(page) || 1),
  limit: Math.min(50, Math.max(1, Number(limit) || 10)),
  total,
  pages: Math.max(1, Math.ceil(total / Math.max(1, Math.min(50, Math.max(1, Number(limit) || 10)))))
});

module.exports = { getPagination };