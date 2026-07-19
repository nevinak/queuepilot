const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/response');

class DepartmentController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;
      const departments = await Department.find().populate('doctors').skip(skip).limit(limit).sort({ createdAt: -1 });
      const total = await Department.countDocuments();
      return sendSuccess(res, 200, { departments, pagination: { page, limit, total, pages: Math.ceil(total / limit) } }, 'Departments loaded');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const department = await Department.findById(req.params.id).populate('doctors');
      if (!department) return sendError(res, 404, 'Department not found');
      return sendSuccess(res, 200, { department }, 'Department loaded');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const department = await Department.create(req.body);
      return sendSuccess(res, 201, { department }, 'Department created');
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const department = await Department.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
      if (!department) return sendError(res, 404, 'Department not found');
      return sendSuccess(res, 200, { department }, 'Department updated');
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const department = await Department.findByIdAndDelete(req.params.id);
      if (!department) return sendError(res, 404, 'Department not found');
      return sendSuccess(res, 200, {}, 'Department deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DepartmentController();
