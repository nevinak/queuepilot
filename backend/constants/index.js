module.exports = {
  USER_ROLES: {
    PATIENT: 'patient',
    RECEPTIONIST: 'receptionist',
  },
  DOCTOR_STATUSES: ['Available', 'Break', 'Closed'],
  PATIENT_STATUSES: ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD', 'SERVING', 'COMPLETED', 'CANCELLED'],
  NOTIFICATION_TYPES: {
    QUEUE_MOVED_FASTER: 'Queue moved faster',
    QUEUE_MOVED_SLOWER: 'Queue moved slower',
    DOCTOR_ON_BREAK: 'Doctor on Break',
    DOCTOR_AVAILABLE: 'Doctor Available',
    PLEASE_LEAVE_NOW: 'Please Leave Now',
    YOU_ARE_NEXT: 'You Are Next',
    CONSULTATION_COMPLETED: 'Consultation Completed',
    QUEUE_REORDERED: 'Queue Reordered',
  },
  NOTIFICATION_PRIORITIES: ['low', 'medium', 'high'],
};
