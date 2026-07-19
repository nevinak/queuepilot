const Notification = require('../models/Notification');
const { sendSuccess, sendError } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

class NotificationController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;
      const [notifications, total] = await Promise.all([
        Notification.find({ patientId: req.user.id }).skip(skip).limit(limit).sort({ createdAt: -1 }),
        Notification.countDocuments({ patientId: req.user.id })
      ]);
      return sendSuccess(res, 200, { notifications, pagination: getPagination(page, limit, total) }, 'Notifications loaded');
    } catch (error) {
      next(error);
    }
  }

  async markAsRead(req, res, next) {
    try {
      const notification = await Notification.findByIdAndUpdate(req.params.id, { read: true }, { new: true });
      if (!notification) return sendError(res, 404, 'Notification not found');
      return sendSuccess(res, 200, { notification }, 'Notification updated');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new NotificationController();
