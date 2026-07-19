const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const patientSchema = new mongoose.Schema({
  fullName: { type: String, required: [true, 'Full name is required'], trim: true, minlength: [2, 'Full name must be at least 2 characters'] },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
  },
  password: { type: String, required: [true, 'Password is required'], minlength: [6, 'Password must be at least 6 characters'] },
  phone: { type: String, required: [true, 'Phone is required'], trim: true, match: [/^\+?[0-9\s()-]{7,15}$/, 'Please provide a valid phone number'] },
  age: { type: Number, required: [true, 'Age is required'], min: [1, 'Age must be at least 1'], max: [120, 'Age must be 120 or less'] },
  gender: { type: String, required: [true, 'Gender is required'], enum: ['Female', 'Male', 'Non-binary', 'Other'] },
  place: { type: String, default: 'Kochi' },
  role: { type: String, enum: ['patient'], default: 'patient' },
  queueHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Queue' }],
  notifications: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Notification' }],
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

patientSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

patientSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate();
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
});

patientSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

patientSchema.index({ email: 1 }, { unique: true });
patientSchema.index({ phone: 1 }, { unique: true });
patientSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Patient', patientSchema);
