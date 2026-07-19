export default function HospitalMap({ place = 'Kochi', distance = '1.8 km', duration = '6' }) {
  const patientPlace = place + ', Kochi, Kerala, India';
  return (
    <div className="relative mt-4 overflow-hidden rounded-[24px] border border-white/10 shadow-lg shadow-slate-950/40">
      {/* Route Info Overlay */}
      <div className="absolute right-3 top-3 z-[10] rounded-2xl border border-emerald-400/20 bg-slate-950/90 p-3 shadow-xl backdrop-blur-sm">
        <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Live Google Navigation</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="text-lg font-bold text-emerald-400">{distance}</span>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-sm font-semibold text-white">{duration} mins</span>
        </div>
        <div className="mt-1 text-[10px] text-emerald-200/70 font-medium">From: {place}</div>
      </div>

      <iframe
        width="100%"
        height="280"
        style={{ 
          border: 0, 
          display: 'block',
          width: '100%',
          height: '280px',
          borderRadius: '16px'
        }}
        loading="lazy"
        allowFullScreen
        src={`https://maps.google.com/maps?q=${encodeURIComponent(patientPlace)}+to+VPS+Lakeshore+Hospital+Kochi&output=embed`}
      ></iframe>
    </div>
  );
}
