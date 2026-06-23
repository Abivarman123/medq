"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Bell,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Loader2,
  Printer,
  Stethoscope
} from "lucide-react";

// Lazy load QRCodeSVG to reduce initial bundle size
const QRCodeSVG = dynamic(() => import("qrcode.react").then(mod => mod.QRCodeSVG), {
  loading: () => <div className="w-[110px] h-[110px] bg-slate-200 rounded-lg animate-pulse" />,
  ssr: false
});

function getOrdinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function PatientQueueCard() {
  const params = useParams();
  const router = useRouter();
  const code = (params.code as string)?.toUpperCase();

  // Real-time subscription to the patient's queue status!
  const statusData = useQuery(api.queues.getPatientLiveStatus, { tokenCode: code });
  
  // Mutation to save email alerts
  const saveEmailAlert = useMutation(api.queues.updatePatientEmail);

  const [emailInput, setEmailInput] = useState("");
  const [emailSaved, setEmailSaved] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim() || !emailInput.includes("@")) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    if (!statusData || !statusData.entry) return;

    setEmailError("");
    setSaveLoading(true);

    try {
      await saveEmailAlert({
        entryId: statusData.entry.id,
        email: emailInput.trim(),
      });
      setEmailSaved(true);
    } catch (err) {
      console.error(err);
      setEmailError("Failed to save email for queue notifications.");
    } finally {
      setSaveLoading(false);
    }
  };


  // Loading state
  if (statusData === undefined) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center p-4">
        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-sm w-full flex flex-col items-center gap-4 text-center">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin" />
          <div>
            <h3 className="font-extrabold text-slate-800 text-lg">Loading Queue Card...</h3>
            <p className="text-xs text-slate-400 mt-1">Connecting to hospital live stream...</p>
          </div>
        </div>
      </div>
    );
  }

  // Token not found state
  if (statusData.error || !statusData.entry) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 items-center justify-center p-4">
        <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-8 max-w-md w-full flex flex-col items-center gap-6 text-center animate-slide-in">
          <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-xl">Queue Code Not Found</h3>
            <p className="text-sm text-slate-500 mt-2">
              We couldn&apos;t find active queue entry with code <strong className="text-slate-800 font-mono">{code}</strong>.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Note: Queue codes automatically expire at the end of each clinic day.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={() => router.push("/")}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-xl transition text-sm cursor-pointer"
            >
              Go to Homepage
            </button>
            <button
              onClick={() => router.push("/checkin")}
              className="w-full border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold py-3 rounded-xl transition text-sm cursor-pointer"
            >
              Check-In / Join Queue
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { entry, doctor, liveStats } = statusData;
  const isWaiting = entry.status === "waiting";
  const isCalled = entry.status === "called";
  const isArrived = entry.status === "arrived";
  const isConsulting = entry.status === "in_consultation";
  const isDone = entry.status === "done";
  const isSkipped = entry.status === "skipped";

  // Quick clinical colors
  const statusLabel = 
    isWaiting ? "In Queue - Waiting" :
    isCalled ? "Called - Please enter room!" :
    isArrived ? "Arrived - Waiting inside room" :
    isConsulting ? "In Consultation" :
    isDone ? "Completed Visit" : "Skipped";

  const statusBg = 
    isWaiting ? "bg-slate-100 text-slate-700" :
    isCalled ? "bg-amber-100 text-amber-800 border border-amber-200" :
    isArrived ? "bg-indigo-50 text-indigo-700 border border-indigo-100" :
    isConsulting ? "bg-emerald-50 text-emerald-800 border border-emerald-100" :
    isDone ? "bg-teal-50 text-teal-800" : "bg-rose-50 text-rose-800";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-4 sticky top-0 z-40 no-print">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <button 
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Exit Portal
          </button>
          
          <div />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow max-w-4xl mx-auto px-4 py-8 w-full flex flex-col gap-6">
        
        {/* Top Info Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center text-teal-600 border border-slate-100">
              <User className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xs text-slate-400 font-bold block uppercase tracking-wider">Patient Name</span>
              <h2 className="font-extrabold text-slate-800 text-lg leading-tight">{entry.patientName}</h2>
              {entry.appointmentNumber && (
                <p className="text-xs text-slate-500 mt-1 font-mono">
                  Confirmation {entry.appointmentNumber}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block sm:text-right">Live Status</span>
            <div className={`px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${statusBg}`}>
              {statusLabel}
            </div>
          </div>
        </div>

        {/* Real-time Wait Card Grid */}
        <div className="grid md:grid-cols-12 gap-6">
          
          {/* Main Large Wait Card */}
          <div className="md:col-span-7 bg-white border border-slate-200 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col justify-between gap-6 relative overflow-hidden">
            {/* Live Indicator Dot */}
            <span className="absolute top-4 right-4 flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1 rounded-full text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping-slow" />
              Live Track
            </span>

            <div>
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider block">Your Live Queue Position</span>
              
              {isDone || isSkipped ? (
                <div className="flex items-center gap-2 py-4">
                  <CheckCircle2 className="w-12 h-12 text-teal-600" />
                  <span className="text-3xl font-extrabold text-slate-800">Visit Finalized</span>
                </div>
              ) : isConsulting ? (
                <div className="flex items-center gap-3 py-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center animate-pulse border border-emerald-100">
                    <Stethoscope className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-2xl font-black text-emerald-800">You are in the room</span>
                    <p className="text-xs text-slate-500 mt-0.5">Your consultation with {doctor.name} is in progress.</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline gap-2 py-4">
                  <span className="text-7xl font-black text-slate-900 tracking-tight font-mono">
                    #{liveStats.currentPosition}
                  </span>
                  <span className="text-sm text-slate-400 font-bold">
                    out of {liveStats.totalActiveQueue} active patients
                  </span>
                </div>
              )}
            </div>

            {/* Wait time display */}
            {!isDone && !isSkipped && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 flex flex-col gap-1.5">
                <span className="text-xs text-slate-400 font-black uppercase tracking-wider block">Estimated Waiting Time</span>
                <div className="text-2xl font-black text-teal-600 flex items-center gap-2">
                  <Clock className="w-6 h-6 text-teal-600 animate-pulse" />
                  {liveStats.currentPosition === 1 ? "You are next! Please enter" : liveStats.estimatedWaitRange}
                </div>
                <p className="text-[10px] text-slate-400 leading-normal font-semibold">
                  This estimation dynamically auto-corrects based on doctor&apos;s consultation pace.
                </p>
              </div>
            )}

            {/* Doctor info snippet */}
            <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-sm text-slate-500 font-semibold">
              <div className="flex items-center gap-2">
                <Image
                  src="/favicon.ico"
                  alt="MedQ Logo"
                  width={32}
                  height={32}
                  className="rounded-lg"
                />
                <div>
                  <span className="text-[9px] text-slate-400 block -mb-0.5">DOCTOR</span>
                  <span className="text-slate-800 text-xs font-bold">{doctor.name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 block -mb-0.5">LOCATION</span>
                  <span className="text-slate-800 text-xs font-bold">{doctor.room}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Email Notification & Receipt Side Panel */}
          <div className="md:col-span-5 flex flex-col gap-6">
            
            {/* Email Alerts Form */}
            {!isDone && !isSkipped && (
              <div className="bg-white border border-slate-200 shadow-lg rounded-2xl p-6 flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-teal-50 text-teal-600 rounded-lg flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm">Free Email Waiting Alerts</h3>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  Head to the cafeteria or grab a coffee. We&apos;ll drop a clinic notification straight into your email inbox when you are only <strong>2 patients away</strong>!
                </p>

                {emailSaved || entry.emailNotificationSent ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center gap-2 text-emerald-800">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span className="text-xs font-bold">Alert configured! Check your inbox when you&apos;re 2 away.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveEmail} className="flex flex-col gap-3">
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        placeholder="patient@example.com"
                        className="w-full bg-slate-50 border border-slate-200 pl-10 pr-3 py-2.5 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                        required
                      />
                    </div>
                    {emailError && <p className="text-[10px] text-rose-500 font-bold">{emailError}</p>}
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl transition text-xs cursor-pointer disabled:opacity-50"
                    >
                      {saveLoading ? "Setting alert..." : "Set Wait Alert"}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* Receipt QR Code Box */}
            <div className="bg-white border border-slate-200 shadow-lg rounded-2xl p-6 flex flex-col items-center text-center gap-4">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Your Receipt Token Code</span>
              <span className="text-3xl font-black text-slate-800 font-mono tracking-widest -mt-2">{entry.tokenCode}</span>

              {/* QR Code */}
              <div className="qr-surface bg-white p-3 border border-slate-100 rounded-xl flex flex-col items-center gap-1.5 shadow-sm">
                <QRCodeSVG
                  value={`${process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "")}/q/${entry.tokenCode}`}
                  size={110}
                  level="H"
                />
                <span className="text-[9px] text-slate-400 font-bold uppercase">Scan to sync instantly</span>
              </div>

              <div className="flex gap-2 w-full no-print">
                <button
                  onClick={() => window.print()}
                  className="w-full border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Live Queue Progress Flow */}
        {!isDone && !isSkipped && (
          <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-6 flex flex-col gap-6">
            <h3 className="font-bold text-slate-800 text-sm">Real-time Clinic Activity</h3>
            
            <div className="flex flex-col gap-4 border-l-2 border-slate-100 pl-5 ml-2.5">
              
              {/* Doctor Consulting Status */}
              <div className="relative">
                <span className={`absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                  liveStats.currentlyConsultingName ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                }`} />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Doctor Consultation Room</h4>
                {liveStats.currentlyConsultingName ? (
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-xs text-slate-500">
                      Currently seeing: <strong className="text-slate-800 font-extrabold">{liveStats.currentlyConsultingName}</strong>
                    </p>
                    {liveStats.currentlyConsultingNumber && (
                      <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                        {getOrdinal(liveStats.currentlyConsultingNumber)} Patient Today
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5 italic">Consultation room currently idle</p>
                )}
              </div>

              {/* Patient Alert called status */}
              <div className="relative mt-2">
                <span className={`absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                  liveStats.currentlyCallingToken ? "bg-amber-500 animate-pulse" : "bg-slate-300"
                }`} />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Next Calling Patient</h4>
                {liveStats.currentlyCallingToken ? (
                  <p className="text-xs text-slate-500 mt-0.5">
                    Assisted to desk: <strong className="text-slate-800 font-mono tracking-widest">{liveStats.currentlyCallingToken}</strong>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400 mt-0.5">No immediate patient called</p>
                )}
              </div>

              {/* Patient's Position */}
              <div className="relative mt-2">
                <span className="absolute -left-[30px] top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center bg-teal-500" />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">Your Position</h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  You are positioned <strong className="text-teal-600 font-extrabold">#{liveStats.currentPosition}</strong> in today&apos;s tracking list
                  {liveStats.yourCheckInNumber && (
                    <span> (you were the <strong className="text-slate-700 font-bold">{getOrdinal(liveStats.yourCheckInNumber)}</strong> check-in today)</span>
                  )}
                  .
                </p>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
