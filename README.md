# QueuePilot

QueuePilot is a production-ready healthcare queue orchestration platform designed for modern hospitals, clinics, and patient experience teams. It combines live queue tracking, adaptive ETA predictions, receptionist operations, and a polished SaaS experience into a single platform that is easy to demo, deploy, and extend.

## Problem Statement
Hospitals often struggle with long waiting times, inconsistent queue communication, and manual coordination between receptionists and clinicians. QueuePilot solves this with a realtime queue system that improves transparency and reduces patient frustration.

QueuePilot provides a premium patient-facing portal, a receptionist operations center, live queue updates via Socket.IO, and an EMA-based prediction engine that estimates waiting and consultation times. The architecture is prepared for future AI integration with pluggable prediction models.

## 🔑 Demo Login Credentials

You can use the following pre-seeded credentials to test and demo the platform:

### 1. Receptionist Dashboard
* **Email**: `receptionist@queuepilot.com`
* **Password**: `Receptionist@123`
* **Phone**: `+91 98765 43210`

### 2. Patient Dashboard
Patients can log in using either **Passwordless verification (Name + Phone)** or **Email + Password**:
* **Passwordless Check-In**:
  * **Name**: `Aravind Nair`
  * **Phone**: `+91 99999 00000` *(Registered location: Aluva)*
* **Standard Email Login**:
  * **Emails**: `rahul1@gmail.com`, `priya2@gmail.com`, `amit3@gmail.com`, `neha4@gmail.com` *(through to index 150)*
  * **Password**: `Patient@123`

---

## Architecture
- Frontend: React + Vite + React Router + Framer Motion
- Backend: Node.js + Express + MongoDB + Mongoose + Socket.IO
- Security: Helmet, CORS, rate limiting, JWT, validation, hashing
- Deployment: Docker, Docker Compose, Nginx, GitHub Actions

## Features
- Patient registration and login
- Live queue joining and cancellation
- Receptionist queue orchestration
- Adaptive ETA predictions using EMA
- Realtime notifications and live updates
- Premium landing experience and responsive UI
- Demo-ready seeded data
- Deployment and testing automation

## Screenshots
Add screenshots of the landing page, patient portal, receptionist portal and analytics screens here.

## Installation
### Prerequisites
- Node.js 20+
- MongoDB 7+
- Docker (optional)

### Backend
```bash
cd backend
cp .env.example .env
npm install
node server.js
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

## Environment Variables
Create a backend .env file using the sample values in .env.example.

## API Documentation
### Authentication
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me

### Queue
- GET /api/queues
- GET /api/queues/analytics
- POST /api/queues/join
- POST /api/queues/cancel/:doctorId
- POST /api/queues/next/:doctorId
- POST /api/queues/next-patient/:doctorId

### Doctors and Departments
- GET /api/doctors
- POST /api/doctors
- GET /api/departments

## Deployment Guide
### Frontend (Vercel)
1. Build the frontend with `npm run build`.
2. Deploy the dist output to Vercel.
3. Set the API base URL in the environment configuration.

### Backend (Render or Railway)
1. Upload the backend folder to your hosting provider.
2. Configure the environment variables from .env.example.
3. Start the Node process with `node server.js`.

### Docker Compose
```bash
docker compose up --build
```

## Testing
```bash
cd backend && npm test
cd frontend && npm run lint
```

## Future Scope
- Add advanced ML models for queue forecasting
- Add PDF and CSV export flows
- Expand analytics with Recharts dashboards
- Add role-based settings and audit logs

## Contributors
- QueuePilot Team
