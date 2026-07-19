const jwt = require('jsonwebtoken');
const Patient = require('../models/Patient');
const Receptionist = require('../models/Receptionist');
const env = require('../config/env');

class AuthService {
  async registerPatient(payload) {
    const existing = await Patient.findOne({ email: payload.email.toLowerCase() });
    if (existing) throw Object.assign(new Error('Patient already exists'), { statusCode: 409 });
    const patient = await Patient.create(payload);
    const token = this.signToken(patient);
    return { patient, token };
  }

  async loginUser({ email, password, role }) {
    const Model = role === 'receptionist' ? Receptionist : Patient;
    const user = await Model.findOne({ email: email.toLowerCase() });
    if (!user) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    const valid = await user.comparePassword(password);
    if (!valid) throw Object.assign(new Error('Invalid credentials'), { statusCode: 401 });
    const token = this.signToken(user);
    return { user, token };
  }

  signToken(user) {
    return jwt.sign({ id: user._id, role: user.role || 'patient', email: user.email }, env.JWT_SECRET, { expiresIn: '8h' });
  }
}

module.exports = new AuthService();
