const Patient = require('../models/Patient');
const { sendSuccess, sendError } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

class PatientController {
  async create(req, res, next) {
    try {
      const patient = await Patient.create(req.body);
      return sendSuccess(res, 201, { patient }, 'Patient created');
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;
      const [patients, total] = await Promise.all([
        Patient.find().select('-password').skip(skip).limit(limit).sort({ createdAt: -1 }),
        Patient.countDocuments()
      ]);
      return sendSuccess(res, 200, { patients, pagination: getPagination(page, limit, total) }, 'Patients loaded');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const patient = await Patient.findById(req.params.id).select('-password');
      if (!patient) return sendError(res, 404, 'Patient not found');
      return sendSuccess(res, 200, { patient }, 'Patient loaded');
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-password');
      if (!patient) return sendError(res, 404, 'Patient not found');
      return sendSuccess(res, 200, { patient }, 'Patient updated');
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const patient = await Patient.findByIdAndDelete(req.params.id);
      if (!patient) return sendError(res, 404, 'Patient not found');
      return sendSuccess(res, 200, {}, 'Patient deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PatientController();
