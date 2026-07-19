const Doctor = require('../models/Doctor');
const Department = require('../models/Department');
const { sendSuccess, sendError } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

class DoctorController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;
      const [doctors, total] = await Promise.all([
        Doctor.find().populate('departmentId').skip(skip).limit(limit).sort({ createdAt: -1 }),
        Doctor.countDocuments()
      ]);
      return sendSuccess(res, 200, { doctors, pagination: getPagination(page, limit, total) }, 'Doctors loaded');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const doctor = await Doctor.findById(req.params.id).populate('departmentId');
      if (!doctor) return sendError(res, 404, 'Doctor not found');
      return sendSuccess(res, 200, { doctor }, 'Doctor loaded');
    } catch (error) {
      next(error);
    }
  }

  async create(req, res, next) {
    try {
      const departmentId = req.body.departmentId || req.body.department;
      const department = await Department.findById(departmentId);
      if (!department) return sendError(res, 404, 'Department not found');
      const doctor = await Doctor.create({ ...req.body, departmentId });
      department.doctors.push(doctor._id);
      await department.save();
      return sendSuccess(res, 201, { doctor }, 'Doctor created');
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const payload = { ...req.body };
      if (payload.departmentId || payload.department) {
        payload.departmentId = payload.departmentId || payload.department;
      }
      const doctor = await Doctor.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
      if (!doctor) return sendError(res, 404, 'Doctor not found');
      return sendSuccess(res, 200, { doctor }, 'Doctor updated');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { status } = req.body;
      const doctor = await Doctor.findByIdAndUpdate(req.params.id, { status }, { new: true, runValidators: true });
      if (!doctor) return sendError(res, 404, 'Doctor not found');
      
      const io = req.app.locals.io;
      
      // Update ETAs for all waiting patients
      const queueService = require('../services/queueService');
      const updatedQueue = await queueService.updateETA({ doctorId: doctor._id });
      
      // Broadcast events
      if (io) {
        io.emit('doctor-status-changed', { doctorId: doctor._id, status });
        io.emit('queue-updated', { doctorId: doctor._id, queue: updatedQueue });
      }
      
      // Create notifications for all waiting patients in the queue
      const Queue = require('../models/Queue');
      const Notification = require('../models/Notification');
      const { NOTIFICATION_TYPES } = require('../constants');
      
      const waitingEntries = await Queue.find({
        doctorId: doctor._id,
        status: { $in: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD'] }
      });
      
      for (const entry of waitingEntries) {
        await Notification.create({
          patientId: entry.patientId,
          doctorId: doctor._id,
          type: status === 'Break' ? NOTIFICATION_TYPES.DOCTOR_ON_BREAK : NOTIFICATION_TYPES.DOCTOR_AVAILABLE,
          title: status === 'Break' ? 'Doctor on Break' : 'Doctor Resumed',
          message: status === 'Break' 
            ? `${doctor.name} is now on break. Queue progression is temporarily paused.` 
            : `${doctor.name} has resumed consultations. Queue is active.`,
          priority: 'high'
        });
        
        if (io) {
          io.emit('notification-created', {
            patientId: entry.patientId,
            message: status === 'Break' 
              ? `${doctor.name} is now on break. Queue progression is temporarily paused.` 
              : `${doctor.name} has resumed consultations. Queue is active.`
          });
        }
      }
      
      return sendSuccess(res, 200, { doctor }, 'Doctor status updated');
    } catch (error) {
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const doctor = await Doctor.findByIdAndDelete(req.params.id);
      if (!doctor) return sendError(res, 404, 'Doctor not found');
      return sendSuccess(res, 200, {}, 'Doctor deleted');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new DoctorController();
