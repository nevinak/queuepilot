const Queue = require('../models/Queue');
const Doctor = require('../models/Doctor');
const Notification = require('../models/Notification');
const { NOTIFICATION_TYPES } = require('../constants');

class QueueService {
  async generateToken(doctorId) {
    const count = await Queue.countDocuments({ doctorId, status: { $in: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD', 'SERVING'] } });
    return count + 1;
  }

  async getDoctorQueue(doctorId) {
    return Queue.find({ doctorId }).populate('patientId', '_id fullName').sort({ queuePosition: 1, createdAt: 1 }).lean();
  }

  async buildQueueSnapshot(doctorId) {
    const [queue, doctor] = await Promise.all([this.getDoctorQueue(doctorId), Doctor.findById(doctorId)]);
    const activeQueue = queue.filter((item) => !['COMPLETED', 'CANCELLED'].includes(item.status));
    return { doctor, queue: activeQueue };
  }

  async getAverageServiceDuration(doctorId) {
    const completedTokens = await Queue.find({
      doctorId,
      status: 'COMPLETED',
      serviceDurationMinutes: { $gt: 0 }
    });
    if (completedTokens.length === 0) {
      const doctor = await Doctor.findById(doctorId);
      return doctor?.averageConsultationTime || 8;
    }
    const total = completedTokens.reduce((acc, entry) => acc + (entry.serviceDurationMinutes || 0), 0);
    return Number((total / completedTokens.length).toFixed(1));
  }

  async joinQueue({ doctorId, patientId, patientName, travelTimeMinutes }) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

    if (doctor.sessionStatus === 'ENDED') {
      throw Object.assign(new Error('This session has already ended. No new tokens can be generated.'), { statusCode: 400 });
    }

    // Duplicate Check
    const activeEntry = await Queue.findOne({
      doctorId,
      patientId,
      status: { $in: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD', 'SERVING'] }
    });
    if (activeEntry) {
      await activeEntry.populate('patientId', '_id fullName');
      // Return existing token with isDuplicate flag
      return { entry: activeEntry, doctor, isDuplicate: true };
    }

    const queuePosition = await this.getNextQueuePosition(doctorId);
    const tokenNumber = queuePosition;
    const entry = await Queue.create({
      doctorId,
      patientId,
      tokenNumber,
      queuePosition,
      status: 'WAITING',
      eta: 'Calculating',
      travelTimeMinutes: Number(travelTimeMinutes || 0)
    });

    await entry.populate('patientId', '_id fullName');

    await Notification.create({
      patientId,
      doctorId,
      type: NOTIFICATION_TYPES.QUEUE_MOVED_FASTER,
      title: 'Queue joined',
      message: `${patientName} joined ${doctor.name}'s queue`,
      priority: 'medium'
    });

    await this.updateETA({ doctorId });

    return { entry, doctor, isDuplicate: false };
  }

  async cancelQueue({ doctorId, patientId }) {
    const entry = await Queue.findOne({ doctorId, patientId, status: { $nin: ['COMPLETED', 'CANCELLED'] } });
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
    entry.status = 'CANCELLED';
    entry.eta = 'Cancelled';
    entry.remainingWaitingTime = 0;
    await entry.save();
    await this.updateETA({ doctorId });
    return entry;
  }

  async startJourney(tokenId) {
    const entry = await Queue.findById(tokenId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
    
    this.validateTransition(entry.status, 'IN_TRANSIT');

    entry.status = 'IN_TRANSIT';
    entry.journeyStartedAt = new Date();
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });

    // Notification
    await Notification.create({
      patientId: entry.patientId,
      doctorId: entry.doctorId,
      type: NOTIFICATION_TYPES.PLEASE_LEAVE_NOW,
      title: 'Journey Started',
      message: 'You are now on your way.',
      priority: 'medium'
    });

    return entry;
  }

  async arrive(tokenId) {
    const entry = await Queue.findById(tokenId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

    this.validateTransition(entry.status, 'ARRIVED');

    entry.status = 'ARRIVED';
    entry.arrivedAt = new Date();
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });

    // Notification
    await Notification.create({
      patientId: entry.patientId,
      doctorId: entry.doctorId,
      type: NOTIFICATION_TYPES.YOU_ARE_NEXT,
      title: 'Arrived at Clinic',
      message: 'You have arrived. Please check-in.',
      priority: 'medium'
    });

    return entry;
  }

  async startService(tokenId) {
    const entry = await Queue.findById(tokenId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

    this.validateTransition(entry.status, 'SERVING');

    // Only one token should be SERVING at a time
    const currentServing = await Queue.findOne({ doctorId: entry.doctorId, status: 'SERVING' });
    if (currentServing) {
      throw Object.assign(new Error('Another token is already being served.'), { statusCode: 400 });
    }

    entry.status = 'SERVING';
    entry.serviceStartedAt = new Date();
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });

    return entry;
  }

  async complete(tokenId) {
    const entry = await Queue.findById(tokenId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

    this.validateTransition(entry.status, 'COMPLETED');

    entry.status = 'COMPLETED';
    entry.completedAt = new Date();

    // Calculate service duration in minutes (decimal precision preserved)
    const start = entry.serviceStartedAt || entry.createdAt;
    const diffMs = entry.completedAt - start;
    entry.serviceDurationMinutes = Number((diffMs / (60 * 1000)).toFixed(2));
    
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });

    // Notification
    await Notification.create({
      patientId: entry.patientId,
      doctorId: entry.doctorId,
      type: NOTIFICATION_TYPES.CONSULTATION_COMPLETED,
      title: 'Service Completed',
      message: 'Your service has been completed.',
      priority: 'low'
    });

    return entry;
  }

  async smartHold(tokenId) {
    const entry = await Queue.findById(tokenId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });

    this.validateTransition(entry.status, 'SMART_HOLD');

    entry.status = 'SMART_HOLD';
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });

    return entry;
  }

  async pauseSession(doctorId, expectedPauseMinutes) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

    const pauseMins = Number(expectedPauseMinutes);
    if (isNaN(pauseMins) || pauseMins <= 0) {
      throw Object.assign(new Error('Expected pause minutes must be a positive number'), { statusCode: 400 });
    }

    // Check if a token is actively SERVING
    const activeServing = await Queue.findOne({ doctorId, status: 'SERVING' });
    if (activeServing) {
      throw Object.assign(new Error('Complete the current service before pausing the queue.'), { statusCode: 400 });
    }

    doctor.sessionStatus = 'PAUSED';
    doctor.pausedAt = new Date();
    doctor.expectedPauseMinutes = pauseMins;
    await doctor.save();
    await this.updateETA({ doctorId });
    return doctor;
  }

  async resumeSession(doctorId) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

    if (doctor.sessionStatus !== 'PAUSED') {
      throw Object.assign(new Error('Queue is not paused'), { statusCode: 400 });
    }

    doctor.sessionStatus = 'ACTIVE';
    doctor.expectedPauseMinutes = 0;
    doctor.pausedAt = null;
    await doctor.save();
    await this.updateETA({ doctorId });
    return doctor;
  }

  async endSession(doctorId) {
    const doctor = await Doctor.findById(doctorId);
    if (!doctor) throw Object.assign(new Error('Doctor not found'), { statusCode: 404 });

    // Check if a token is actively SERVING
    const activeServing = await Queue.findOne({ doctorId, status: 'SERVING' });
    if (activeServing) {
      throw Object.assign(new Error('Complete the current service before ending the session.'), { statusCode: 400 });
    }

    doctor.sessionStatus = 'ENDED';
    doctor.endedAt = new Date();
    await doctor.save();
    return doctor;
  }

  async getNextQueuePosition(doctorId) {
    const lastEntry = await Queue.findOne({ doctorId }).sort({ queuePosition: -1 });
    return lastEntry && lastEntry.queuePosition ? lastEntry.queuePosition + 1 : 1;
  }

  validateTransition(currentStatus, nextStatus) {
    if (currentStatus === nextStatus) return;
    
    const validMap = {
      'WAITING': ['IN_TRANSIT', 'CANCELLED'],
      'IN_TRANSIT': ['ARRIVED', 'SMART_HOLD', 'CANCELLED'],
      'SMART_HOLD': ['ARRIVED', 'CANCELLED'],
      'ARRIVED': ['SERVING', 'CANCELLED'],
      'SERVING': ['COMPLETED', 'CANCELLED'],
      'COMPLETED': [],
      'CANCELLED': []
    };

    const allowed = validMap[currentStatus] || [];
    if (!allowed.includes(nextStatus)) {
      throw Object.assign(new Error(`Invalid status transition from ${currentStatus} to ${nextStatus}`), { statusCode: 400 });
    }
  }

  async updateETA({ doctorId }) {
    const queue = await Queue.find({ doctorId }).populate('patientId', '_id fullName').sort({ queuePosition: 1, createdAt: 1 });
    const doctor = await Doctor.findById(doctorId);
    const avg = await this.getAverageServiceDuration(doctorId);
    const activeQueue = queue.filter((item) => ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD', 'SERVING'].includes(item.status));

    const completedCount = await Queue.countDocuments({ doctorId, status: 'COMPLETED' });
    let confidence = 'LOW';
    if (completedCount >= 3) confidence = 'HIGH';
    else if (completedCount >= 1) confidence = 'MEDIUM';

    for (let index = 0; index < activeQueue.length; index += 1) {
      const item = activeQueue[index];
      item.predictionConfidence = confidence;

      if (item.status === 'SERVING') {
        item.eta = 'Now';
        item.remainingWaitingTime = 0;
        item.patientsAhead = 0;
        item.expectedTurnWindow = 'Now serving';
        item.departureRecommendation = 'SERVING';
        item.expectedTurnStart = new Date();
        item.expectedTurnEnd = new Date();
        item.recommendedDepartureTime = new Date();
      } else {
        const aheadCount = activeQueue.filter(other => other.queuePosition < item.queuePosition).length;
        item.patientsAhead = aheadCount;

        let waitTime = item.patientsAhead * avg;
        if (doctor?.sessionStatus === 'PAUSED') {
          waitTime += doctor.expectedPauseMinutes || 0;
          item.expectedPauseMinutes = doctor.expectedPauseMinutes || 0;
        } else {
          item.expectedPauseMinutes = 0;
        }
        item.remainingWaitingTime = Math.max(0, waitTime);
        item.eta = item.remainingWaitingTime === 0 ? 'Now' : `${Math.round(item.remainingWaitingTime)} min`;

        const lower = Math.max(0, item.remainingWaitingTime - 5);
        const upper = item.remainingWaitingTime + 5;
        const now = new Date();
        item.expectedTurnStart = new Date(now.getTime() + lower * 60 * 1000);
        item.expectedTurnEnd = new Date(now.getTime() + upper * 60 * 1000);
        
        const formatTime = (date) => {
          let hrs = date.getHours();
          const mins = String(date.getMinutes()).padStart(2, '0');
          const ampm = hrs >= 12 ? 'PM' : 'AM';
          hrs = hrs % 12;
          hrs = hrs ? hrs : 12;
          return `${hrs}:${mins} ${ampm}`;
        };
        
        item.expectedTurnWindow = `${formatTime(item.expectedTurnStart)} – ${formatTime(item.expectedTurnEnd)}`;

        const safetyBufferMinutes = 5;
        const travelTimeAndBuffer = (item.travelTimeMinutes || 0) + safetyBufferMinutes;
        item.recommendedDepartureTime = new Date(item.expectedTurnStart.getTime() - travelTimeAndBuffer * 60 * 1000);

        if (item.status === 'IN_TRANSIT') {
          item.departureRecommendation = 'ON_THE_WAY';
        } else if (item.status === 'ARRIVED') {
          item.departureRecommendation = 'ARRIVED';
        } else if (item.status === 'SMART_HOLD') {
          item.departureRecommendation = 'SMART_HOLD';
        } else {
          const timeUntilDeparture = item.remainingWaitingTime - travelTimeAndBuffer;

          if (timeUntilDeparture > 10) {
            item.departureRecommendation = 'STAY';
          } else if (timeUntilDeparture > 5 && timeUntilDeparture <= 10) {
            item.departureRecommendation = 'GET_READY';
          } else if (timeUntilDeparture >= 0 && timeUntilDeparture <= 5) {
            item.departureRecommendation = 'LEAVE_NOW';
          } else {
            item.departureRecommendation = 'AT_RISK';
          }
        }
      }
      await item.save();
    }

    return activeQueue;
  }

  async callNextPatient({ doctorId }) {
    const current = await Queue.findOne({ doctorId, status: 'SERVING' });
    let completedToken = null;
    if (current) {
      current.status = 'COMPLETED';
      current.completedAt = new Date();
      const start = current.serviceStartedAt || current.createdAt;
      const diffMs = current.completedAt - start;
      current.serviceDurationMinutes = Number((diffMs / (60 * 1000)).toFixed(2));
      await current.save();
      completedToken = current;
      await completedToken.populate('patientId', '_id fullName');
    }

    const nextServingToken = await Queue.findOne({ doctorId, status: 'ARRIVED' }).sort({ queuePosition: 1, createdAt: 1 });
    if (nextServingToken) {
      nextServingToken.status = 'SERVING';
      nextServingToken.serviceStartedAt = new Date();
      await nextServingToken.save();
      await nextServingToken.populate('patientId', '_id fullName');
    }

    await this.updateETA({ doctorId });

    return { completedToken, nextServingToken };
  }

  async updateEntryStatus(entryId, status) {
    const entry = await Queue.findById(entryId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
    
    this.validateTransition(entry.status, status);
    
    entry.status = status;
    if (status === 'CANCELLED') {
      entry.eta = 'Cancelled';
      entry.remainingWaitingTime = 0;
    }
    await entry.save();
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });
    return entry;
  }

  async skipPatient(entryId) {
    const entry = await Queue.findById(entryId);
    if (!entry) throw Object.assign(new Error('Queue entry not found'), { statusCode: 404 });
    
    const activeEntries = await Queue.find({
      doctorId: entry.doctorId,
      status: { $in: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD'] }
    });
    
    if (activeEntries.length > 1) {
      const maxPosition = Math.max(...activeEntries.map(e => e.queuePosition || e.tokenNumber), 0);
      entry.queuePosition = maxPosition + 1;
      entry.tokenNumber = maxPosition + 1;
      entry.status = 'WAITING';
      await entry.save();
    }
    
    await entry.populate('patientId', '_id fullName');
    await this.updateETA({ doctorId: entry.doctorId });
    return entry;
  }

  async broadcastQueue(io, doctorId) {
    const { queue } = await this.buildQueueSnapshot(doctorId);
    io.to(doctorId.toString()).emit('queue-updated', { doctorId, queue });
    return queue;
  }
}

module.exports = new QueueService();
