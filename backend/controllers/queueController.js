const queueService = require('../services/queueService');
const analyticsService = require('../services/analyticsService');
const Queue = require('../models/Queue');
const { sendSuccess, sendError } = require('../utils/response');
const { getPagination } = require('../utils/pagination');

class QueueController {
  async list(req, res, next) {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Number(req.query.limit) || 10);
      const skip = (page - 1) * limit;
      const [queue, total] = await Promise.all([
        Queue.find().populate('patientId doctorId').skip(skip).limit(limit).sort({ createdAt: -1 }),
        Queue.countDocuments()
      ]);
      return sendSuccess(res, 200, { queue, pagination: getPagination(page, limit, total) }, 'Queue history loaded');
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const entry = await Queue.findById(req.params.tokenId).populate('patientId doctorId');
      if (!entry) return sendError(res, 404, 'Queue entry not found');
      return sendSuccess(res, 200, { entry }, 'Queue entry loaded');
    } catch (error) {
      next(error);
    }
  }

  async join(req, res, next) {
    try {
      const { entry, doctor, isDuplicate } = await queueService.joinQueue({
        doctorId: req.body.doctorId,
        patientId: req.user.id,
        patientName: req.user.fullName,
        travelTimeMinutes: req.body.travelTimeMinutes
      });
      if (isDuplicate) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: "You already have an active token for this session.",
          data: entry
        });
      }
      const io = req.app.locals.io;
      if (io) {
        io.to(doctor._id.toString()).emit('patient-joined', { doctorId: doctor._id, entry });
        io.emit('queue-updated', { doctorId: doctor._id, queue: await queueService.updateETA({ doctorId: doctor._id }) });
      }
      return sendSuccess(res, 201, { entry, doctor, isDuplicate }, 'Queue joined');
    } catch (error) {
      next(error);
    }
  }

  async cancel(req, res, next) {
    try {
      const doctorId = req.params.doctorId;
      const entry = await queueService.cancelQueue({ doctorId, patientId: req.user.id });
      const io = req.app.locals.io;
      if (io) {
        io.to(doctorId).emit('patient-cancelled', { doctorId, entry });
        io.emit('queue-updated', { doctorId, queue: await queueService.updateETA({ doctorId }) });
      }
      return sendSuccess(res, 200, { entry }, 'Queue cancelled');
    } catch (error) {
      next(error);
    }
  }

  async next(req, res, next) {
    try {
      const doctorId = req.params.doctorId;
      const { completedToken, nextServingToken } = await queueService.callNextPatient({ doctorId });
      
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId });
        io.to(doctorId).emit('queue-updated', { doctorId, queue: updatedQueue });
      }
      
      if (!nextServingToken) {
        return sendSuccess(res, 200, { completedToken, nextServingToken: null, next: null }, 'No arrived users are ready to serve.');
      }
      
      return sendSuccess(res, 200, { completedToken, nextServingToken, next: nextServingToken }, 'Queue advanced');
    } catch (error) {
      next(error);
    }
  }

  async reorder(req, res, next) {
    try {
      const doctorId = req.params.doctorId;
      const queue = await queueService.updateETA({ doctorId }); // Just recalculate ETAs after manual changes
      req.app.locals.io.to(doctorId).emit('queue-reordered', { doctorId, queue });
      return sendSuccess(res, 200, { queue }, 'Queue reordered');
    } catch (error) {
      next(error);
    }
  }

  async updateETA(req, res, next) {
    try {
      const doctorId = req.params.doctorId;
      const queue = await queueService.updateETA({ doctorId });
      if (req.app.locals.io) {
        req.app.locals.io.to(doctorId).emit('queue-updated', { doctorId, queue });
      }
      return sendSuccess(res, 200, { queue }, 'ETA updated');
    } catch (error) {
      next(error);
    }
  }

  async analytics(req, res, next) {
    try {
      const metrics = await analyticsService.getReceptionistDashboardMetrics();
      return sendSuccess(res, 200, { metrics }, 'Analytics loaded');
    } catch (error) {
      next(error);
    }
  }

  async updateStatus(req, res, next) {
    try {
      const { entryId } = req.params;
      const { status } = req.body;
      const entry = await queueService.updateEntryStatus(entryId, status);
      
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      
      return sendSuccess(res, 200, { entry }, 'Status updated');
    } catch (error) {
      next(error);
    }
  }

  async skip(req, res, next) {
    try {
      const { entryId } = req.params;
      const entry = await queueService.skipPatient(entryId);
      
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      
      return sendSuccess(res, 200, { entry }, 'Patient skipped');
    } catch (error) {
      next(error);
    }
  }

  // Token patches
  async startJourney(req, res, next) {
    try {
      const entry = await queueService.startJourney(req.params.tokenId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { entry }, 'Journey started');
    } catch (error) {
      next(error);
    }
  }

  async arrive(req, res, next) {
    try {
      const entry = await queueService.arrive(req.params.tokenId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { entry }, 'Arrived marked');
    } catch (error) {
      next(error);
    }
  }

  async startService(req, res, next) {
    try {
      const entry = await queueService.startService(req.params.tokenId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { entry }, 'Service started');
    } catch (error) {
      next(error);
    }
  }

  async complete(req, res, next) {
    try {
      const entry = await queueService.complete(req.params.tokenId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { entry }, 'Service completed');
    } catch (error) {
      next(error);
    }
  }

  async smartHold(req, res, next) {
    try {
      const entry = await queueService.smartHold(req.params.tokenId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: entry.doctorId });
        io.emit('queue-updated', { doctorId: entry.doctorId, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { entry }, 'Placed on Smart Hold');
    } catch (error) {
      next(error);
    }
  }

  // Session controls
  async pauseSession(req, res, next) {
    try {
      const { expectedPauseMinutes } = req.body;
      const doctor = await queueService.pauseSession(req.params.sessionId, expectedPauseMinutes);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: doctor._id });
        io.emit('queue-updated', { doctorId: doctor._id, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { doctor }, 'Session paused');
    } catch (error) {
      next(error);
    }
  }

  async resumeSession(req, res, next) {
    try {
      const doctor = await queueService.resumeSession(req.params.sessionId);
      const io = req.app.locals.io;
      if (io) {
        const updatedQueue = await queueService.updateETA({ doctorId: doctor._id });
        io.emit('queue-updated', { doctorId: doctor._id, queue: updatedQueue });
      }
      return sendSuccess(res, 200, { doctor }, 'Session resumed');
    } catch (error) {
      next(error);
    }
  }

  async endSession(req, res, next) {
    try {
      const doctor = await queueService.endSession(req.params.sessionId);
      const io = req.app.locals.io;
      if (io) {
        io.emit('session-ended', { doctorId: doctor._id });
      }
      return sendSuccess(res, 200, { doctor }, 'Session ended');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new QueueController();
