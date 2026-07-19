const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const receptionistSchema = new mongoose.Schema({
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
  role: { type: String, enum: ['receptionist'], default: 'receptionist' },
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

receptionistSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

receptionistSchema.pre('findOneAndUpdate', async function() {
  const update = this.getUpdate();
  if (update.password) {
    update.password = await bcrypt.hash(update.password, 10);
  }
});

receptionistSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Receptionist', receptionistSchema);
