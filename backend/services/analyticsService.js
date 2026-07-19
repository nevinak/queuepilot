const Queue = require('../models/Queue');
const Doctor = require('../models/Doctor');
const Patient = require('../models/Patient');
const Notification = require('../models/Notification');

class AnalyticsService {
  async getReceptionistDashboardMetrics(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const [queues, doctors, notifications, patients] = await Promise.all([
      Queue.find({ createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }),
      Doctor.find().sort({ status: 1 }),
      Notification.find({ createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }),
      Patient.find({ createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 })
    ]);

    const completedConsultations = queues.filter((entry) => entry.status === 'COMPLETED').length;
    const cancelledPatients = queues.filter((entry) => entry.status === 'CANCELLED').length;
    const waitingPatients = queues.filter((entry) => ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD'].includes(entry.status)).length;
    const averageConsultationTime = queues.length
      ? Number((queues.reduce((acc, entry) => acc + (entry.currentAverage || entry.latestDuration || 8), 0) / queues.length).toFixed(1))
      : 8;
    const averageWaitingTime = queues.length
      ? Number((queues.reduce((acc, entry) => acc + (entry.remainingWaitingTime || 0), 0) / queues.length).toFixed(1))
      : 0;

    return {
      todayPatients: patients.length,
      waitingPatients,
      completedConsultations,
      cancelledPatients,
      averageConsultationTime,
      averageWaitingTime,
      doctorsAvailable: doctors.filter((doctor) => doctor.status === 'Available').length,
      doctorsOnBreak: doctors.filter((doctor) => doctor.status === 'Break').length,
      recentNotifications: notifications.length,
      activeQueues: queues.length,
    };
  }
}

module.exports = new AnalyticsService();
