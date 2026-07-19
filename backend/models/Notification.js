const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient' },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  type: { type: String, required: [true, 'Notification type is required'] },
  title: { type: String, required: [true, 'Title is required'] },
  message: { type: String, required: [true, 'Message is required'] },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  read: { type: Boolean, default: false, index: true },
  autoDismiss: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

notificationSchema.index({ patientId: 1, createdAt: -1 });
notificationSchema.index({ read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
