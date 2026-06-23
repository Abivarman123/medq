"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Search,
  Clock,
  Mail,
  Smartphone,
  UserCheck,
  ArrowRight,
  CalendarCheck,
} from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [tokenInput, setTokenInput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = tokenInput.trim().toUpperCase();
    if (!cleanedCode) {
      setErrorMsg("Please enter a valid queue code.");
      return;
    }
    if (cleanedCode.length !== 6) {
      setErrorMsg("Queue codes must be exactly 6 characters (e.g., A7F2K9).");
      return;
    }
    setErrorMsg("");
    router.push(`/q/${cleanedCode}`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => router.push("/")}
          >
            <Image
              src="/favicon.ico"
              alt="MedQ Logo"
              width={40}
              height={40}
              className="rounded-xl"
            />
            <div>
              <span className="font-bold text-lg text-slate-800 tracking-tight">
                MedQ
              </span>
              <span className="text-xs block text-teal-600 font-semibold -mt-1">
                Smart Hospital Waiting
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/checkin")}
              className="hidden sm:inline-flex text-sm font-semibold bg-teal-50 text-teal-700 hover:bg-teal-100 px-4 py-2 rounded-lg transition items-center gap-1.5"
            >
              <CalendarCheck className="w-4 h-4" />
              Check-In
            </button>
            <button
              onClick={() => router.push("/staff/dashboard")}
              className="text-sm font-semibold text-slate-600 hover:text-teal-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition"
            >
              Staff Console
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-6xl mx-auto px-4 w-full py-12 flex flex-col gap-16">
        {/* Hero Section & Patient Lookup */}
        <div className="grid md:grid-cols-12 gap-8 items-center relative">
          <div className="absolute -left-4 -top-10 md:-left-0 md:-top-5 w-64 h-64 md:w-200 md:h-200 opacity-15 pointer-events-none z-0">
            <Image
              src="/Doctors-pana.svg"
              alt="Doctors illustration"
              fill
              className="object-contain"
              priority
            />
          </div>
          <div className="md:col-span-7 flex flex-col gap-6 text-left relative z-10">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-slate-900 leading-tight">
              Wait at home, <br />
              <span className="text-teal-600">not in crowded clinics.</span>
            </h1>
            <p className="text-lg text-slate-1000 max-w-lg leading-relaxed">
              MedQ tracks your doctor&apos;s queue live. Receive free email alerts,
              see estimated waiting ranges, and only arrive when the doctor is
              ready for you.
            </p>

            <div className="flex flex-wrap gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Clock className="w-4 h-4" />
                </div>
                Live Wait Estimator
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Mail className="w-4 h-4" />
                </div>
                Email Alerts
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600">
                  <Smartphone className="w-4 h-4" />
                </div>
                No login needed
              </div>
            </div>
          </div>

          {/* Search Box / Portal */}
          <div className="md:col-span-5">
            <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 md:p-8 flex flex-col gap-6 animate-slide-in">

            <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Manage Your Visit
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Make an appointment or enter the 6-character code printed on your receipt.
                </p>
              </div>

              <button
                onClick={() => router.push("/checkin")}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl transition shadow-lg shadow-teal-100 flex items-center justify-center gap-2 text-base cursor-pointer"
              >
                <UserCheck className="w-5 h-5" />
                New Appointment
              </button>

              <div className="relative flex items-center justify-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-100" />
                </div>
                <span className="relative bg-white px-3 text-xs text-slate-400 font-semibold uppercase">
                  Or
                </span>
              </div>

              <form onSubmit={handleTrack} className="flex flex-col gap-4">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="text"
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    placeholder="Enter Code (e.g., A7F2K9)"
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 pl-12 pr-4 py-4 rounded-xl text-lg font-bold tracking-widest focus:outline-none focus:border-teal-500 focus:bg-white uppercase transition-all"
                    maxLength={6}
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs text-rose-500 font-semibold">
                    {errorMsg}
                  </p>
                )}

                <button
                  type="submit"
                  className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-4 rounded-xl transition shadow-md border-2 border-slate-200 hover:border-slate-300 flex items-center justify-center gap-2 text-base cursor-pointer"
                >
                  Track Live Queue
                  <ArrowRight className="w-5 h-5" />
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* How it works grid */}
        <div className="flex flex-col gap-8">
          <div className="text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight">
              How MedQ Simplifies Waiting
            </h2>
            <p className="text-slate-500 mt-2">
              A clean clinical system optimized for maximum comfort and speed.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                1
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                Check-In & Get Code
              </h3>
              <p className="text-slate-500 text-sm mt-2">
                Register online or at the hospital check-in desk. Instantly receive a
                unique 6-character receipt token like <strong>A7F2K9</strong>{" "}
                and a printable QR code.
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                2
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                Track Status Live
              </h3>
              <p className="text-slate-500 text-sm mt-2">
                Scan your QR code or type your token. Watch your exact live
                position shift in real-time as the doctor sees previous
                patients.
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                3
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                Get Smart Alerts
              </h3>
              <p className="text-slate-500 text-sm mt-2">
                Subscribe to free email notifications. You&apos;ll get an alert
                directly in your inbox when there are only{" "}
                <strong>3 patients ahead</strong>.
              </p>
            </div>

            <div className="bg-white border border-slate-100 p-6 rounded-2xl shadow-sm hover:shadow-md transition">
              <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-xl flex items-center justify-center font-bold text-lg mb-4">
                4
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                Arrive Just in Time
              </h3>
              <p className="text-slate-500 text-sm mt-2">
                Walk into the department room exactly when called. No wasted
                hours in stuffy waiting halls, no risk of missing your number.
              </p>
            </div>
          </div>
        </div>

        {/* Clinical Stats Mockup */}
        <div className="bg-gradient-to-br from-teal-600 to-emerald-700 text-white rounded-3xl p-8 md:p-12 shadow-xl shadow-teal-900/10 grid md:grid-cols-3 gap-8 text-center md:text-left items-center">
          <div className="md:col-span-2 flex flex-col gap-3">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Improving Public Hospital Efficiency
            </h2>
            <p className="text-teal-50/90 leading-relaxed max-w-xl">
              MedQ is designed to reduce crowd density inside clinics by up to
              70%, promoting safe social distancing, patient comfort, and
              seamless operations for staff.
            </p>
          </div>
          <div className="flex flex-col gap-6 bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/10 text-center">
            <div className="text-4xl font-extrabold text-white">~30 min</div>
            <div className="text-xs text-teal-100 uppercase tracking-widest font-bold -mt-3">
              Average Wait Saved
            </div>
            <div className="w-full border-t border-white/10 my-1" />
            <div className="text-4xl font-extrabold text-white">94%</div>
            <div className="text-xs text-teal-100 uppercase tracking-widest font-bold -mt-3">
              Patient Satisfaction
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image
              src="/favicon.ico"
              alt="MedQ Logo"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="font-bold text-sm text-slate-800">
              MedQ System
            </span>
          </div>
          <p className="text-xs text-slate-500">
            © 2026 MedQ Inc. Designed for optimized outpatient departments.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => router.push("/staff/dashboard")}
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              Staff Portal
            </button>
            <span className="text-slate-300">|</span>
            <button
              onClick={() => router.push("/checkin")}
              className="text-xs font-semibold text-teal-600 hover:underline"
            >
              Self Check-In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
