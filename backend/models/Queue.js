const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: [true, 'Doctor is required'], index: true },
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: [true, 'Patient is required'], index: true },
  tokenNumber: { type: Number, required: [true, 'Token number is required'], min: 1, index: true },
  queuePosition: { type: Number, default: 0, index: true },
  status: {
    type: String,
    enum: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD', 'SERVING', 'COMPLETED', 'CANCELLED'],
    default: 'WAITING',
    index: true,
  },
  eta: { type: String, default: 'Calculating' },
  remainingWaitingTime: { type: Number, default: 0, min: 0 },
  patientsAhead: { type: Number, default: 0, min: 0 },
  departureRecommendation: { type: String, default: 'Plan your departure' },
  previousAverage: { type: Number, default: 8, min: 1 },
  latestDuration: { type: Number, default: 8, min: 1 },
  currentAverage: { type: Number, default: 8, min: 1 },
  travelTimeMinutes: { type: Number, default: 0 },
  safetyBufferMinutes: { type: Number, default: 5 },
  journeyStartedAt: Date,
  arrivedAt: Date,
  serviceStartedAt: Date,
  completedAt: Date,
  serviceDurationMinutes: { type: Number, default: 0 },
  expectedPauseMinutes: { type: Number, default: 0 },
  expectedTurnWindow: { type: String, default: '' },
  expectedTurnStart: Date,
  expectedTurnEnd: Date,
  recommendedDepartureTime: Date,
  predictionConfidence: { type: String, default: 'LOW' },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

queueSchema.index({ doctorId: 1, status: 1, createdAt: 1 });
queueSchema.index({ tokenNumber: 1, doctorId: 1 }, { unique: false });

module.exports = mongoose.model('Queue', queueSchema);
