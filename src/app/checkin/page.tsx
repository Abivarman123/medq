"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  UserCheck,
  Printer,
  ChevronRight,
  Clock,
  Stethoscope,
  AlertCircle,
  Mail,
  User,
  Phone,
  Calendar,
  CheckCircle2,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";

function formatDateLong(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

type Receipt = {
  tokenCode: string;
  appointmentNumber: string;
  checkInTime: number;
  visitDate: string;
  patientName: string;
  dateOfBirth: string;
  patientPhone: string;
  patientEmail?: string; // optional — patient may not provide email
  doctorFixedTime: string;
  doctorName: string;
  departmentName: string;
  room: string;
  position: number;
  avgConsult: number;
};

type SelectedQueue = {
  doctorId: Id<"doctors">;
  queueId: Id<"queues">;
};

export default function CheckInKiosk() {
  const router = useRouter();
  const doctors = useQuery(api.doctors.list);
  const getOrCreateQueue = useMutation(api.queues.getOrCreateQueue);
  const checkIn = useMutation(api.queues.checkIn);
  const sendConfirmationEmail = useAction(api.notifications.sendConfirmationEmail);

  const todayStr = new Date().toISOString().split("T")[0];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [patientPhone, setPatientPhone] = useState("");
  const [patientEmail, setPatientEmail] = useState("");
  const [selectedDoctorId, setSelectedDoctorId] = useState<Id<"doctors"> | "">("");
  const [selectedQueue, setSelectedQueue] = useState<SelectedQueue | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [copied, setCopied] = useState(false);

  const departments = useMemo(() => {
    if (!doctors) return [];
    return [...new Set(doctors.map((d) => d.departmentName))].sort();
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    if (!doctors) return [];
    if (departmentFilter === "all") return doctors;
    return doctors.filter((d) => d.departmentName === departmentFilter);
  }, [doctors, departmentFilter]);

  const selectedQueueId =
    selectedQueue?.doctorId === selectedDoctorId ? selectedQueue.queueId : null;

  useEffect(() => {
    if (!selectedDoctorId) return;
    let shouldUpdate = true;
    const loadQueue = async () => {
      try {
        const queueId = await getOrCreateQueue({
          doctorId: selectedDoctorId,
          date: todayStr,
        });
        if (shouldUpdate) {
          setSelectedQueue({ doctorId: selectedDoctorId, queueId });
        }
      } catch (err) {
        console.error("Failed to load queue for selected doctor:", err);
        if (shouldUpdate) {
          setSelectedQueue(null);
        }
      }
    };

    void loadQueue();

    return () => {
      shouldUpdate = false;
    };
  }, [selectedDoctorId, getOrCreateQueue, todayStr]);

  const selectedQueueStatus = useQuery(
    api.queues.getQueueStatus,
    selectedQueueId ? { queueId: selectedQueueId } : "skip",
  );

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setPatientPhone("");
    setPatientEmail("");
    setSelectedDoctorId("");
    setSelectedQueue(null);
    setDepartmentFilter("all");
  };

  const handleFillMockData = () => {
    const firstNames = [
      "John",
      "Sarah",
      "Michael",
      "Emily",
      "David",
      "Jessica",
      "Christopher",
      "Ashley",
    ];
    const lastNames = [
      "Smith",
      "Johnson",
      "Brown",
      "Davis",
      "Wilson",
      "Martinez",
      "Garcia",
      "Rodriguez",
    ];
    const phones = [
      "+94 0758187300",
      "+94 0712345678",
      "+94 0778765432",
      "+94 0765432109",
      "+94 0789012345",
      "+94 0745678901",
      "+94 0723456789",
      "+94 0798765432",
    ];

    const randomIndex = Math.floor(Math.random() * firstNames.length);
    setFirstName(firstNames[randomIndex]);
    setLastName(lastNames[randomIndex]);
    setPatientPhone(phones[randomIndex]);
    setPatientEmail("demo@medq.com");

    // Generate a random date of birth between 18 and 80 years ago
    const today = new Date();
    const minAge = 18;
    const maxAge = 80;
    const randomAge = Math.floor(Math.random() * (maxAge - minAge + 1)) + minAge;
    const birthYear = today.getFullYear() - randomAge;
    const birthMonth = String(today.getMonth() + 1).padStart(2, "0");
    const birthDay = String(today.getDate()).padStart(2, "0");
    setDateOfBirth(`${birthYear}-${birthMonth}-${birthDay}`);
  };

  const handleCopyToken = async () => {
    if (!receipt) return;
    try {
      await navigator.clipboard.writeText(receipt.tokenCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy token:", err);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (!trimmedFirst || !trimmedLast)
      return setErrorMsg("Please enter your full name.");
    if (!dateOfBirth) return setErrorMsg("Please enter your date of birth.");
    if (!patientPhone.trim())
      return setErrorMsg("Please enter a mobile number.");
    if (!selectedDoctorId) return setErrorMsg("Please select a doctor.");
    if (selectedQueueStatus && !selectedQueueStatus.isOpen) {
      return setErrorMsg(
        "Queue registration is currently closed for this doctor.",
      );
    }

    setIsSubmitting(true);
    setErrorMsg("");
    const fullName = `${trimmedLast}, ${trimmedFirst}`;

    try {
      const queueId =
        selectedQueueId ??
        (await getOrCreateQueue({
          doctorId: selectedDoctorId,
          date: todayStr,
        }));
      const result = await checkIn({
        queueId,
        patientName: fullName,
        patientEmail: patientEmail.trim() || undefined,
        patientPhone: patientPhone.trim(),
        dateOfBirth,
      });

      const chosenDoc = doctors?.find((d) => d._id === selectedDoctorId);
      const doctorFixedTime =
        chosenDoc?.fixedTimeStart && chosenDoc?.fixedTimeEnd
          ? `${chosenDoc.fixedTimeStart} - ${chosenDoc.fixedTimeEnd}`
          : "08:00 - 17:00";

      setReceipt({
        tokenCode: result.tokenCode,
        appointmentNumber: result.appointmentNumber,
        checkInTime: result.checkInTime,
        visitDate: todayStr,
        patientName: fullName,
        dateOfBirth,
        patientPhone: patientPhone.trim(),
        patientEmail: patientEmail.trim(),
        doctorFixedTime,
        doctorName: chosenDoc?.name || "Physician",
        departmentName: chosenDoc?.departmentName || "Outpatient",
        room: chosenDoc?.room || "—",
        position: result.position,
        avgConsult: chosenDoc?.avgConsultMinutes || 10,
      });

      if (patientEmail.trim()) {
        void sendConfirmationEmail({
          patientName: fullName,
          patientEmail: patientEmail.trim(),
          tokenCode: result.tokenCode,
          appointmentNumber: result.appointmentNumber,
          doctorName: chosenDoc?.name || "Physician",
          departmentName: chosenDoc?.departmentName || "Outpatient",
          room: chosenDoc?.room || "—",
          visitDate: todayStr,
          checkInTime: result.checkInTime,
          position: result.position,
          avgConsultMinutes: chosenDoc?.avgConsultMinutes || 10,
        });
      }

      resetForm();
    } catch (err: unknown) {
      console.error(err);
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      if (message.includes("Queue is currently closed")) {
        setErrorMsg("Queue registration is currently closed for this doctor.");
      } else {
        setErrorMsg(message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use the configured public URL so QR codes work when scanned on mobile.
  // Falls back to window.location.origin only in local dev (won't work on LAN
  // but is fine for desktop testing).
  const appOrigin =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== "undefined" ? window.location.origin : "");
  const trackingUrl = receipt ? `${appOrigin}/q/${receipt.tokenCode}` : "";
  const inputClass =
    "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:border-teal-500 focus:bg-white transition-all text-sm";

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 py-4 no-print">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold text-sm transition cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.ico"
              alt="MedQ Logo"
              width={20}
              height={20}
              className="animate-pulse"
            />
            <span className="font-extrabold text-slate-800 text-base">
              Outpatient Check-In
            </span>
          </div>
          <div className="w-[92px]" aria-hidden />
        </div>
      </header>

      <main className="flex-grow max-w-4xl mx-auto px-4 py-8 w-full flex items-center justify-center">
        {receipt ? (
          <div className="w-full max-w-lg bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden animate-slide-in print-receipt">
            <div className="bg-teal-50 border-b border-teal-200 px-6 py-5 text-center">
              <UserCheck
                className="w-10 h-10 mx-auto mb-2 text-teal-700"
                aria-hidden
              />
              <h2 className="text-xl font-black tracking-tight text-slate-900">
                Appointment Checked In
              </h2>
              <p className="text-sm text-slate-600 mt-1 font-semibold">
                {formatDateLong(receipt.visitDate)} ·{" "}
                {formatTime(receipt.checkInTime)}
              </p>
            </div>
            <div className="p-6 flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="col-span-2 bg-slate-900 text-white rounded-xl p-4">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block">
                    Confirmation number
                  </span>
                  <span className="font-mono font-black text-lg tracking-wide block mt-0.5">
                    {receipt.appointmentNumber}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Queue token
                  </span>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-teal-700 text-lg">
                      {receipt.tokenCode}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyToken}
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 bg-white border border-slate-200 hover:border-teal-300 px-2.5 py-1.5 rounded-lg transition cursor-pointer no-print"
                      title={copied ? "Copied!" : "Copy token"}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-teal-600" />
                          <span className="text-teal-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Queue position
                  </span>
                  <span className="font-black text-indigo-600 text-lg">
                    #{receipt.position}
                  </span>
                </div>
              </div>

              <section className="text-left border border-slate-100 rounded-xl divide-y divide-slate-100">
                <div className="px-4 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Patient
                  </h3>
                  <p className="font-extrabold text-slate-900">
                    {receipt.patientName}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    DOB {receipt.dateOfBirth} · {receipt.patientPhone}
                  </p>
                  {receipt.patientEmail && (
                    <p className="text-xs text-slate-500">
                      {receipt.patientEmail}
                    </p>
                  )}
                </div>
                <div className="px-4 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Doctor schedule
                  </h3>
                  <p className="text-sm font-bold text-slate-800">
                    {receipt.doctorFixedTime}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fixed OPD window for this doctor
                  </p>
                </div>
                <div className="px-4 py-3">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
                    Provider & location
                  </h3>
                  <p className="font-extrabold text-slate-900">
                    {receipt.doctorName}
                  </p>
                  <p className="text-xs text-teal-700 font-bold">
                    {receipt.departmentName}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {receipt.room}
                  </p>
                </div>
              </section>

              <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 flex items-center gap-2 text-left">
                <Clock className="w-5 h-5 text-amber-700 shrink-0" />
                <div>
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">
                    Estimated wait
                  </span>
                  <span className="text-sm font-black text-amber-900">
                    ~{Math.max(0, (receipt.position - 1) * receipt.avgConsult)}–
                    {Math.max(
                      5,
                      (receipt.position - 1) * receipt.avgConsult + 5,
                    )}{" "}
                    minutes
                  </span>
                </div>
              </div>

              <div className="qr-surface bg-white p-4 border border-slate-100 rounded-2xl shadow-sm flex flex-col items-center gap-2">
                <QRCodeSVG value={trackingUrl} size={140} level="H" />
                <span className="text-[10px] text-slate-400 font-bold uppercase">
                  Scan for live queue status
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 no-print">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-2 text-sm cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Print slip
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/q/${receipt.tokenCode}`)}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition flex items-center justify-center gap-1.5 text-sm cursor-pointer"
                >
                  Track queue
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setReceipt(null)}
                className="text-xs text-slate-400 hover:text-slate-600 underline font-semibold no-print cursor-pointer"
              >
                Register another patient
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-2xl bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden animate-slide-in">
            <div className="bg-slate-50 border-b border-slate-200 px-6 md:px-10 py-6">
              <p className="text-teal-700 text-xs font-bold uppercase tracking-widest">
                MedQ Outpatient
              </p>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-1 text-slate-900">
                Appointment Check-In
              </h1>
              <div className="flex flex-wrap gap-3 mt-4 text-xs font-bold">
                <span className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  {formatDateLong(todayStr)}
                </span>
              </div>
            </div>

            <div className="p-6 md:p-10">
              {doctors === undefined ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-400 text-sm font-semibold">
                  <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-teal-600 animate-spin" />
                  Loading clinic schedule…
                </div>
              ) : doctors.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl flex flex-col items-center gap-4 text-center">
                  <AlertCircle className="w-10 h-10 text-amber-600" />
                  <div>
                    <h3 className="font-bold text-amber-800 text-base">
                      No physicians on file
                    </h3>
                    <p className="text-xs text-amber-600 mt-1 max-w-sm">
                      Please contact staff before patients can check in.
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCheckIn} className="flex flex-col gap-8">
                  <fieldset className="flex flex-col gap-4">
                    <legend className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wide">
                      <User className="w-4 h-4 text-teal-600" />
                      1. Patient information
                    </legend>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">
                          First name *
                        </label>
                        <input
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          className={inputClass}
                          placeholder="e.g. John"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">
                          Last name *
                        </label>
                        <input
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          className={inputClass}
                          placeholder="e.g. Doe"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">
                          Date of birth *
                        </label>
                        <input
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          className={inputClass}
                          placeholder="YYYY-MM-DD"
                          required
                          max={todayStr}
                        />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-bold text-slate-500">
                          Mobile phone *
                        </label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="tel"
                            value={patientPhone}
                            onChange={(e) => setPatientPhone(e.target.value)}
                            className={`${inputClass} pl-10`}
                            placeholder="e.g. +94 0758187300"
                            required
                          />
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 sm:col-span-2">
                        <label className="text-xs font-bold text-slate-500">
                          Email (optional)
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="email"
                            value={patientEmail}
                            onChange={(e) => setPatientEmail(e.target.value)}
                            className={`${inputClass} pl-10`}
                            placeholder="e.g. patient@example.com"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleFillMockData}
                      className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold py-2.5 rounded-xl transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Fill with Demo Data
                    </button>
                  </fieldset>

                  <fieldset className="flex flex-col gap-4">
                    <legend className="flex items-center gap-2 text-sm font-black text-slate-800 uppercase tracking-wide">
                      <Stethoscope className="w-4 h-4 text-teal-600" />
                      2. Select physician *
                    </legend>
                    {departments.length > 1 && (
                      <select
                        value={departmentFilter}
                        onChange={(e) => {
                          setDepartmentFilter(e.target.value);
                          setSelectedDoctorId("");
                          setSelectedQueue(null);
                        }}
                        className={`${inputClass} max-w-xs`}
                      >
                        <option value="all">All departments</option>
                        {departments.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    )}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                      {filteredDoctors.map((doc) => {
                        const isSelected = selectedDoctorId === doc._id;
                        const statusColor =
                          doc.status === "available"
                            ? "bg-emerald-500"
                            : doc.status === "busy"
                              ? "bg-amber-500"
                              : "bg-rose-500";
                        const fixedTime =
                          doc.fixedTimeStart && doc.fixedTimeEnd
                            ? `${doc.fixedTimeStart}-${doc.fixedTimeEnd}`
                            : "08:00-17:00";
                        const isOnBreak = doc.status === "on_break";
                        return (
                          <button
                            key={doc._id}
                            type="button"
                            disabled={doc.status === "off" || isOnBreak}
                            onClick={() => setSelectedDoctorId(doc._id)}
                            className={`text-left border-2 rounded-xl p-3 flex flex-col gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${isSelected ? "border-teal-500 bg-teal-50/60 shadow-md" : "border-slate-200 hover:border-slate-300 bg-white"}`}
                          >
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold uppercase">
                                {doc.departmentName}
                              </span>
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${statusColor}`}
                              />
                            </div>
                            <span className={`font-extrabold text-sm leading-tight ${isOnBreak ? "text-slate-400" : "text-slate-800"}`}>
                              {doc.name}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">
                              {doc.room} · {fixedTime}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>


                  {errorMsg && (
                    <p className="text-xs text-rose-600 font-semibold flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {errorMsg}
                    </p>
                  )}

                  {selectedQueueStatus && !selectedQueueStatus.isOpen && (
                    <p className="text-xs text-amber-700 font-semibold flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      Queue registration is closed for the selected doctor.
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={
                      isSubmitting ||
                      (selectedQueueStatus
                        ? !selectedQueueStatus.isOpen
                        : false)
                    }
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-extrabold py-4 rounded-xl transition shadow-lg shadow-teal-100 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-base"
                  >
                    {isSubmitting ? (
                      "Registering appointment…"
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Complete check-in & get confirmation
                      </>
                    )}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
