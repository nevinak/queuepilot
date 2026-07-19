const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Doctor name is required'], trim: true, minlength: [2, 'Doctor name must be at least 2 characters'] },
  departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: [true, 'Department is required'], index: true },
  specialization: { type: String, required: [true, 'Specialization is required'], trim: true, minlength: [2, 'Specialization must be at least 2 characters'] },
  experience: { type: Number, required: [true, 'Experience is required'], min: [1, 'Experience must be at least 1 year'] },
  consultationFee: { type: Number, required: [true, 'Consultation fee is required'], min: [0, 'Consultation fee cannot be negative'] },
  status: { type: String, enum: ['Available', 'Break', 'Closed'], default: 'Available' },
  averageConsultationTime: { type: Number, default: 8, min: 1 },
  sessionStatus: { type: String, enum: ['ACTIVE', 'PAUSED', 'ENDED'], default: 'ACTIVE' },
  pausedAt: Date,
  expectedPauseMinutes: { type: Number, default: 0 },
  endedAt: Date,
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

doctorSchema.index({ departmentId: 1, status: 1 });
doctorSchema.index({ name: 1, status: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
