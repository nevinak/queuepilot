// Override mongoose globally with in-memory mock (disabled for production MongoDB connect)
// const mockMongoose = require('./mockMongoose');
// require.cache[require.resolve('mongoose')] = {
//   id: require.resolve('mongoose'),
//   exports: mockMongoose,
//   loaded: true
// };

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
mongoose.set('toJSON', { virtuals: true });
mongoose.set('toObject', { virtuals: true });
const http = require('http');
const env = require('./config/env');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const patientRoutes = require('./routes/patientRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const queueRoutes = require('./routes/queueRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const errorHandler = require('./middlewares/errorHandler');
const notFound = require('./middlewares/notFound');
const sanitize = require('./middlewares/sanitize');
const authenticate = require('./middlewares/auth');
const initializeSocket = require('./socket');
const Receptionist = require('./models/Receptionist');
const Department = require('./models/Department');
const Doctor = require('./models/Doctor');

const startupState = {
  mongoConnected: false,
  fallbackMode: false,
};

const app = express();
app.locals.config = { averageConsultationTime: 8, alpha: 0.3 };
const server = http.createServer(app);
initializeSocket(server, app);

app.use(helmet());
app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(sanitize);
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 200 }));

app.get('/api/health', (req, res) => res.json({ success: true, message: 'QueuePilot API healthy', environment: env.NODE_ENV }));
app.get('/api/config', authenticate, (req, res) => res.json({ success: true, message: 'Configuration loaded', data: app.locals.config }));
app.post('/api/config', authenticate, (req, res) => {
  app.locals.config = { ...app.locals.config, ...req.body };
  return res.json({ success: true, message: 'Configuration updated', data: app.locals.config });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/queues', queueRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

const seedData = async () => {
  try {
    const Patient = require('./models/Patient');
    
    // Seed Receptionists
    const receptionistSeed = [
      { fullName: 'Ava Thompson', email: 'receptionist@queuepilot.com', password: 'Receptionist@123', phone: '+1 555 0123', role: 'receptionist' },
      { fullName: 'Arjun Nair', email: 'arjun@queuepilot.com', password: 'Arjun@123', phone: '+91 98765 43210', role: 'receptionist' }
    ];
    for (const receptionist of receptionistSeed) {
      const exists = await Receptionist.findOne({ email: receptionist.email });
      if (!exists) await Receptionist.create(receptionist);
    }

    // Seed Patients
    const patientSeed = [
      { fullName: 'Rahul Sharma', email: 'rahul@gmail.com', password: 'Patient@123', phone: '+91 99999 99999', age: 28, gender: 'Male', role: 'patient' },
      { fullName: 'Priya Patel', email: 'priya@gmail.com', password: 'Patient@123', phone: '+91 88888 88888', age: 32, gender: 'Female', role: 'patient' },
      { fullName: 'Amit Kumar', email: 'amit@gmail.com', password: 'Patient@123', phone: '+91 77777 77777', age: 45, gender: 'Male', role: 'patient' },
      { fullName: 'Neha Gupta', email: 'neha@gmail.com', password: 'Patient@123', phone: '+91 66666 66666', age: 24, gender: 'Female', role: 'patient' }
    ];
    for (const patient of patientSeed) {
      const exists = await Patient.findOne({ email: patient.email });
      if (!exists) await Patient.create(patient);
    }

    const departmentSeed = [
      { name: 'General Medicine', description: 'Primary care and acute consultations' },
      { name: 'Cardiology', description: 'Heart and vascular specialist care' },
      { name: 'Orthopedics', description: 'Bone, joint and spine treatment' },
      { name: 'Neurology', description: 'Brain and nervous system care' },
      { name: 'Pediatrics', description: 'Children and adolescent care' },
      { name: 'Dermatology', description: 'Skin health and cosmetic treatments' },
    ];

    for (const dept of departmentSeed) {
      const existingDept = await Department.findOne({ name: dept.name });
      if (!existingDept) await Department.create(dept);
    }

    const doctorSeed = [
      { name: 'Dr. Maya Chen', departmentName: 'General Medicine', specialization: 'Internal Medicine', experience: 14, consultationFee: 500, status: 'Available' },
      { name: 'Dr. Jonah Patel', departmentName: 'Cardiology', specialization: 'Cardiology', experience: 19, consultationFee: 800, status: 'Available' },
      { name: 'Dr. Sara Ali', departmentName: 'Orthopedics', specialization: 'Joint Surgery', experience: 12, consultationFee: 600, status: 'Available' },
    ];

    for (const entry of doctorSeed) {
      const department = await Department.findOne({ name: entry.departmentName });
      if (!department) continue;
      const existingDoctor = await Doctor.findOne({ name: entry.name });
      if (!existingDoctor) {
        const doctor = await Doctor.create({ ...entry, departmentId: department._id });
        if (!department.doctors.includes(doctor._id)) {
          department.doctors.push(doctor._id);
          await department.save();
        }
      }
    }
  } catch (error) {
    console.warn('Seed data skipped, continuing in fallback mode:', error.message);
  }
};

const startServer = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    startupState.mongoConnected = true;
    console.log('MongoDB connected');
    await seedData();
  } catch (error) {
    startupState.fallbackMode = true;
    console.warn('MongoDB unavailable, starting in fallback mode:', error.message);
  }

  server.listen(env.PORT, () => {
    console.log(`QueuePilot API listening on port ${env.PORT}`);
    if (startupState.fallbackMode) {
      console.log('Running with fallback mode; data will not persist across restarts.');
    }
  });
};

startServer();
