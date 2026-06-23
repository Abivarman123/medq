"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { api } from "../../../../convex/_generated/api";
import {
  ArrowLeft,
  Users,
  Volume2,
  UserMinus,
  Play,
  Check,
  RefreshCw,
  Plus,
  Mail,
  Stethoscope,
  Wand2,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ActiveQueue = {
  doctorId: Id<"doctors">;
  queueId: Id<"queues">;
};

export default function StaffDashboard() {
  const router = useRouter();

  const doctors = useQuery(api.doctors.list);
  const seedMockQueue = useMutation(api.seed.seedMockQueue);
  const clearTodayQueues = useMutation(api.seed.clearTodayQueues);

  const getOrCreateQueue = useMutation(api.queues.getOrCreateQueue);
  const updateStatus = useMutation(api.queues.updateEntryStatus);
  const updateDocStatus = useMutation(api.doctors.updateStatus);
  const toggleQueueOpen = useMutation(api.queues.toggleQueueOpen);
  const checkInMutation = useMutation(api.queues.checkIn);

  const sendEmailAlertAction = useAction(api.notifications.sendQueueAlertEmail);
  const sendCalledEmailAction = useAction(api.notifications.sendCalledEmail);

  const [selectedDoctorId, setSelectedDoctorId] = useState<Id<"doctors"> | "">("");
  const [activeQueue, setActiveQueue] = useState<ActiveQueue | null>(null);
  const [isMockSeeding, setIsMockSeeding] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [seedToast, setSeedToast] = useState("");

  // Tracks entry IDs that have already had an email dispatch in this browser session
  // so a Convex subscription re-render cannot fire duplicate emails.
  const dispatchedEmailsRef = useRef<Set<string>>(new Set());

  const [newPatientName, setNewPatientName] = useState("");
  const [newPatientEmail, setNewPatientEmail] = useState("");
  const [newPatientPhone, setNewPatientPhone] = useState("");
  const [newPatientDate, setNewPatientDate] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [walkInError, setWalkInError] = useState("");

  const todayStr = new Date().toISOString().split("T")[0];
  const activeDoctor = doctors?.find((d) => d._id === selectedDoctorId);
  const activeQueueId =
    activeQueue?.doctorId === selectedDoctorId ? activeQueue.queueId : null;

  useEffect(() => {
    if (!selectedDoctorId) return;
    let shouldUpdate = true;
    const loadQueue = async () => {
      const qId = await getOrCreateQueue({
        doctorId: selectedDoctorId,
        date: todayStr,
      });
      if (shouldUpdate) {
        setActiveQueue({ doctorId: selectedDoctorId, queueId: qId });
      }
    };
    void loadQueue();

    return () => {
      shouldUpdate = false;
    };
  }, [selectedDoctorId, getOrCreateQueue, todayStr]);

  const entries = useQuery(
    api.queues.getQueueEntries,
    activeQueueId ? { queueId: activeQueueId } : "skip",
  );
  const queueStatus = useQuery(
    api.queues.getQueueStatus,
    activeQueueId ? { queueId: activeQueueId } : "skip",
  );


  const handleMockQueue = async () => {
    setIsMockSeeding(true);
    setSeedToast("");
    try {
      const result = await seedMockQueue();
      setSeedToast(result.message);
    } catch (err) {
      console.error(err);
      setSeedToast("Failed to generate mock queue. Check console for details.");
    } finally {
      setIsMockSeeding(false);
      setTimeout(() => setSeedToast(""), 6000);
    }
  };

  const handleClearToday = async () => {
    if (!window.confirm("Clear ALL queue entries for today across all doctors? This cannot be undone.")) return;
    setIsClearing(true);
    setSeedToast("");
    try {
      const result = await clearTodayQueues();
      setSeedToast(result.message);
      setSelectedDoctorId("");
      setActiveQueue(null);
    } catch (err) {
      console.error(err);
      setSeedToast("Failed to clear queues. Check console for details.");
    } finally {
      setIsClearing(false);
      setTimeout(() => setSeedToast(""), 6000);
    }
  };

  useEffect(() => {
    if (!entries || !activeDoctor) return;
    const waitingPatients = entries
      .filter((e) => e.status === "waiting")
      .sort((a, b) => a.position - b.position);
    // Alert the first 3 waiting patients whose positions are ≤3
    const nextPatientsToNotify = waitingPatients.slice(0, 3);
    const activeAhead = entries.filter((e) =>
      ["in_consultation", "called", "arrived"].includes(e.status),
    ).length;

    nextPatientsToNotify.forEach(async (patient, idx) => {
      const patientsAhead = activeAhead + idx;
      const currentPos = patientsAhead + 1;
      const estimatedWaitMinutes = Math.max(
        0,
        patientsAhead * (activeDoctor.avgConsultMinutes || 10),
      );

      // Double-guard: skip if already dispatched in this session OR DB flag already set
      const alreadyDispatched = dispatchedEmailsRef.current.has(patient._id);
      if (
        patient.patientEmail &&
        !patient.emailNotificationSent &&
        !alreadyDispatched
      ) {
        // Mark locally BEFORE the async call so rapid re-renders can't double-fire
        dispatchedEmailsRef.current.add(patient._id);
        try {
          await sendEmailAlertAction({
            entryId: patient._id,
            patientName: patient.patientName,
            patientEmail: patient.patientEmail,
            tokenCode: patient.tokenCode,
            doctorName: activeDoctor.name,
            room: activeDoctor.room,
            position: currentPos,
            estimatedWaitMinutes,
          });
        } catch (err) {
          // Remove from guard set on failure so it can be retried next cycle
          dispatchedEmailsRef.current.delete(patient._id);
          console.error("Failed to send queue alert email:", err);
        }
      }
    });
  }, [entries, activeDoctor, sendEmailAlertAction]);

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientName.trim() || !activeQueueId) return;
    if (queueStatus && !queueStatus.isOpen) {
      setWalkInError(
        "Queue registration is closed. Turn it on to add walk-ins.",
      );
      return;
    }

    setWalkInError("");
    setAddLoading(true);
    try {
      await checkInMutation({
        queueId: activeQueueId,
        patientName: newPatientName.trim(),
        patientEmail: newPatientEmail.trim() || undefined,
      });
      setNewPatientName("");
      setNewPatientEmail("");
      setNewPatientPhone("");
      setNewPatientDate("");
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error ? err.message : "Failed to add patient.";
      if (message.includes("Queue is currently closed")) {
        setWalkInError(
          "Queue registration is closed. Turn it on to add walk-ins.",
        );
      } else {
        setWalkInError("Failed to add patient. Please try again.");
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleFillMockData = () => {
    const mockNames = [
      "John Smith",
      "Sarah Johnson",
      "Michael Brown",
      "Emily Davis",
      "David Wilson",
      "Jessica Martinez",
      "Christopher Garcia",
      "Ashley Rodriguez",
    ];
    const mockEmails = ["demo@medq.com"];
    const mockPhones = [
      "077-123-4567",
      "077-234-5678",
      "077-345-6789",
      "076-456-7890",
      "076-567-8901",
      "076-678-9012",
      "075-789-0123",
      "075-890-1234",
    ];

    const randomIndex = Math.floor(Math.random() * mockNames.length);
    setNewPatientName(mockNames[randomIndex]);
    setNewPatientEmail(mockEmails[0]);
    setNewPatientPhone(mockPhones[randomIndex]);
    setNewPatientDate(todayStr);
  };

  const handleCallPatient = async (patient: Doc<"queue_entries">) => {
    await updateStatus({
      entryId: patient._id,
      status: "called",
    });

    if (patient.patientEmail && activeDoctor) {
      try {
        await sendCalledEmailAction({
          patientName: patient.patientName,
          patientEmail: patient.patientEmail,
          tokenCode: patient.tokenCode,
          doctorName: activeDoctor.name,
          room: activeDoctor.room,
        });
      } catch (err) {
        console.error("Failed to send called email:", err);
      }
    }
  };

  const inConsultation = entries?.find((e) => e.status === "in_consultation");
  const currentlyCalled = entries?.find((e) => e.status === "called");
  const arrivedPatients = entries?.filter((e) => e.status === "arrived") || [];
  const waitingPatients = entries?.filter((e) => e.status === "waiting") || [];
  const finalizedPatients =
    entries?.filter((e) => e.status === "done" || e.status === "skipped") || [];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-slate-900 text-white py-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/")}
              className="w-8 h-8 rounded-lg hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Image
              src="/favicon.ico"
              alt="MedQ Logo"
              width={24}
              height={24}
              className="rounded-lg"
            />
            <div>
              <h1 className="font-extrabold text-base tracking-tight leading-tight">
                MedQ Staff Portal
              </h1>
              <span className="text-[10px] text-teal-400 font-bold block uppercase tracking-widest -mt-0.5">
                Queue Controller
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-semibold hidden sm:inline">
              Date: <strong className="text-white">{todayStr}</strong>
            </span>
            <button
              type="button"
              onClick={handleMockQueue}
              disabled={isMockSeeding}
              title="Populate today's queues for all doctors with demo patients"
              className="text-xs font-bold bg-teal-700 hover:bg-teal-600 text-teal-100 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {isMockSeeding ? "Generating…" : "Generate Mock Queue"}
            </button>
            <button
              type="button"
              onClick={handleClearToday}
              disabled={isClearing}
              title="Clear all queue entries for today (demo reset)"
              className="text-xs font-bold bg-rose-900/60 hover:bg-rose-800 text-rose-300 px-3 py-2 rounded-lg transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isClearing ? "Clearing…" : "Clear Today"}
            </button>
          </div>
        </div>
      </header>

      {/* Seed feedback toast */}
      {seedToast && (
        <div className="max-w-6xl mx-auto px-4 pt-4 w-full animate-fade-in">
          <div className="bg-teal-900 text-teal-100 text-xs font-semibold px-4 py-3 rounded-xl flex items-center justify-between gap-4">
            <span>{seedToast}</span>
            <button
              onClick={() => setSeedToast("")}
              className="text-teal-300 hover:text-white transition font-bold text-base leading-none cursor-pointer"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <main className="flex-grow max-w-6xl mx-auto px-4 py-8 w-full grid md:grid-cols-12 gap-8 items-start">
        {/* ── Left Column ── sticky, never grows past viewport */}
        <div className="md:col-span-4 flex flex-col gap-4 md:sticky md:top-24">
          {/*
            Doctor selector card: fixed height of 400px total.
            Header + count row are fixed; only the list items scroll.
          */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col h-[400px] overflow-hidden">
            {/* Card header — fixed, never scrolls */}
            <div className="px-5 pt-5 pb-3 flex-shrink-0">
              <h3 className="font-extrabold text-slate-850 text-sm">
                Select Active Doctor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Control live desk for the assigned doctor queue.
              </p>
            </div>

            {/* Direct children of the card flex container */}
            {doctors === undefined ? (
              <div className="flex-1 px-5 pb-5 flex items-center justify-center text-xs text-slate-400 font-semibold gap-1.5">
                <RefreshCw className="w-4 h-4 animate-spin text-teal-500" />
                Loading Clinic Records...
              </div>
            ) : doctors.length === 0 ? (
              <div className="flex-1 px-5 pb-5 flex flex-col gap-4 items-center justify-center text-center">
                <p className="text-xs text-slate-500 leading-normal">
                  No doctors set up yet. Click <strong>Generate Mock Queue</strong> in the header to
                  seed demo data and populate today&apos;s queues in one step.
                </p>
                <button
                  onClick={handleMockQueue}
                  disabled={isMockSeeding}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-extrabold text-xs py-2.5 px-4 rounded-xl transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  {isMockSeeding ? "Generating..." : "Generate Mock Queue"}
                </button>
              </div>
            ) : (
              <>
                {/* Count row — fixed */}
                <div className="px-5 pb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400 flex-shrink-0">
                  <span>Doctor list</span>
                  <span>{doctors.length} total</span>
                </div>

                {/*
                  Scrollable list — direct child of the card flexbox layout.
                  With overflow-y-auto, the height constraints from h-[400px] apply properly.
                */}
                <div className="flex-1 min-h-0 overflow-y-auto pl-5 pr-4 pb-5 flex flex-col gap-2">
                  {doctors.map((doc) => {
                    const isSelected = selectedDoctorId === doc._id;
                    return (
                      <button
                        key={doc._id}
                        onClick={() => setSelectedDoctorId(doc._id)}
                        className={`w-full text-left p-3 rounded-xl border font-bold text-xs flex justify-between items-center transition-all cursor-pointer flex-shrink-0 ${
                          isSelected
                            ? "border-teal-600 bg-teal-50/60 text-teal-900 shadow-sm"
                            : "border-slate-100 hover:bg-slate-50 text-slate-600 bg-white"
                        }`}
                      >
                        <div>
                          <span className="block text-[8px] uppercase tracking-wider text-slate-400 mb-0.5">
                            {doc.departmentName}
                          </span>
                          <span className="text-sm font-black">{doc.name}</span>
                        </div>
                        <span
                          className={`w-2.5 h-2.5 rounded-full block flex-shrink-0 ${
                            doc.status === "available"
                              ? "bg-emerald-500"
                              : doc.status === "busy"
                                ? "bg-amber-500"
                                : "bg-rose-500"
                          }`}
                        />
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Doctor status controls — always below the fixed-height card */}
          {activeDoctor && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  Doctor status controls
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Toggle availability and room settings.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() =>
                    updateDocStatus({
                      doctorId: activeDoctor._id,
                      status: "available",
                    })
                  }
                  className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    activeDoctor.status === "available"
                      ? "bg-emerald-600 text-white shadow-md shadow-emerald-100"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-500"
                  }`}
                >
                  Active
                </button>
                <button
                  onClick={() =>
                    updateDocStatus({
                      doctorId: activeDoctor._id,
                      status: "busy",
                    })
                  }
                  className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    activeDoctor.status === "busy"
                      ? "bg-amber-600 text-white shadow-md shadow-amber-100"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-500"
                  }`}
                >
                  Busy
                </button>
                <button
                  onClick={() =>
                    updateDocStatus({
                      doctorId: activeDoctor._id,
                      status: "on_break",
                    })
                  }
                  className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition cursor-pointer ${
                    activeDoctor.status === "on_break"
                      ? "bg-rose-600 text-white shadow-md shadow-rose-100"
                      : "bg-slate-50 hover:bg-slate-100 text-slate-500"
                  }`}
                >
                  Break
                </button>
              </div>

              <div className="border-t border-slate-100 my-1" />

              <div className="flex items-center justify-between text-xs text-slate-600">
                <div>
                  <span className="font-bold text-slate-800 block">
                    Queue Registration status
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Allow walk-ins to scan QR codes.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!activeQueueId || !queueStatus}
                  onClick={() => {
                    if (!activeQueueId || !queueStatus) return;
                    void toggleQueueOpen({
                      queueId: activeQueueId,
                      isOpen: !queueStatus.isOpen,
                    });
                  }}
                  className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                    queueStatus?.isOpen ? "bg-teal-600" : "bg-slate-300"
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <span
                    className={`w-4 h-4 rounded-full bg-white block transition-transform duration-200 ${
                      queueStatus?.isOpen ? "translate-x-6" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Quick walk-in check-in */}
          {activeQueueId && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
              <div>
                <h3 className="font-extrabold text-slate-850 text-sm">
                  Desk Patient Check-In
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Quickly add a walk-in patient from the reception desk.
                </p>
              </div>

              <form onSubmit={handleAddWalkIn} className="flex flex-col gap-3">
                {queueStatus && !queueStatus.isOpen && (
                  <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    Queue registration is currently closed for this doctor.
                  </p>
                )}
                {walkInError && (
                  <p className="text-[11px] text-rose-600 font-semibold bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                    {walkInError}
                  </p>
                )}
                <input
                  type="text"
                  value={newPatientName}
                  onChange={(e) => setNewPatientName(e.target.value)}
                  placeholder="Patient Name"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                  required
                />
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="email"
                    value={newPatientEmail}
                    onChange={(e) => setNewPatientEmail(e.target.value)}
                    placeholder="Patient Email (Alerts)"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                  />
                </div>
                <input
                  type="tel"
                  value={newPatientPhone}
                  onChange={(e) => setNewPatientPhone(e.target.value)}
                  placeholder="Patient Phone"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 placeholder-slate-400 font-bold focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                />
                <input
                  type="date"
                  value={newPatientDate}
                  onChange={(e) => setNewPatientDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-teal-500 focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={handleFillMockData}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2 rounded-xl transition text-xs flex items-center justify-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Fill with Demo Data
                </button>
                <button
                  type="submit"
                  disabled={
                    addLoading || (queueStatus ? !queueStatus.isOpen : false)
                  }
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Add to Queue
                </button>
              </form>
            </div>
          )}
        </div>

        {/* ── Right Column ── */}
        <div className="md:col-span-8 flex flex-col gap-6">
          {!selectedDoctorId ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-4 text-slate-400 h-[400px]">
              <Users className="w-16 h-16 text-slate-200" />
              <div>
                <h3 className="font-extrabold text-slate-700 text-lg">
                  No Doctor Selected
                </h3>
                <p className="text-xs mt-1 max-w-xs leading-normal">
                  Please select an active doctor from the sidebar panel to view
                  and operate their live real-time queue checklist.
                </p>
              </div>
            </div>
          ) : entries === undefined ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center gap-3 text-slate-400 h-[400px]">
              <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
              <span className="text-xs font-semibold">
                Streaming doctor live queue entries...
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Checked In Today
                  </span>
                  <span className="text-2xl font-black text-slate-800 font-mono block mt-1">
                    {entries.length}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Active Waiting
                  </span>
                  <span className="text-2xl font-black text-teal-600 font-mono block mt-1">
                    {waitingPatients.length + arrivedPatients.length}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                    Consultation Avg
                  </span>
                  <span className="text-2xl font-black text-amber-700 font-mono block mt-1">
                    ~{activeDoctor?.avgConsultMinutes} min
                  </span>
                </div>
              </div>

              {/* Active Consultation Room */}
              <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 md:p-6 flex flex-col gap-4">
                <h3 className="font-extrabold text-slate-800 text-sm border-b border-slate-100 pb-2">
                  Active Consultation Room
                </h3>
                {inConsultation ? (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                        <Stethoscope className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[9px] text-emerald-600 font-bold uppercase tracking-widest block">
                          Currently Inside Room
                        </span>
                        <h4 className="font-extrabold text-slate-800 text-lg leading-tight">
                          {inConsultation.patientName}
                        </h4>
                        <span className="text-xs text-slate-500 font-mono mt-0.5 block">
                          Token:{" "}
                          <strong className="text-teal-700 font-bold">
                            {inConsultation.tokenCode}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() =>
                        updateStatus({
                          entryId: inConsultation._id,
                          status: "done",
                        })
                      }
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-5 rounded-xl transition text-xs flex items-center gap-1.5 shadow-md shadow-emerald-100 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      Complete Consultation
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-xs italic bg-slate-50/50 rounded-xl border border-slate-100 border-dashed">
                    Consultation room is currently empty. Call the next patient
                    to start.
                  </div>
                )}
              </div>

              {/* Currently Called */}
              {currentlyCalled && (
                <div className="bg-white border border-slate-200 shadow-md rounded-2xl p-5 flex flex-col gap-3">
                  <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold uppercase block w-fit">
                    Patient Called to Door
                  </span>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 p-4 rounded-xl">
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-base">
                        {currentlyCalled.patientName}
                      </h4>
                      <span className="text-xs text-slate-500 font-semibold block mt-0.5">
                        Token Code:{" "}
                        <strong className="font-mono text-slate-800">
                          {currentlyCalled.tokenCode}
                        </strong>
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          updateStatus({
                            entryId: currentlyCalled._id,
                            status: "skipped",
                          })
                        }
                        className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <UserMinus className="w-4 h-4" />
                        No-Show / Skip
                      </button>
                      <button
                        onClick={() =>
                          updateStatus({
                            entryId: currentlyCalled._id,
                            status: "in_consultation",
                          })
                        }
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 px-4 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-4 h-4" />
                        Start Consult
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Arrived Patients — physically at the room but not yet started */}
              {arrivedPatients.length > 0 && (
                <div className="bg-white border border-indigo-100 shadow-sm rounded-2xl p-5 flex flex-col gap-3">
                  <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full font-bold uppercase block w-fit">
                    Arrived at Room ({arrivedPatients.length})
                  </span>
                  <div className="flex flex-col gap-2">
                    {arrivedPatients.map((patient) => (
                      <div
                        key={patient._id}
                        className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-indigo-50/50 border border-indigo-100 p-3 rounded-xl"
                      >
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm">
                            {patient.patientName}
                          </h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {patient.tokenCode}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() =>
                              updateStatus({
                                entryId: patient._id,
                                status: "skipped",
                              })
                            }
                            className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold py-2 px-3 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <UserMinus className="w-3.5 h-3.5" />
                            Skip
                          </button>
                          <button
                            disabled={!!inConsultation}
                            onClick={() =>
                              updateStatus({
                                entryId: patient._id,
                                status: "in_consultation",
                              })
                            }
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Play className="w-3.5 h-3.5" />
                            Start Consult
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Waiting List */}
              <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col gap-4">
                <h3 className="font-extrabold text-slate-850 text-sm border-b border-slate-100 pb-2">
                  Waiting List
                </h3>
                {waitingPatients.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 text-xs italic">
                    No patients currently waiting in queue.
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {waitingPatients.map((patient, index) => {
                      const truePosition = index + 1;
                      return (
                        <div
                          key={patient._id}
                          className="border border-slate-100 hover:border-slate-200 rounded-xl p-3.5 bg-slate-50/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-600 flex items-center justify-center font-black text-xs font-mono">
                              #{truePosition}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-slate-800 text-sm leading-none">
                                  {patient.patientName}
                                </h4>
                                {patient.patientEmail && (
                                  <span className="inline-flex items-center gap-0.5 bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider">
                                    <Mail className="w-2.5 h-2.5" />
                                    Alert Active
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-450 block font-semibold mt-1">
                                Token:{" "}
                                <strong className="font-mono text-slate-700">
                                  {patient.tokenCode}
                                </strong>
                                {patient.appointmentNumber && (
                                  <>
                                    {" "}
                                    ·{" "}
                                    <strong className="font-mono">
                                      {patient.appointmentNumber}
                                    </strong>
                                  </>
                                )}
                                {" · "}
                                {new Date(
                                  patient.checkInTime,
                                ).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto justify-end">
                            <button
                              onClick={() =>
                                updateStatus({
                                  entryId: patient._id,
                                  status: "skipped",
                                })
                              }
                              className="text-rose-500 hover:bg-rose-50 font-bold p-2.5 rounded-lg transition text-xs cursor-pointer"
                              title="Skip Patient"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                            <button
                              disabled={!!currentlyCalled || !!inConsultation}
                              onClick={() => handleCallPatient(patient)}
                              className="bg-teal-50 hover:bg-teal-100 text-teal-700 font-extrabold py-2 px-4 rounded-xl transition text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                              <Volume2 className="w-3.5 h-3.5" />
                              Call Next
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Finalized History */}
              {finalizedPatients.length > 0 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 flex flex-col gap-4">
                  <h3 className="font-extrabold text-xs text-slate-500 border-b border-slate-100 pb-2">
                    Finalized Patient History
                  </h3>
                  <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-1">
                    {finalizedPatients.map((patient) => (
                      <div
                        key={patient._id}
                        className="flex justify-between items-center text-xs border-b border-slate-50 pb-2 text-slate-500"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${patient.status === "done" ? "bg-emerald-500" : "bg-rose-500"}`}
                          />
                          <span className="font-bold text-slate-700">
                            {patient.patientName}
                          </span>
                          <span className="font-mono bg-slate-100 text-slate-600 px-1 rounded text-[10px]">
                            {patient.tokenCode}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold">
                          {patient.status === "done" ? "Seen" : "Skipped"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
