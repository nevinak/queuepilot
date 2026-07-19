const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../utils/response');
const { getDistanceAndDuration } = require('../utils/googleMaps');

class AuthController {
  async register(req, res, next) {
    try {
      const { patient, token } = await authService.registerPatient({
        fullName: req.body.fullName,
        email: req.body.email,
        password: req.body.password,
        phone: req.body.phone,
        age: req.body.age,
        gender: req.body.gender,
        place: req.body.place,
      });
      const travelData = await getDistanceAndDuration(patient.place || 'Kochi');
      return sendSuccess(res, 201, { token, user: patient, travelData }, 'Patient registered');
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { user, token } = await authService.loginUser({ email: req.body.email, password: req.body.password, role: req.body.role });
      let travelData = null;
      if (user && user.role === 'patient') {
        travelData = await getDistanceAndDuration(user.place || 'Kochi');
      }
      return sendSuccess(res, 200, { token, user, travelData }, 'Authenticated');
    } catch (error) {
      next(error);
    }
  }

  async me(req, res, next) {
    try {
      const Model = req.user.role === 'receptionist' ? require('../models/Receptionist') : require('../models/Patient');
      const user = await Model.findById(req.user.id).select('-password');
      if (!user) return sendError(res, 404, 'User not found');
      let travelData = null;
      if (user.role === 'patient') {
        travelData = await getDistanceAndDuration(user.place || 'Kochi');
      }
      return sendSuccess(res, 200, { user, travelData }, 'Profile loaded');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();
