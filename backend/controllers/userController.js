const Patient = require('../models/Patient');
const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');

class UserController {
  async verify(req, res, next) {
    try {
      const { name, phone } = req.body;
      if (!name || !phone) {
        return sendError(res, 400, 'Name and phone number are required');
      }

      const trimmedPhone = String(phone).trim();
      const trimmedName = String(name).trim();

      // Read existing user with phone
      let patient = await Patient.findOne({ phone: trimmedPhone });
      
      if (!patient) {
        // Create new patient
        const cleanPhone = trimmedPhone.replace(/[\s+-]/g, '');
        const email = `${cleanPhone}@queuepilot.com`.toLowerCase();
        // Check if email collisions exist
        const emailExist = await Patient.findOne({ email });
        const finalEmail = emailExist ? `${cleanPhone}_${Date.now()}@queuepilot.com` : email;
        
        try {
          patient = await Patient.create({
            fullName: trimmedName,
            phone: trimmedPhone,
            email: finalEmail,
            password: 'Verify@123',
            age: 30,
            gender: 'Other'
          });
        } catch (createErr) {
          if (createErr.code === 11000) {
            patient = await Patient.findOne({
              $or: [
                { phone: trimmedPhone },
                { email: finalEmail }
              ]
            });
            if (!patient) {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      }

      // Generate JWT token
      const token = authService.signToken(patient);
      const { getDistanceAndDuration } = require('../utils/googleMaps');
      const travelData = await getDistanceAndDuration(patient.place || 'Kochi');

      return sendSuccess(res, 200, { token, user: patient, travelData }, 'User verified successfully');
    } catch (error) {
      console.error('Error during user verification:', error);
      return sendError(res, 500, 'Unable to verify patient login');
    }
  }
}

module.exports = new UserController();
