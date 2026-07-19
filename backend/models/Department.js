const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true, minlength: [2, 'Department name must be at least 2 characters'] },
  description: { type: String, required: [true, 'Description is required'], trim: true, minlength: [2, 'Description must be at least 2 characters'] },
  doctors: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

departmentSchema.index({ name: 1 }, { unique: true });
departmentSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Department', departmentSchema);
