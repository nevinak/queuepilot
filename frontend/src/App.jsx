import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Activity, ArrowRight, BellRing, Clock3, HeartPulse, Hospital, LayoutDashboard, LogOut, MapPin, ShieldCheck, Sparkles, Stethoscope, TimerReset, Users } from 'lucide-react';
import { io } from 'socket.io-client';
import { useForm } from 'react-hook-form';
import { PageLoader } from './components/LoadingSkeleton';
import { EmptyState } from './components/EmptyState';
import { SettingsPanel } from './components/SettingsPanel';
import { AnalyticsPanel } from './components/AnalyticsPanel';
import { UnauthorizedPage, ForbiddenPage, NotFoundPage, ServerErrorPage } from './components/ErrorPages';

const HospitalMap = lazy(() => import('./components/HospitalMap'));

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const socket = io(import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000');

const formatStatus = (status) => {
  const map = {
    'WAITING': 'Waiting',
    'IN_TRANSIT': 'In Transit',
    'ARRIVED': 'Arrived',
    'SMART_HOLD': 'Smart Hold',
    'SERVING': 'Serving',
    'COMPLETED': 'Completed',
    'CANCELLED': 'Cancelled'
  };
  return map[status] || status;
};

const normalizeQueue = (rawQueue) => {
  if (!Array.isArray(rawQueue)) return [];
  return rawQueue.map(entry => {
    if (!entry) return null;
    const docId = entry.doctorId?._id || entry.doctorId?.id || entry.doctorId;
    return {
      id: entry.id || entry._id?.toString() || entry._id,
      token: entry.tokenNumber || entry.token,
      patientName: entry.patientId?.fullName || entry.patientName || 'Patient',
      status: entry.status,
      eta: entry.eta,
      patientsAhead: entry.patientsAhead,
      departureRecommendation: entry.departureRecommendation,
      travelTimeMinutes: entry.travelTimeMinutes,
      expectedTurnWindow: entry.expectedTurnWindow,
      predictionConfidence: entry.predictionConfidence,
      serviceDurationMinutes: entry.serviceDurationMinutes,
      expectedPauseMinutes: entry.expectedPauseMinutes,
      expectedTurnStart: entry.expectedTurnStart,
      expectedTurnEnd: entry.expectedTurnEnd,
      recommendedDepartureTime: entry.recommendedDepartureTime,
      doctorId: docId ? docId.toString() : ''
    };
  }).filter(Boolean);
};

const defaultState = {
  departments: [],
  doctors: [],
  queues: {},
  notifications: [],
  metrics: null,
  config: { averageConsultationTime: 8, alpha: 0.3 },
};

const getToken = () => localStorage.getItem('queuepilot-token');
const setToken = (token) => localStorage.setItem('queuepilot-token', token);
const clearToken = () => localStorage.removeItem('queuepilot-token');

const api = axios.create({ baseURL: API });
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function App() {
  const [auth, setAuth] = useState({ user: null, loading: true });
  const [appState, setAppState] = useState(defaultState);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const bootstrap = async () => {
      const token = getToken();
      if (!token) {
        setAuth({ user: null, loading: false });
        return;
      }
      try {
        const { data: response } = await api.get('/auth/me');
        const user = response?.data?.user ?? null;
        setAuth({ user, loading: false });
        if (response?.data?.travelData) {
          localStorage.setItem('queuepilot-travel-time', response.data.travelData.durationMinutes);
          localStorage.setItem('queuepilot-travel-distance', response.data.travelData.distance);
        }
      } catch {
        clearToken();
        setAuth({ user: null, loading: false });
      }
    };

    bootstrap();
    socket.on('queue-updated', (payload) => {
      setAppState((prev) => {
        const doctorIdStr = payload.doctorId.toString();
        const mappedQueue = normalizeQueue(payload.queue);
        return {
          ...prev,
          queues: {
            ...prev.queues,
            [doctorIdStr]: mappedQueue
          }
        };
      });
    });
    socket.on('notification', (payload) => {
      setAppState((prev) => ({ ...prev, notifications: [payload, ...prev.notifications] }));
    });
    return () => {
      socket.off('queue-updated');
      socket.off('notification');
    };
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const [{ data: departmentsResponse }, { data: doctorsResponse }] = await Promise.all([
          api.get('/departments'),
          api.get('/doctors')
        ]);
        
        const mappedDepts = (departmentsResponse?.data?.departments ?? []).map(d => ({
          ...d,
          id: d.id || d._id?.toString() || d._id
        }));
        
        const mappedDocs = (doctorsResponse?.data?.doctors ?? []).map(d => ({
          ...d,
          id: d.id || d._id?.toString() || d._id
        }));

        let queuesGrouped = {};
        if (auth.user) {
          try {
            const { data: queuesResponse } = await api.get('/queues?limit=100');
            const normalizedHistory = normalizeQueue(queuesResponse?.data?.queue ?? []);
            normalizedHistory.forEach((entry) => {
              if (entry.doctorId) {
                if (!queuesGrouped[entry.doctorId]) queuesGrouped[entry.doctorId] = [];
                queuesGrouped[entry.doctorId].push(entry);
              }
            });
          } catch (qErr) {
            console.warn('Could not load active queues:', qErr.message);
          }
        }

        setAppState((prev) => ({
          ...prev,
          departments: mappedDepts,
          doctors: mappedDocs,
          queues: auth.user ? queuesGrouped : prev.queues
        }));
      } catch (err) {
        console.warn('Could not load departments or doctors:', err.message);
      }
    };
    load();
  }, [auth.user]);

  const logout = () => {
    clearToken();
    setAuth({ user: null, loading: false });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.15),_transparent_35%),linear-gradient(135deg,_#060b14_0%,_#0f172a_100%)] text-slate-100">
      <header className="border-b border-white/10 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold">
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-2"><Hospital className="h-6 w-6 text-emerald-300" /></div>
            <div>
              <div className="text-xl font-semibold">Lakeshore QueuePilot</div>
              <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Lakeshore Hospital, Kochi</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            {auth.user ? (
              <>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">{auth.user.fullName}</span>
                <button onClick={logout} className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10"><LogOut className="h-4 w-4" /></button>
              </>
            ) : (
              <Link to="/login" className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-200">Patient Login</Link>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
        <Routes>
          <Route path="/" element={<Home appState={appState} setSelectedDepartment={setSelectedDepartment} setSelectedDoctor={setSelectedDoctor} auth={auth} />} />
          <Route path="/login" element={auth.loading ? <Loading /> : auth.user ? <Navigate to={auth.user.role === 'receptionist' ? '/receptionist' : '/patient'} replace /> : <Login setAuth={setAuth} />} />
          <Route path="/receptionist-login" element={auth.loading ? <Loading /> : auth.user ? <Navigate to={auth.user.role === 'receptionist' ? '/receptionist' : '/patient'} replace /> : <ReceptionistLogin setAuth={setAuth} />} />
  <Route path="/register" element={auth.loading ? <Loading /> : auth.user ? <Navigate to={auth.user.role === 'receptionist' ? '/receptionist' : '/patient'} replace /> : <Register />} />
          <Route path="/patient" element={auth.loading ? <Loading /> : auth.user && auth.user.role === 'patient' ? <PatientPortal appState={appState} setAppState={setAppState} selectedDoctor={selectedDoctor} setSelectedDepartment={setSelectedDepartment} selectedDepartment={selectedDepartment} user={auth.user} /> : <Navigate to="/login" replace />} />
          <Route path="/receptionist" element={auth.loading ? <Loading /> : auth.user && auth.user.role === 'receptionist' ? <ReceptionistPortal appState={appState} setAppState={setAppState} user={auth.user} /> : <Navigate to="/login" replace />} />
          <Route path="/401" element={<UnauthorizedPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="/500" element={<ServerErrorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}

function Loading() {
  return <PageLoader />;
}

function Home({ appState, setSelectedDepartment, setSelectedDoctor, auth }) {
  const departments = appState.departments;
  const doctors = appState.doctors;
  const navigate = useNavigate();
  const heroStats = useMemo(() => [
    { label: 'Waiting', value: Object.values(appState.queues).flat().filter((item) => item.status === 'Waiting').length, icon: Users },
    { label: 'In progress', value: Object.values(appState.queues).flat().filter((item) => item.status === 'In Consultation').length, icon: Activity },
    { label: 'Avg. consult', value: `${appState.config.averageConsultationTime}m`, icon: Clock3 },
  ], [appState.queues, appState.config.averageConsultationTime]);

  return (
    <div className="space-y-8">
      <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="grid gap-6 rounded-[40px] border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/70 to-emerald-950/40 p-8 shadow-2xl shadow-emerald-950/40 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-200">
            <Sparkles className="h-4 w-4" /> Premium queue orchestration for VPS Lakeshore Hospital, Kochi
          </div>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight text-white sm:text-5xl">Don't wait for your turn. Arrive for it.</h1>
          <p className="max-w-2xl text-lg text-slate-300">QueuePilot blends live queue signals, adaptive ETA predictions, and premium operations views to turn hospital waiting into a seamless experience at VPS Lakeshore Hospital.</p>
          <div className="flex flex-wrap gap-4">
            <Link to={auth.user ? '/patient' : '/register'} className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400">Start as Patient <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/receptionist-login" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-200 transition hover:bg-white/10">Receptionist Login</Link>
          </div>
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">Demo mode is ready with seeded departments, doctors, and queue data so judges can explore the experience immediately.</div>
        </div>
        <div className="space-y-4 rounded-[28px] border border-white/10 bg-slate-950/60 p-6 shadow-inner shadow-emerald-950/30">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">Live Queue Pulse</div>
            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">Live</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {heroStats.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-center justify-between">
                    <div className="text-2xl font-semibold text-white">{item.value}</div>
                    <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 p-2 text-emerald-200"><Icon className="h-4 w-4" /></div>
                  </div>
                  <div className="mt-1 text-sm text-slate-400">{item.label}</div>
                </div>
              );
            })}
          </div>
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">EMA remains the live prediction engine, while the platform is prepared for future ML models and richer confidence analytics.</div>
        </div>
      </motion.section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
          <div className="flex items-center gap-2 text-lg font-semibold"><LayoutDashboard className="h-5 w-5 text-emerald-300" /> Department coverage</div>
          <div className="mt-6 space-y-3">
            {departments.map((department) => (
              <button key={department.id} onClick={() => {
                setSelectedDepartment(department);
                if (auth.user) {
                  navigate(auth.user.role === 'receptionist' ? '/receptionist' : '/patient');
                } else {
                  navigate('/login');
                }
              }} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10">
                <div>
                  <div className="font-semibold text-white">{department.name}</div>
                  <div className="text-sm text-slate-400">{department.description}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-[28px] border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><Stethoscope className="h-5 w-5 text-emerald-300" /> Recommended doctors</div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {doctors.map((doctor) => (
              <button key={doctor.id} onClick={() => {
                setSelectedDoctor(doctor);
                const dept = departments.find(d => d.id === doctor.department);
                if (dept) setSelectedDepartment(dept);
                if (auth.user) {
                  navigate(auth.user.role === 'receptionist' ? '/receptionist' : '/patient');
                } else {
                  navigate('/login');
                }
              }} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-left transition hover:border-emerald-400/40 hover:bg-white/10">
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{doctor.name}</div>
                  <div className={`rounded-full px-2 py-1 text-xs font-medium ${doctor.status === 'Available' ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'}`}>{doctor.status}</div>
                </div>
                <div className="mt-2 text-sm text-slate-400">{doctor.specialization}</div>
                <div className="mt-4 flex items-center justify-between text-sm text-slate-300">
                  <span>₹{doctor.consultationFee} INR</span>
                  <span>{doctor.experience} yrs</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        {[
          { title: 'Live queue visibility', description: 'Patients and staff see status changes instantly without manual refreshes.' },
          { title: 'Adaptive predictions', description: 'EMA-powered forecasting keeps wait times transparent and actionable.' },
          { title: 'Professional operations', description: 'Receptionists manage doctors, queue flow, and settings from a single workspace.' },
        ].map((item) => (
          <div key={item.title} className="rounded-[24px] border border-white/10 bg-slate-900/70 p-6">
            <div className="text-lg font-semibold text-white">{item.title}</div>
            <p className="mt-2 text-sm text-slate-400">{item.description}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-center gap-2 text-lg font-semibold"><HeartPulse className="h-5 w-5 text-emerald-300" /> Why it stands out</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">QueuePilot is designed as a commercial-grade SaaS layer that can evolve from EMA predictions toward richer ML workflows without changing the existing API contract.</div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">The experience balances powerful backend orchestration with approachable UX so both judges and future customers can grasp value instantly.</div>
        </div>
      </section>
    </div>
  );
}

function Login({ setAuth }) {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const { register, handleSubmit } = useForm();
  const onSubmit = async (values) => {
    try {
      setErrorMsg('');
      const { data: response } = await api.post('/users/verify', { name: values.fullName, phone: values.phone });
      setToken(response?.data?.token ?? '');
      setAuth({ user: response?.data?.user ?? null, loading: false });
      if (response?.data?.travelData) {
        localStorage.setItem('queuepilot-travel-time', response.data.travelData.durationMinutes);
        localStorage.setItem('queuepilot-travel-distance', response.data.travelData.distance);
      }
      navigate('/patient');
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Unable to verify patient login');
    }
  };
  return (
    <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-emerald-950/40">
      <h2 className="text-3xl font-semibold text-white">Patient login</h2>
      <p className="mt-2 text-slate-400">Access your queue state, live ETA and notifications instantly.</p>
      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMsg}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <input {...register('fullName')} type="text" placeholder="Full name" required className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0" />
        <input {...register('phone')} type="text" placeholder="Phone number" required className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white outline-none ring-0" />
        <button className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">Continue</button>
      </form>
      <div className="mt-6 space-y-2 text-sm">
        <p className="text-slate-400 font-medium">Receptionist? <Link to="/receptionist-login" className="text-emerald-300 font-semibold">Go to Receptionist Login</Link></p>
      </div>
    </div>
  );
}

function ReceptionistLogin({ setAuth }) {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const { register, handleSubmit } = useForm();
  const onSubmit = async (values) => {
    try {
      setErrorMsg('');
      const { data: response } = await api.post('/auth/login', { ...values, role: 'receptionist' });
      setToken(response?.data?.token ?? '');
      setAuth({ user: response?.data?.user ?? null, loading: false });
      navigate('/receptionist');
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Unable to sign in as receptionist');
    }
  };
  return (
    <div className="mx-auto max-w-xl rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-emerald-950/40">
      <h2 className="text-3xl font-semibold text-white">Receptionist login</h2>
      <p className="mt-2 text-slate-400">Manage live queue flow, doctor availability and prediction settings.</p>
      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMsg}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
        <input {...register('email')} type="email" placeholder="Receptionist email" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <input {...register('password')} type="password" placeholder="Password" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <button className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">Secure sign in</button>
      </form>
      <div className="mt-6 text-sm">
        <p className="text-slate-400">Patient? <Link to="/login" className="text-emerald-300 font-medium">Go to Patient Login</Link></p>
      </div>
    </div>
  );
}

function Register() {
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const { register, handleSubmit } = useForm();
  const onSubmit = async (values) => {
    try {
      setErrorMsg('');
      setSuccessMsg('');
      await api.post('/auth/register', values);
      setSuccessMsg('Registration successful! Please log in.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || 'Unable to register');
    }
  };
  return (
    <div className="mx-auto max-w-2xl rounded-[32px] border border-white/10 bg-slate-900/70 p-8 shadow-2xl shadow-emerald-950/40">
      <h2 className="text-3xl font-semibold text-white">Register for QueuePilot</h2>
      <p className="mt-2 text-slate-400">Create a patient profile and join a medically guided queue in minutes.</p>
      {errorMsg && (
        <div className="mt-4 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="mt-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
          {successMsg}
        </div>
      )}
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-4 md:grid-cols-2">
        <input {...register('fullName')} placeholder="Full Name" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <input {...register('email')} type="email" placeholder="Email" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <input {...register('password')} type="password" placeholder="Password" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <input {...register('phone')} placeholder="Phone" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <input {...register('age')} type="number" placeholder="Age" className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <select {...register('gender')} className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
          <option value="">Gender</option>
          <option>Female</option>
          <option>Male</option>
          <option>Non-binary</option>
        </select>
        <input {...register('place')} placeholder="Place / City (e.g. Aluva, Tripunithura)" required className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
        <button className="md:col-span-2 rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">Create account</button>
      </form>
    </div>
  );
}

function PatientPortal({ appState, setAppState, selectedDoctor, setSelectedDepartment, selectedDepartment, user }) {
  const [selectedQueueDoctor, setSelectedQueueDoctor] = useState(selectedDoctor);
  const [message, setMessage] = useState('');
  const [tick, setTick] = useState(0);
  
  const storedTravelTime = localStorage.getItem('queuepilot-travel-time') ? Number(localStorage.getItem('queuepilot-travel-time')) : 15;
  const [travelTime, setTravelTime] = useState(storedTravelTime);
  const [confirmName, setConfirmName] = useState(user.fullName || '');
  const [confirmPhone, setConfirmPhone] = useState(user.phone || '');
  const [isJoining, setIsJoining] = useState(false);
  const [isStartingJourney, setIsStartingJourney] = useState(false);
  const [isMarkingArrived, setIsMarkingArrived] = useState(false);
  const [isEtaLoading, setIsEtaLoading] = useState(false);
  const [etaError, setEtaError] = useState(false);

  const [activeTokenId, setActiveTokenId] = useState(localStorage.getItem('queuepilot-active-token-id'));

  const myActiveEntry = useMemo(() => {
    if (!activeTokenId) return null;
    const allEntries = Object.values(appState.queues).flat();
    return allEntries.find((entry) => entry.id === activeTokenId);
  }, [appState.queues, activeTokenId]);

  useEffect(() => {
    if (myActiveEntry) {
      const doc = appState.doctors.find(d => d.id === (myActiveEntry.doctorId?._id || myActiveEntry.doctorId));
      if (doc) setSelectedQueueDoctor(doc);
    }
  }, [myActiveEntry, appState.doctors]);

  // Restore active token on mount
  useEffect(() => {
    if (activeTokenId && user) {
      api.get(`/queues/tokens/${activeTokenId}`).then(res => {
        const entry = res.data?.data?.entry || res.data?.data;
        if (entry) {
          const normalized = normalizeQueue([entry])[0];
          if (normalized) {
            setAppState(prev => {
              const docId = normalized.doctorId;
              const currentQueue = prev.queues[docId] || [];
              const exists = currentQueue.some(e => e.id === normalized.id);
              let newQueue = [...currentQueue];
              if (exists) {
                newQueue = newQueue.map(e => e.id === normalized.id ? normalized : e);
              } else {
                newQueue.push(normalized);
              }
              return {
                ...prev,
                queues: { ...prev.queues, [docId]: newQueue }
              };
            });
            const docId = normalized.doctorId;
            const docObj = appState.doctors.find(d => d.id === docId || d._id === docId);
            if (docObj) {
              setSelectedQueueDoctor(docObj);
              if (docObj.specialization) {
                setSelectedSpecialization(docObj.specialization);
              }
            }
          }
        } else {
          localStorage.removeItem('queuepilot-active-token-id');
          setActiveTokenId(null);
        }
      }).catch(err => {
        console.error('Error restoring active token:', err);
      });
    }
  }, [user, activeTokenId, appState.doctors]);

  // Load initial ETA
  useEffect(() => {
    if (!selectedQueueDoctor) return;
    const loadQueue = async () => {
      setIsEtaLoading(true);
      setEtaError(false);
      try {
        const { data: qRes } = await api.get(`/queues/eta/${selectedQueueDoctor.id}`);
        setAppState((prev) => ({
          ...prev,
          queues: {
            ...prev.queues,
            [selectedQueueDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
          }
        }));
      } catch (err) {
        console.warn('Initial ETA fetch error:', err);
        setEtaError(true);
      } finally {
        setIsEtaLoading(false);
      }
    };
    loadQueue();
  }, [selectedQueueDoctor?.id]);

  // Polling user dashboard queue state (15 seconds)
  useEffect(() => {
    if (!selectedQueueDoctor) return;
    const interval = setInterval(async () => {
      try {
        const { data: qRes } = await api.get(`/queues/eta/${selectedQueueDoctor.id}`);
        setAppState((prev) => ({
          ...prev,
          queues: {
            ...prev.queues,
            [selectedQueueDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
          }
        }));
        setEtaError(false);
      } catch (err) {
        console.warn('User dashboard polling error:', err);
        setEtaError(true);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [selectedQueueDoctor?.id]);

  const [selectedSpecialization, setSelectedSpecialization] = useState('');

  const availableSpecializations = useMemo(() => {
    const specs = new Set();
    appState.doctors.forEach(doc => {
      if (doc.status === 'Available' && doc.specialization) {
        specs.add(doc.specialization);
      }
    });
    return Array.from(specs);
  }, [appState.doctors]);

  const filteredDoctorsBySpecialization = useMemo(() => {
    return appState.doctors.filter(doc => doc.specialization === selectedSpecialization && doc.status === 'Available');
  }, [appState.doctors, selectedSpecialization]);

  const activeQueue = selectedQueueDoctor ? (appState.queues[selectedQueueDoctor.id] || []) : [];
  const liveEntry = activeQueue.find((entry) => !['COMPLETED', 'CANCELLED'].includes(entry.status)) || activeQueue[0] || null;
  
  const countdown = useMemo(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack) return 0;
    const estimated = Number(entryToTrack.remainingWaitingTime || entryToTrack.eta?.match(/\d+/)?.[0] || 0);
    return Math.max(0, estimated - tick);
  }, [myActiveEntry, liveEntry, tick]);

  const estimatedArrivalTimeStr = useMemo(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack || entryToTrack.eta === 'Paused' || entryToTrack.eta === 'Now') return entryToTrack?.eta || '--';
    const waitMin = Number(entryToTrack.remainingWaitingTime || 0);
    const arrivalTime = new Date(Date.now() + waitMin * 60 * 1000);
    return arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [myActiveEntry, liveEntry]);

  const estimatedWaitStr = useMemo(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack) return 'Calculating...';
    if (entryToTrack.eta === 'Calculating') return 'Calculating...';
    if (entryToTrack.eta === 'Error' || !entryToTrack.eta) return 'Estimate unavailable';
    return `${countdown} mins`;
  }, [myActiveEntry, liveEntry, countdown]);

  const expectedTurnWindowStr = useMemo(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack) return 'Calculating...';
    if (!entryToTrack.expectedTurnStart || !entryToTrack.expectedTurnEnd) return 'Calculating...';
    const start = new Date(entryToTrack.expectedTurnStart);
    const end = new Date(entryToTrack.expectedTurnEnd);
    const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${formatTime(start)} – ${formatTime(end)}`;
  }, [myActiveEntry, liveEntry]);

  const recommendedDepartureStr = useMemo(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack) return '--';
    if (!entryToTrack.recommendedDepartureTime) {
      if (entryToTrack.status === 'SMART_HOLD' || entryToTrack.status === 'SMART HOLD') {
        return 'Smart Hold';
      }
      return 'Calculating...';
    }
    const depTime = new Date(entryToTrack.recommendedDepartureTime);
    return depTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [myActiveEntry, liveEntry]);

  useEffect(() => {
    const entryToTrack = myActiveEntry || liveEntry;
    if (!entryToTrack) return;
    setTick(0);
    const timer = window.setInterval(() => {
      setTick((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [myActiveEntry?.id, liveEntry?.id]);

  const startJourney = async () => {
    if (!myActiveEntry || isStartingJourney) return;
    setIsStartingJourney(true);
    try {
      await api.patch(`/queues/tokens/${myActiveEntry.id}/start-journey`);
      setMessage('Journey started successfully! Recommendation: ON THE WAY.');
      setTimeout(() => setMessage(''), 3000);
      const { data: qRes } = await api.get(`/queues/eta/${selectedQueueDoctor.id}`);
      setAppState((prev) => ({
        ...prev,
        queues: {
          ...prev.queues,
          [selectedQueueDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
        }
      }));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to start journey');
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsStartingJourney(false);
    }
  };

  const markArrived = async () => {
    if (!myActiveEntry || isMarkingArrived) return;
    setIsMarkingArrived(true);
    try {
      await api.patch(`/queues/tokens/${myActiveEntry.id}/arrive`);
      setMessage("You've arrived. Please wait until you're called.");
      setTimeout(() => setMessage(''), 5000);
      const { data: qRes } = await api.get(`/queues/eta/${selectedQueueDoctor.id}`);
      setAppState((prev) => ({
        ...prev,
        queues: {
          ...prev.queues,
          [selectedQueueDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
        }
      }));
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to mark arrival');
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsMarkingArrived(false);
    }
  };

  const joinQueue = async () => {
    if (!selectedQueueDoctor || isJoining) return;
    setIsJoining(true);
    try {
      const { data: response } = await api.post('/queues/join', {
        doctorId: selectedQueueDoctor.id,
        travelTimeMinutes: Number(travelTime || 0)
      });
      const isDup = response?.duplicate || response?.data?.isDuplicate || response?.isDuplicate;
      const tokenObj = isDup ? (response?.data) : (response?.data?.entry);
      if (tokenObj) {
        const tokenId = tokenObj.id || tokenObj._id?.toString() || tokenObj._id;
        if (tokenId) {
          localStorage.setItem('queuepilot-active-token-id', tokenId);
          setActiveTokenId(tokenId);
        }
      }
      if (isDup) {
        setMessage("You already have an active token. Your queue dashboard has been restored.");
        setTimeout(() => setMessage(''), 5000);
      } else {
        const tokenNum = tokenObj?.tokenNumber ?? tokenObj?.token ?? 'pending';
        const formattedToken = tokenNum !== 'pending' ? 'A' + String(tokenNum).padStart(3, '0') : 'pending';
        setMessage(`Joined queue with token ${formattedToken}`);
        setTimeout(() => setMessage(''), 3000);
      }
      const { data: qRes } = await api.get(`/queues/eta/${selectedQueueDoctor.id}`);
      setAppState((prev) => ({
        ...prev,
        queues: {
          ...prev.queues,
          [selectedQueueDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
        }
      }));
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to join queue');
      setTimeout(() => setMessage(''), 5000);
    } finally {
      setIsJoining(false);
    }
  };

  const cancelQueue = async () => {
    const docId = myActiveEntry?.doctorId || selectedQueueDoctor?.id;
    if (!docId) return;
    try {
      await api.post(`/queues/cancel/${docId}`);
      setMessage('Queue entry cancelled');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to cancel');
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="space-y-6 rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-center gap-2 text-lg font-semibold"><Users className="h-5 w-5 text-emerald-300" /> Choose Specialization</div>
        <div className="space-y-2">
          {availableSpecializations.map((spec) => (
            <button key={spec} onClick={() => setSelectedSpecialization(spec)} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedSpecialization === spec ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
              <div className="font-semibold text-white">{spec}</div>
              <div className="text-xs text-slate-400">Available specialists ready</div>
            </button>
          ))}
          {availableSpecializations.length === 0 && (
            <div className="text-sm text-slate-400 py-4">No specialists are currently available. Please check back later.</div>
          )}
        </div>

        {selectedSpecialization && (
          <div className="mt-6 space-y-3 border-t border-white/10 pt-4">
            <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold mb-2">Available Doctors</div>
            {filteredDoctorsBySpecialization.map((doctor) => (
              <button key={doctor.id} onClick={() => setSelectedQueueDoctor(doctor)} className={`w-full rounded-2xl border p-4 text-left transition-all ${selectedQueueDoctor?.id === doctor.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{doctor.name}</div>
                  <div className="rounded-full px-2 py-1 text-xs font-medium bg-emerald-500/20 text-emerald-200">{doctor.status}</div>
                </div>
                <div className="mt-1 text-sm text-slate-400">{doctor.specialization}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Patient queue view</h2>
            <p className="mt-2 text-slate-400">Track your token, ETA and live updates without waiting in the lobby.</p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">Live</div>
        </div>
        {selectedQueueDoctor ? (
          <div className="mt-8 space-y-6">
                       {myActiveEntry && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-slate-950/70 p-6 shadow-xl shadow-emerald-950/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-300">Your Active Ticket ({user.fullName})</div>
                    <div className="mt-1 text-2xl font-bold text-white">Token {'A' + String(myActiveEntry.token || 1).padStart(3, '0')}</div>
                  </div>
                  <div className="rounded-full border border-emerald-400/30 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200">{formatStatus(myActiveEntry.status)}</div>
                </div>

                {selectedQueueDoctor?.sessionStatus === 'PAUSED' && (
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
                    ⚠️ Queue temporarily paused. Expected delay: {selectedQueueDoctor?.expectedPauseMinutes || 10} min
                  </div>
                )}

                <div className="mt-4 grid gap-3 grid-cols-2">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">Now Serving</div>
                    <div className="mt-1 text-sm font-bold text-white leading-tight">
                      {activeQueue.find(e => e.status === 'SERVING') 
                        ? 'A' + String(activeQueue.find(e => e.status === 'SERVING').token).padStart(3, '0')
                        : 'Waiting for next service'}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">Patients Ahead</div>
                    <div className="mt-1 text-lg font-bold text-white">{myActiveEntry.patientsAhead}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">ETA Wait Time</div>
                    <div className="mt-1 text-lg font-bold text-white">{estimatedWaitStr}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">Expected Turn Window</div>
                    <div className="mt-1 text-sm font-bold text-white leading-tight">{expectedTurnWindowStr}</div>
                    <div className="text-[9px] text-slate-400 mt-1">This estimate updates as the queue moves.</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">Average Service Time</div>
                    <div className="mt-1 text-lg font-bold text-white">{selectedQueueDoctor.averageConsultationTime || 8} mins</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3">
                    <div className="text-xs text-slate-400 font-medium">Recommended Departure</div>
                    <div className="mt-1 text-sm font-bold text-white leading-tight">{recommendedDepartureStr}</div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 col-span-2">
                    <div className="text-xs text-slate-400 font-medium">Your Travel Time</div>
                    <div className="mt-1 text-sm font-bold text-white">{myActiveEntry.travelTimeMinutes || 0} mins</div>
                  </div>
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 col-span-2">
                    <div className="text-xs text-slate-400 font-semibold mb-1">Departure Recommendation</div>
                    <div className="text-sm font-bold text-emerald-300 leading-tight">
                      {myActiveEntry.departureRecommendation === 'STAY' && "STAY: You have time. We'll let you know when it's time to prepare."}
                      {myActiveEntry.departureRecommendation === 'GET_READY' && "GET READY: Your turn is getting closer. Get ready to leave."}
                      {myActiveEntry.departureRecommendation === 'LEAVE_NOW' && "LEAVE NOW: It's time to start your journey."}
                      {myActiveEntry.departureRecommendation === 'AT_RISK' && "AT RISK: Your turn may arrive before you do. Leave as soon as possible."}
                      {(myActiveEntry.departureRecommendation === 'ON THE WAY' || myActiveEntry.departureRecommendation === 'ON_THE_WAY') && "ON THE WAY: You started travelling. Keep safe!"}
                      {myActiveEntry.departureRecommendation === 'ARRIVED' && "ARRIVED: You've arrived. Please wait until you're called."}
                      {(myActiveEntry.departureRecommendation === 'SMART HOLD' || myActiveEntry.departureRecommendation === 'SMART_HOLD') && "SMART HOLD: Held user. We will serve you at the next opportunity."}
                      {(myActiveEntry.departureRecommendation === 'NOW SERVING' || myActiveEntry.departureRecommendation === 'SERVING') && "NOW SERVING: It's your turn. Please enter the consultation room."}
                      {myActiveEntry.departureRecommendation === 'COMPLETED' && "COMPLETED: Service completed."}
                      {!['STAY', 'GET_READY', 'LEAVE_NOW', 'AT_RISK', 'ON THE WAY', 'ON_THE_WAY', 'ARRIVED', 'SMART HOLD', 'SMART_HOLD', 'NOW SERVING', 'SERVING', 'COMPLETED'].includes(myActiveEntry.departureRecommendation) && myActiveEntry.departureRecommendation}
                    </div>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-3 col-span-2">
                    <div className="text-xs text-slate-400">Prediction Confidence</div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        myActiveEntry.predictionConfidence === 'HIGH' ? 'bg-emerald-500/20 text-emerald-300' :
                        myActiveEntry.predictionConfidence === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-rose-500/20 text-rose-300'
                      }`}>{myActiveEntry.predictionConfidence || 'LOW'}</span>
                      <span className="text-[10px] text-slate-400">Confidence improves as more services are completed.</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-emerald-950/20">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.3em] text-slate-400">Selected doctor</div>
                  <div className="mt-2 text-xl font-semibold text-white">{selectedQueueDoctor.name}</div>
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">{selectedQueueDoctor.status}</div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  { label: 'Consultation fee', value: `₹${selectedQueueDoctor.consultationFee} INR` },
                  { label: 'Experience', value: `${selectedQueueDoctor.experience} yrs` },
                  { label: 'Prediction', value: `${selectedQueueDoctor.averageConsultationTime || 8}m EMA` },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <div className="text-xs text-slate-400">{item.label}</div>
                    <div className="mt-1 font-semibold text-white">{item.value}</div>
                  </div>
                ))}
              </div>
            </motion.div>

            {myActiveEntry ? (
              <div className="flex flex-wrap gap-3">
                {myActiveEntry.status === 'WAITING' && (
                  <button 
                    disabled={isStartingJourney} 
                    onClick={startJourney} 
                    className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isStartingJourney ? 'Starting...' : 'Start Journey'}
                  </button>
                )}
                {(myActiveEntry.status === 'IN_TRANSIT' || myActiveEntry.status === 'SMART_HOLD') && (
                  <button 
                    disabled={isMarkingArrived} 
                    onClick={markArrived} 
                    className="rounded-2xl bg-emerald-500 px-5 py-3 font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isMarkingArrived ? 'Arriving...' : "I've Arrived"}
                  </button>
                )}
                {myActiveEntry.status === 'ARRIVED' && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200 w-full text-center">
                    You've arrived. Please wait until you're called.
                  </div>
                )}
                {myActiveEntry.status === 'SERVING' && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200 w-full text-center font-bold">
                    It's your turn. Please enter the consultation room.
                  </div>
                )}
                {myActiveEntry.status === 'COMPLETED' && (
                  <div className="space-y-3 w-full">
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm text-emerald-200 w-full text-center font-medium">
                      Service completed.
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('queuepilot-active-token-id');
                        setActiveTokenId(null);
                      }} 
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition"
                    >
                      Dismiss & Book New Token
                    </button>
                  </div>
                )}
                {myActiveEntry.status === 'CANCELLED' && (
                  <div className="space-y-3 w-full">
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200 w-full text-center font-medium">
                      Token cancelled.
                    </div>
                    <button 
                      onClick={() => {
                        localStorage.removeItem('queuepilot-active-token-id');
                        setActiveTokenId(null);
                      }} 
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-xs text-slate-300 hover:bg-white/10 transition"
                    >
                      Dismiss & Book New Token
                    </button>
                  </div>
                )}
                {['WAITING', 'IN_TRANSIT', 'SMART_HOLD'].includes(myActiveEntry.status) && (
                  <button onClick={cancelQueue} className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-semibold text-slate-200 hover:bg-white/10 transition">Cancel Queue</button>
                )}
              </div>
            ) : (
              <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 space-y-4 w-full">
                <h3 className="text-lg font-semibold text-white">Join Queue Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Your Full Name</label>
                    <input type="text" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Phone Number</label>
                    <input type="text" value={confirmPhone} onChange={(e) => setConfirmPhone(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Estimated Travel Time (minutes)</label>
                    <input type="number" min="1" value={travelTime} onChange={(e) => setTravelTime(Number(e.target.value))} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-sm text-white" />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 pt-2">
                  <button 
                    disabled={isJoining} 
                    onClick={joinQueue} 
                    className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isJoining ? 'Joining...' : 'Confirm & Join Queue'}
                  </button>
                  <button onClick={cancelQueue} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-slate-200 hover:bg-white/10 transition">Cancel</button>
                </div>
              </div>
            )}

            {message && <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">{message}</div>}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-slate-950/20">
              <div className="flex items-center gap-2 text-lg font-semibold"><Clock3 className="h-5 w-5 text-emerald-300" /> Your queue state</div>
              <div className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-sm text-emerald-100">Estimated wait: {estimatedWaitStr}</div>
              <div className="mt-4 space-y-3">
                {activeQueue.length === 0 ? <EmptyState title="Queue is calm right now" description="Join the queue to see the live ETA and progress here." /> : activeQueue.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">Token {'A' + String(entry.token || 1).padStart(3, '0')}</div>
                        <div className="text-sm text-slate-400">{entry.patientName}</div>
                      </div>
                      <div className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">{formatStatus(entry.status)}</div>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-slate-300 md:grid-cols-3">
                      <div><span className="text-slate-400">ETA:</span> {entry.eta}</div>
                      <div><span className="text-slate-400">Ahead:</span> {entry.patientsAhead}</div>
                      <div><span className="text-slate-400">Leave:</span> {formatStatus(entry.departureRecommendation)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
             <div className="rounded-[28px] border border-white/10 bg-slate-950/70 p-6 shadow-xl shadow-slate-950/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg font-semibold"><MapPin className="h-5 w-5 text-emerald-300" /> Hospital route</div>
                <span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-0.5 text-xs text-slate-300">From: {user.place || 'Kochi'}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">Calculated driving route to VPS Lakeshore Hospital:</p>
              {localStorage.getItem('queuepilot-travel-distance') && (
                <div className="mt-3 flex gap-3 text-xs">
                  <div className="rounded-xl border border-white/5 bg-white/5 p-2 px-3">
                    <span className="text-slate-400">Google Distance:</span> <strong className="text-emerald-300">{localStorage.getItem('queuepilot-travel-distance')}</strong>
                  </div>
                  <div className="rounded-xl border border-white/5 bg-white/5 p-2 px-3">
                    <span className="text-slate-400">Travel Time:</span> <strong className="text-emerald-300">{localStorage.getItem('queuepilot-travel-time')} mins</strong>
                  </div>
                </div>
              )}
              <div className="mt-4">
                <Suspense fallback={<PageLoader />}>
                  <HospitalMap 
                    place={user.place || 'Kochi'} 
                    distance={localStorage.getItem('queuepilot-travel-distance') || '1.8 km'} 
                    duration={localStorage.getItem('queuepilot-travel-time') || '6'} 
                  />
                </Suspense>
              </div>
            </div>
          </div>
        ) : <div className="mt-8 rounded-[28px] border border-dashed border-white/10 p-8 text-slate-400">Select a department and doctor to see live queue and ETA data.</div>}
      </div>
    </div>
  );
}

function ReceptionistPortal({ appState, setAppState, user }) {
  const [doctorForm, setDoctorForm] = useState({ name: '', department: '', specialization: '', experience: '', consultationFee: '', status: 'Available' });
  const [selectedDoctor, setSelectedDoctor] = useState(appState.doctors[0] || null);
  const [isLoading, setIsLoading] = useState(false);

  // Search and Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [docFilter, setDocFilter] = useState('');

  const [message, setMessage] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);

  const showNotice = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 5000);
  };

  // Synchronize selectedDoctor from appState.doctors in case it updates
  useEffect(() => {
    if (selectedDoctor) {
      const match = appState.doctors.find(d => d.id === selectedDoctor.id);
      if (match) setSelectedDoctor(match);
    }
  }, [appState.doctors, selectedDoctor?.id]);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const { data: response } = await api.get('/queues/analytics');
        setAppState((prev) => ({ ...prev, metrics: response?.data?.metrics ?? null }));
      } catch {
        // ignore analytics failures
      }
    };
    loadMetrics();
  }, [setAppState]);

  // Polling for Receptionist Dashboard (10 seconds)
  useEffect(() => {
    if (!selectedDoctor) return;
    const interval = setInterval(async () => {
      try {
        const [{ data: docRes }, { data: qRes }] = await Promise.all([
          api.get('/doctors'),
          api.get(`/queues/eta/${selectedDoctor.id}`)
        ]);
        setAppState((prev) => ({
          ...prev,
          doctors: docRes.data?.doctors || docRes.data || prev.doctors,
          queues: {
            ...prev.queues,
            [selectedDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data)
          }
        }));
      } catch (err) {
        console.warn('Receptionist polling error:', err);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [selectedDoctor?.id]);

  const addDoctor = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    try {
      const { data: response } = await api.post('/doctors', { ...doctorForm, experience: Number(doctorForm.experience), consultationFee: Number(doctorForm.consultationFee) });
      const doctorPayloadRaw = response?.data?.doctor ?? response?.data ?? null;
      const doctorPayload = doctorPayloadRaw ? { ...doctorPayloadRaw, id: doctorPayloadRaw.id || doctorPayloadRaw._id?.toString() || doctorPayloadRaw._id } : null;
      setAppState((prev) => ({ ...prev, doctors: [...prev.doctors, doctorPayload] }));
      setDoctorForm({ name: '', department: '', specialization: '', experience: '', consultationFee: '', status: 'Available' });
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to add doctor');
    } finally {
      setIsLoading(false);
    }
  };

  const changeDoctorStatus = async (doctorId, status) => {
    const { data: response } = await api.post(`/doctors/${doctorId}/status`, { status });
    const doctorPayloadRaw = response?.data?.doctor ?? response?.data ?? null;
    const doctorPayload = doctorPayloadRaw ? { ...doctorPayloadRaw, id: doctorPayloadRaw.id || doctorPayloadRaw._id?.toString() || doctorPayloadRaw._id } : null;
    setAppState((prev) => ({ ...prev, doctors: prev.doctors.map((doctor) => (doctor.id === doctorId ? doctorPayload : doctor)) }));
  };

  // Receptionist APIs
  const pauseSession = async (doctorId, expectedMinutes) => {
    try {
      await api.patch(`/queues/sessions/${doctorId}/pause`, { expectedPauseMinutes: expectedMinutes });
      const [{ data: docRes }, { data: qRes }] = await Promise.all([
        api.get('/doctors'),
        api.get(`/queues/eta/${doctorId}`)
      ]);
      setAppState((prev) => ({
        ...prev,
        doctors: docRes.data?.doctors || docRes.data || prev.doctors,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to pause queue');
    }
  };

  const resumeSession = async (doctorId) => {
    try {
      await api.patch(`/queues/sessions/${doctorId}/resume`);
      const [{ data: docRes }, { data: qRes }] = await Promise.all([
        api.get('/doctors'),
        api.get(`/queues/eta/${doctorId}`)
      ]);
      setAppState((prev) => ({
        ...prev,
        doctors: docRes.data?.doctors || docRes.data || prev.doctors,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to resume queue');
    }
  };

  const endSession = async (doctorId) => {
    if (!window.confirm('Are you sure you want to end this session? No new tokens will be allowed.')) return;
    try {
      await api.patch(`/queues/sessions/${doctorId}/end`);
      const { data: docRes } = await api.get('/doctors');
      setAppState((prev) => ({
        ...prev,
        doctors: docRes.data?.doctors || docRes.data || prev.doctors
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to end session');
    }
  };

  const startService = async (tokenId, doctorId) => {
    try {
      await api.patch(`/queues/tokens/${tokenId}/start-service`);
      const { data: qRes } = await api.get(`/queues/eta/${doctorId}`);
      setAppState((prev) => ({
        ...prev,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to start service');
    }
  };

  const completeService = async (tokenId, doctorId) => {
    try {
      await api.patch(`/queues/tokens/${tokenId}/complete`);
      const { data: qRes } = await api.get(`/queues/eta/${doctorId}`);
      setAppState((prev) => ({
        ...prev,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to complete service');
    }
  };

  const completeAndNext = async (doctorId) => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    const doctorQueue = appState.queues[doctorId] || [];
    const activeEntries = doctorQueue.filter(p => ['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD'].includes(p.status));
    
    // Check if next is still travelling and prompt reorder
    if (activeEntries.length > 1) {
      const first = activeEntries[0];
      const second = activeEntries[1];
      if (first.status === 'IN_TRANSIT') {
        const confirmReorder = window.confirm(`Patient Token ${'A' + String(first.token).padStart(3, '0')} is still travelling. Move Token ${'A' + String(second.token).padStart(3, '0')} ahead?`);
        if (confirmReorder) {
          try {
            await api.post(`/queues/reorder/${doctorId}`);
          } catch (reorderErr) {
            console.warn('Reorder failed:', reorderErr.message);
          }
        }
      }
    }

    try {
      const { data: response } = await api.post(`/queues/next/${doctorId}`);
      if (response?.data?.next) {
        // Next service successfully started
      } else {
        showNotice('No arrived users ready to serve.');
      }
      const { data: qRes } = await api.get(`/queues/eta/${doctorId}`);
      setAppState((prev) => ({
        ...prev,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to process Complete & Next');
    } finally {
      setIsAdvancing(false);
    }
  };

  const placeSmartHold = async (tokenId, doctorId) => {
    try {
      await api.patch(`/queues/tokens/${tokenId}/smart-hold`);
      const { data: qRes } = await api.get(`/queues/eta/${doctorId}`);
      setAppState((prev) => ({
        ...prev,
        queues: { ...prev.queues, [doctorId]: normalizeQueue(qRes.data?.queue || qRes.data) }
      }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to place on Smart Hold');
    }
  };

  const updateConfig = async () => {
    try {
      const { data: response } = await api.post('/config', { averageConsultationTime: appState.config.averageConsultationTime });
      setAppState((prev) => ({ ...prev, config: response?.data ?? prev.config }));
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to update config');
    }
  };

  const skipPatient = async (entryId) => {
    try {
      await api.post(`/queues/skip/${entryId}`);
      if (selectedDoctor) {
        const { data: qRes } = await api.get(`/queues/eta/${selectedDoctor.id}`);
        setAppState((prev) => ({
          ...prev,
          queues: { ...prev.queues, [selectedDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data) }
        }));
      }
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to skip patient');
    }
  };

  const markArrived = async (entryId) => {
    try {
      await api.patch(`/queues/tokens/${entryId}/arrive`);
      if (selectedDoctor) {
        const { data: qRes } = await api.get(`/queues/eta/${selectedDoctor.id}`);
        setAppState((prev) => ({
          ...prev,
          queues: { ...prev.queues, [selectedDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data) }
        }));
      }
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to mark patient as arrived');
    }
  };

  const cancelPatient = async (entryId) => {
    try {
      await api.post(`/queues/status/${entryId}`, { status: 'CANCELLED' });
      if (selectedDoctor) {
        const { data: qRes } = await api.get(`/queues/eta/${selectedDoctor.id}`);
        setAppState((prev) => ({
          ...prev,
          queues: { ...prev.queues, [selectedDoctor.id]: normalizeQueue(qRes.data?.queue || qRes.data) }
        }));
      }
    } catch (error) {
      showNotice(error.response?.data?.message || 'Unable to cancel patient');
    }
  };

  const filteredQueue = useMemo(() => {
    let entries = [];
    if (selectedDoctor && !docFilter) {
      entries = appState.queues[selectedDoctor.id] || [];
    } else {
      entries = Object.values(appState.queues).flat();
    }
    
    return entries.filter((entry) => {
      const patientNameMatch = entry.patientName?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const doctorIdVal = entry.doctorId?._id || entry.doctorId;
      const doctorObj = appState.doctors.find(d => d.id === (doctorIdVal ? doctorIdVal.toString() : ''));
      const doctorNameMatch = doctorObj?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const deptObj = doctorObj ? appState.departments.find(d => d.id === doctorObj.department) : null;
      const deptNameMatch = deptObj?.name?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const tokenMatch = entry.token?.toString().includes(searchQuery);
      const statusMatch = entry.status?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesSearch = !searchQuery || patientNameMatch || doctorNameMatch || deptNameMatch || tokenMatch || statusMatch;
      const matchesStatus = !statusFilter || entry.status === statusFilter;
      const matchesDoctor = !docFilter || (entry.doctorId?._id || entry.doctorId || '').toString() === docFilter;
      const matchesDept = !deptFilter || doctorObj?.department === deptFilter;
      
      return matchesSearch && matchesStatus && matchesDoctor && matchesDept;
    });
  }, [appState.queues, appState.doctors, appState.departments, selectedDoctor, searchQuery, statusFilter, docFilter, deptFilter]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white">Receptionist operation center</h2>
            <p className="mt-2 text-slate-400">Coordinate doctors, queue progression and adaptive prediction settings from one screen.</p>
          </div>
          <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-200">Secure</div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6 rounded-[32px] border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><ShieldCheck className="h-5 w-5 text-emerald-300" /> Doctor management</div>
          <form onSubmit={addDoctor} className="space-y-3">
            <input value={doctorForm.name} onChange={(event) => setDoctorForm({ ...doctorForm, name: event.target.value })} placeholder="Doctor name" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
            <select value={doctorForm.department} onChange={(event) => setDoctorForm({ ...doctorForm, department: event.target.value })} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white">
              <option value="">Select department</option>
              {appState.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
            <input value={doctorForm.specialization} onChange={(event) => setDoctorForm({ ...doctorForm, specialization: event.target.value })} placeholder="Specialization" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
            <input value={doctorForm.experience} onChange={(event) => setDoctorForm({ ...doctorForm, experience: event.target.value })} placeholder="Experience years" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
            <input value={doctorForm.consultationFee} onChange={(event) => setDoctorForm({ ...doctorForm, consultationFee: event.target.value })} placeholder="Consultation fee" className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-white" />
            <button className="w-full rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950">{isLoading ? 'Saving…' : 'Add doctor'}</button>
          </form>
          <div className="space-y-3">
            {appState.doctors.map((doctor) => (
              <button key={doctor.id} onClick={() => setSelectedDoctor(doctor)} className={`w-full rounded-2xl border p-4 text-left ${selectedDoctor?.id === doctor.id ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold text-white">{doctor.name}</div>
                  <div className="rounded-full px-2 py-1 text-xs font-medium text-emerald-200">{doctor.status}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        <div className="space-y-6 rounded-[32px] border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center gap-2 text-lg font-semibold"><BellRing className="h-5 w-5 text-emerald-300" /> Queue orchestration</div>
          
          {/* Search and Filters Bar */}
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, doctor, status..." className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs text-white" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs text-white">
              <option value="">All Statuses</option>
              <option value="WAITING">Waiting</option>
              <option value="IN_TRANSIT">Travelling</option>
              <option value="ARRIVED">Arrived</option>
              <option value="SMART_HOLD">Smart Hold</option>
              <option value="SERVING">Now Serving</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
            <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs text-white">
              <option value="">All Departments</option>
              {appState.departments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
            </select>
            <select value={docFilter} onChange={(e) => setDocFilter(e.target.value)} className="w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-2 text-xs text-white">
              <option value="">All Doctors</option>
              {appState.doctors.map(doc => <option key={doc.id} value={doc.id}>{doc.name}</option>)}
            </select>
          </div>

          {selectedDoctor && (
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <div className="text-xl font-semibold text-white">{selectedDoctor.name}</div>
                  <div className="text-sm text-slate-400">
                    {appState.departments.find((department) => department.id === selectedDoctor.department)?.name || 'Department'}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Session Status:</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      selectedDoctor.sessionStatus === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-300' :
                      selectedDoctor.sessionStatus === 'PAUSED' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-rose-500/20 text-rose-300'
                    }`}>{selectedDoctor.sessionStatus || 'ACTIVE'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedDoctor.sessionStatus !== 'PAUSED' && selectedDoctor.sessionStatus !== 'ENDED' && (
                    <button onClick={() => {
                      const mins = prompt('Enter expected break duration in minutes:', '10');
                      if (mins) pauseSession(selectedDoctor.id, mins);
                    }} className="rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-500/35">Pause Queue</button>
                  )}
                  {selectedDoctor.sessionStatus === 'PAUSED' && (
                    <button onClick={() => resumeSession(selectedDoctor.id)} className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/35">Resume Queue</button>
                  )}
                  {selectedDoctor.sessionStatus !== 'ENDED' && (
                    <button onClick={() => endSession(selectedDoctor.id)} className="rounded-full bg-rose-500/20 px-3 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/35">End Session</button>
                  )}
                </div>
              </div>

              {message && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200">
                  {message}
                </div>
              )}

              {filteredQueue.find(e => e.status === 'SERVING') ? (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-emerald-200 font-semibold">
                  ⚡ Currently Serving: Token {'A' + String(filteredQueue.find(e => e.status === 'SERVING').token).padStart(3, '0')} ({filteredQueue.find(e => e.status === 'SERVING').patientName})
                </div>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400 font-medium">
                  Waiting for next service
                </div>
              )}

              {selectedDoctor.sessionStatus === 'PAUSED' && (
                <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-200 text-center font-bold">
                  ⚠️ Queue temporarily paused. Expected delay: {selectedDoctor.expectedPauseMinutes} minutes.
                </div>
              )}

              {selectedDoctor.sessionStatus === 'ENDED' ? (
                <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 text-sm text-rose-200 text-center">
                  This session has ended. No new patient tokens can be joined.
                </div>
              ) : (
                <div className="flex gap-3">
                  <button 
                    disabled={isAdvancing} 
                    onClick={() => completeAndNext(selectedDoctor.id)} 
                    className="rounded-2xl bg-emerald-500 px-4 py-3 font-semibold text-slate-950 hover:bg-emerald-400 transition disabled:opacity-50"
                  >
                    {isAdvancing ? 'Processing...' : 'Complete & Next'}
                  </button>
                </div>
              )}

              <div className="mt-5 space-y-3 pt-4 border-t border-white/10">
                {filteredQueue.map((entry) => {
                  const formattedTok = 'A' + String(entry.token || 1).padStart(3, '0');
                  const isAnyServing = filteredQueue.some(e => e.status === 'SERVING');
                  return (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="font-semibold text-white">Token {formattedTok} • {entry.patientName}</div>
                          <div className="text-xs text-slate-400">
                            Status: <span className="font-medium text-emerald-300">{entry.status}</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-emerald-200 mr-2">{entry.eta}</span>
                          {entry.status === 'ARRIVED' && !isAnyServing && (
                            <button onClick={() => startService(entry.id, selectedDoctor.id)} className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-300/35">Start Service</button>
                          )}
                          {entry.status === 'IN_TRANSIT' && (
                            <button onClick={() => placeSmartHold(entry.id, selectedDoctor.id)} className="rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-200 hover:bg-amber-300/35">Smart Hold</button>
                          )}
                          {entry.status === 'SERVING' && (
                            <button onClick={() => completeService(entry.id, selectedDoctor.id)} className="rounded-full bg-emerald-500 px-2.5 py-1 text-xs font-semibold text-slate-950 hover:bg-emerald-400">Complete</button>
                          )}
                          {['WAITING', 'IN_TRANSIT', 'ARRIVED', 'SMART_HOLD'].includes(entry.status) && (
                            <>
                              <button onClick={() => skipPatient(entry.id)} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700">Skip</button>
                              <button onClick={() => cancelPatient(entry.id)} className="rounded-full bg-rose-500/20 px-2.5 py-1 text-xs font-semibold text-rose-200 hover:bg-rose-500/35">Cancel</button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredQueue.length === 0 && (
                  <div className="text-center py-6 text-sm text-slate-400">No matching queue entries found.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-[32px] border border-white/10 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/20">
        <div className="flex items-center gap-2 text-lg font-semibold"><TimerReset className="h-5 w-5 text-emerald-300" /> Realtime analytics</div>
        <div className="mt-6">
          <AnalyticsPanel metrics={appState.metrics} config={appState.config} />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: 'Today patients', value: appState.metrics?.todayPatients ?? 0 },
            { label: 'Waiting patients', value: appState.metrics?.waitingPatients ?? 0 },
            { label: 'Completed consults', value: appState.metrics?.completedConsultations ?? 0 },
            { label: 'Cancelled patients', value: appState.metrics?.cancelledPatients ?? 0 },
            { label: 'Avg consult time', value: `${appState.metrics?.averageConsultationTime ?? appState.config.averageConsultationTime}m` },
            { label: 'Avg wait time', value: `${appState.metrics?.averageWaitingTime ?? 0}m` },
            { label: 'Doctors available', value: appState.metrics?.doctorsAvailable ?? 0 },
            { label: 'Doctors on break', value: appState.metrics?.doctorsOnBreak ?? 0 },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="text-sm text-slate-400">{item.label}</div>
              <div className="mt-2 text-2xl font-semibold text-white">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default App;
