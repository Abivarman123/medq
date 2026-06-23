import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// Helper to generate a unique short alphanumeric code (excluding easily confused chars like I, O, 0, 1)
function generateTokenCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateAppointmentNumber(date: string): string {
  const compact = date.replace(/-/g, "");
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `APT-${compact}-${suffix}`;
}

type QueueEntryStatus =
  | "waiting"
  | "called"
  | "arrived"
  | "in_consultation"
  | "done"
  | "skipped";

// Get or create today's queue for a doctor
export const getOrCreateQueue = mutation({
  args: {
    doctorId: v.id("doctors"),
    date: v.string(), // YYYY-MM-DD
  },
  handler: async (ctx, args) => {
    // Check if queue exists
    const existing = await ctx.db
      .query("queues")
      .withIndex("by_doctor_date", (q) => q.eq("doctorId", args.doctorId).eq("date", args.date))
      .first();

    if (existing) {
      return existing._id;
    }

    // Otherwise, create it
    const id = await ctx.db.insert("queues", {
      doctorId: args.doctorId,
      date: args.date,
      isOpen: true,
    });
    return id;
  },
});

// Patient check-in (token generation)
export const checkIn = mutation({
  args: {
    queueId: v.id("queues"),
    patientName: v.string(),
    patientEmail: v.optional(v.string()),
    patientPhone: v.optional(v.string()),
    dateOfBirth: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const queue = await ctx.db.get(args.queueId);
    if (!queue) throw new Error("Queue not found");
    if (!queue.isOpen) throw new Error("Queue is currently closed for new entries");

    // Generate unique token
    let tokenCode = generateTokenCode();
    let isUnique = false;
    let attempts = 0;
    while (!isUnique && attempts < 10) {
      const existing = await ctx.db
        .query("queue_entries")
        .withIndex("by_token", (q) => q.eq("tokenCode", tokenCode))
        .first();
      if (!existing) {
        isUnique = true;
      } else {
        tokenCode = generateTokenCode();
      }
      attempts++;
    }

    if (!isUnique) {
      throw new Error("Could not generate a unique token after 10 attempts. Please try again.");
    }

    // Get current max position for active waiting/called list to place patient at the end
    const currentEntries = await ctx.db
      .query("queue_entries")
      .withIndex("by_queue", (q) => q.eq("queueId", args.queueId))
      .collect();

    // Max position calculation
    const waitingAndCalled = currentEntries.filter(
      (e) => e.status === "waiting" || e.status === "called" || e.status === "arrived" || e.status === "in_consultation"
    );
    const position = waitingAndCalled.length + 1;

    const queueDate = queue.date;
    const appointmentNumber = generateAppointmentNumber(queueDate);

    // Create the entry
    const checkInTime = Date.now();
    const entryId = await ctx.db.insert("queue_entries", {
      queueId: args.queueId,
      tokenCode,
      patientName: args.patientName,
      patientEmail: args.patientEmail,
      patientPhone: args.patientPhone,
      dateOfBirth: args.dateOfBirth,
      appointmentNumber,
      position,
      status: "waiting",
      checkInTime,
      emailNotificationSent: false,
    });

    return {
      entryId,
      tokenCode,
      position,
      appointmentNumber,
      checkInTime,
    };
  },
});

// Get a patient entry and full context by token code
export const getPatientLiveStatus = query({
  args: { tokenCode: v.string() },
  handler: async (ctx, args) => {
    // 1. Fetch entry by token
    const entry = await ctx.db
      .query("queue_entries")
      .withIndex("by_token", (q) => q.eq("tokenCode", args.tokenCode))
      .first();

    if (!entry) {
      return { error: "Token not found" };
    }

    // 2. Fetch queue and doctor info
    const queue = await ctx.db.get(entry.queueId);
    if (!queue) return { error: "Queue not found" };

    const doctor = await ctx.db.get(queue.doctorId);
    if (!doctor) return { error: "Doctor not found" };

    const dept = await ctx.db.get(doctor.departmentId);

    // 3. Re-calculate actual real-time position
    // We only care about patients with status waiting/called/arrived/in_consultation who are checked in before this patient
    const allQueueEntries = await ctx.db
      .query("queue_entries")
      .withIndex("by_queue", (q) => q.eq("queueId", entry.queueId))
      .collect();

    // Sort by check-in time or current position
    const activeEntries = allQueueEntries
      .filter((e) => ["waiting", "called", "arrived", "in_consultation"].includes(e.status))
      .sort((a, b) => a.position - b.position);

    const index = activeEntries.findIndex((e) => e._id === entry._id);

    // If the patient is already seen or skipped
    const isDoneOrSkipped = ["done", "skipped"].includes(entry.status);
    const currentPosition = isDoneOrSkipped ? 0 : index + 1;
    const patientsAhead = isDoneOrSkipped ? 0 : Math.max(0, index);

    // 4. Calculate estimated wait
    // wait time = (patientsAhead) * avgConsultMinutes
    const doctorAvg = doctor.avgConsultMinutes || 10;
    const estimatedWaitMinutesMin = Math.max(0, patientsAhead * doctorAvg);
    const estimatedWaitMinutesMax = Math.max(0, patientsAhead * doctorAvg + 5);

    // 5. Get the currently active patient number/name if any
    const activeConsultation = activeEntries.find((e) => e.status === "in_consultation");
    const currentCalling = activeEntries.find((e) => e.status === "called");

    // Let's sort all queue entries by check-in time to find the absolute order
    const sortedAll = [...allQueueEntries].sort((a, b) => a.checkInTime - b.checkInTime);
    
    const consultingIndex = activeConsultation
      ? sortedAll.findIndex((e) => e._id === activeConsultation._id)
      : -1;
    const currentlyConsultingNumber = consultingIndex !== -1 ? consultingIndex + 1 : null;

    const yourIndex = sortedAll.findIndex((e) => e._id === entry._id);
    const yourCheckInNumber = yourIndex !== -1 ? yourIndex + 1 : null;

    return {
      entry: {
        id: entry._id,
        patientName: entry.patientName,
        tokenCode: entry.tokenCode,
        status: entry.status,
        checkInTime: entry.checkInTime,
        calledTime: entry.calledTime,
        emailNotificationSent: entry.emailNotificationSent,
        patientPhone: entry.patientPhone,
        dateOfBirth: entry.dateOfBirth,
        appointmentNumber: entry.appointmentNumber,
      },
      doctor: {
        id: doctor._id,
        name: doctor.name,
        room: doctor.room,
        status: doctor.status,
        avgConsultMinutes: doctorAvg,
        departmentName: dept ? dept.name : "OPD",
      },
      queue: {
        id: queue._id,
        date: queue.date,
        isOpen: queue.isOpen,
      },
      liveStats: {
        currentPosition,
        patientsAhead,
        estimatedWaitRange: `${estimatedWaitMinutesMin}–${estimatedWaitMinutesMax} min`,
        estimatedWaitMinutesMin,
        totalActiveQueue: activeEntries.length,
        currentlyConsultingName: activeConsultation ? activeConsultation.patientName : null,
        currentlyConsultingNumber,
        currentlyCallingToken: currentCalling ? currentCalling.tokenCode : null,
        yourCheckInNumber,
      },
    };
  },
});

// Staff queries: Get all entries for a specific queue
export const getQueueEntries = query({
  args: { queueId: v.id("queues") },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("queue_entries")
      .withIndex("by_queue", (q) => q.eq("queueId", args.queueId))
      .collect();

    // Sort by status precedence and then position
    // Precedence: in_consultation (1) > called (2) > arrived (3) > waiting (4) > done (5) > skipped (6)
    const getPrecedence = (status: string) => {
      switch (status) {
        case "in_consultation": return 1;
        case "called": return 2;
        case "arrived": return 3;
        case "waiting": return 4;
        case "done": return 5;
        case "skipped": return 6;
        default: return 7;
      }
    };

    return entries.sort((a, b) => {
      const precA = getPrecedence(a.status);
      const precB = getPrecedence(b.status);
      if (precA !== precB) return precA - precB;
      return a.position - b.position;
    });
  },
});

// Staff query: Read queue open/closed status
export const getQueueStatus = query({
  args: { queueId: v.id("queues") },
  handler: async (ctx, args) => {
    const queue = await ctx.db.get(args.queueId);
    if (!queue) return null;

    return {
      id: queue._id,
      date: queue.date,
      isOpen: queue.isOpen,
    };
  },
});

// Update patient status in queue (Staff mutations)
export const updateEntryStatus = mutation({
  args: {
    entryId: v.id("queue_entries"),
    status: v.union(
      v.literal("waiting"),
      v.literal("called"),
      v.literal("arrived"),
      v.literal("in_consultation"),
      v.literal("done"),
      v.literal("skipped")
    ),
  },
  handler: async (ctx, args) => {
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Entry not found");

    const patchData: {
      status: QueueEntryStatus;
      calledTime?: number;
      doneTime?: number;
    } = { status: args.status };

    if (args.status === "called") {
      patchData.calledTime = Date.now();
    }

    if (args.status === "done") {
      patchData.doneTime = Date.now();

      // Recalculate average consultation time dynamically!
      // Find the doctor and queue
      const queue = await ctx.db.get(entry.queueId);
      if (queue) {
        const doctor = await ctx.db.get(queue.doctorId);
        if (doctor && entry.calledTime) {
          // consult duration in minutes
          const durationMin = (Date.now() - entry.calledTime) / 60000;
          if (durationMin > 1 && durationMin < 120) { // filter outliers
            const currentAvg = doctor.avgConsultMinutes || 10;
            // Weighted moving average (80% weight to old average, 20% to new duration)
            const newAvg = parseFloat((currentAvg * 0.8 + durationMin * 0.2).toFixed(1));
            await ctx.db.patch(doctor._id, { avgConsultMinutes: newAvg });
          }
        }
      }
    }

    await ctx.db.patch(args.entryId, patchData);

    // If marked done or skipped, we should shift positions of all remaining waiting/called patients in the queue!
    if (args.status === "done" || args.status === "skipped") {
      const activeEntries = await ctx.db
        .query("queue_entries")
        .withIndex("by_queue", (q) => q.eq("queueId", entry.queueId))
        .collect();

      const remaining = activeEntries
        .filter((e) => ["waiting", "called", "arrived", "in_consultation"].includes(e.status))
        .sort((a, b) => a.position - b.position);

      // Re-assign positions sequentially
      let pos = 1;
      for (const e of remaining) {
        if (e._id !== args.entryId) {
          await ctx.db.patch(e._id, { position: pos });
          pos++;
        }
      }
    }
  },
});

// Toggle Queue Open/Closed
export const toggleQueueOpen = mutation({
  args: {
    queueId: v.id("queues"),
    isOpen: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, { isOpen: args.isOpen });
  },
});

// Mark email notification as sent
export const markNotificationSent = mutation({
  args: { entryId: v.id("queue_entries") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, { emailNotificationSent: true });
  },
});

// Update patient email for alerts
export const updatePatientEmail = mutation({
  args: {
    entryId: v.id("queue_entries"),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.entryId, { patientEmail: args.email });
  },
});


