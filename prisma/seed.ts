/**
 * MODULE: Database seed
 *
 * Purpose        Create a realistic centre so every screen has real data to
 *                render, and a reviewer can sign in and use the product.
 * Responsibility Idempotent creation of people, batches and several weeks of
 *                logged history.
 * Dependencies   The application's own services.
 *
 * IT SEEDS THROUGH THE REAL SERVICES.
 *  Attendance, homework and test history are created by calling
 *  `saveBatchAttendance`, `saveBatchHomework` and `saveAssessment` — the same
 *  functions the teacher UI calls. That means seeded data is guaranteed to be
 *  shaped exactly like production data, timelines and notification outbox rows
 *  included, and the seed doubles as an end-to-end exercise of the write path.
 *
 * IDEMPOTENT.
 *  Every row uses an explicit deterministic id, so running it twice updates
 *  rather than duplicating.
 *
 * DETERMINISTIC.
 *  A seeded PRNG generates the history, so two runs produce identical numbers
 *  and a screenshot in a bug report stays reproducible.
 */

import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import { ATTENDANCE_STATUS, HOMEWORK_STATUS, ROLE } from "../src/domain/enums";
import { addDays, startOfDayUtc, toDateInputValue } from "../src/domain/dates";
import type { SessionUser } from "../src/lib/auth/session";
import { saveBatchAttendance } from "../src/server/services/attendance.service";
import { saveBatchHomework } from "../src/server/services/homework.service";
import { saveAssessment } from "../src/server/services/assessment.service";
import { logEngagement, postNote } from "../src/server/services/notes.service";

const db = new PrismaClient();

const CENTRE_ID = "centre_brightminds";
const DEMO_PASSWORD = "demo-password-123";

/** How many past weekdays of history to generate. */
const HISTORY_DAYS = 24;

// ---------------------------------------------------------------- fixtures --

interface StaffFixture {
  id: string;
  email: string;
  fullName: string;
  role: typeof ROLE.OWNER | typeof ROLE.TEACHER;
  color: string;
}

const STAFF: StaffFixture[] = [
  { id: "user_owner", email: "priya@brightminds.in", fullName: "Priya Nair", role: ROLE.OWNER, color: "#075E54" },
  { id: "user_rao", email: "rao@brightminds.in", fullName: "Sunita Rao", role: ROLE.TEACHER, color: "#7E57C2" },
  { id: "user_khan", email: "khan@brightminds.in", fullName: "Imran Khan", role: ROLE.TEACHER, color: "#26A69A" },
  { id: "user_mehta", email: "mehta@brightminds.in", fullName: "Arun Mehta", role: ROLE.TEACHER, color: "#EF6C00" },
  { id: "user_bose", email: "bose@brightminds.in", fullName: "Ritu Bose", role: ROLE.TEACHER, color: "#3949AB" },
];

interface StudentFixture {
  key: string;
  fullName: string;
  color: string;
  guardianName: string;
  guardianEmail: string;
  /** 0–1 likelihood of turning up; drives the generated history. */
  attendance: number;
  /** 0–1 likelihood of homework being done. */
  homework: number;
  /** Typical test performance as a fraction of the maximum. */
  ability: number;
}

interface BatchFixture {
  id: string;
  name: string;
  subject: string;
  gradeLabel: string;
  colorHex: string;
  teacherId: string;
  students: StudentFixture[];
}

function student(
  key: string,
  fullName: string,
  color: string,
  guardianName: string,
  guardianEmail: string,
  attendance: number,
  homework: number,
  ability: number,
): StudentFixture {
  return { key, fullName, color, guardianName, guardianEmail, attendance, homework, ability };
}

const BATCHES: BatchFixture[] = [
  {
    id: "batch_g7m",
    name: "Grade 7 Math",
    subject: "Mathematics",
    gradeLabel: "G7 Math",
    colorHex: "#7E57C2",
    teacherId: "user_rao",
    students: [
      student("aarav", "Aarav Sharma", "#7E57C2", "Anita Sharma", "anita.sharma@example.in", 0.95, 0.9, 0.82),
      student("ishaan", "Ishaan Roy", "#5C6BC0", "Debjit Roy", "debjit.roy@example.in", 0.9, 0.8, 0.71),
      student("ananya", "Ananya Das", "#EC407A", "Moushumi Das", "moushumi.das@example.in", 0.92, 0.88, 0.78),
      student("vivaan", "Vivaan Nair", "#00897B", "Rekha Nair", "rekha.nair@example.in", 0.85, 0.62, 0.6),
      student("myra", "Myra Kapoor", "#8E24AA", "Sanjay Kapoor", "sanjay.kapoor@example.in", 0.97, 0.95, 0.9),
      student("kabirj", "Kabir Jain", "#EF6C00", "Nisha Jain", "nisha.jain@example.in", 0.78, 0.55, 0.54),
      student("saanvi", "Saanvi Rao", "#43A047", "Latha Rao", "latha.rao@example.in", 0.93, 0.86, 0.8),
      student("reyansh", "Reyansh Gupta", "#3949AB", "Vikram Gupta", "vikram.gupta@example.in", 0.7, 0.42, 0.48),
      student("aisha", "Aisha Khan", "#D81B60", "Farida Khan", "farida.khan@example.in", 0.9, 0.84, 0.76),
      student("arjun", "Arjun Menon", "#1E88E5", "Deepa Menon", "deepa.menon@example.in", 0.88, 0.72, 0.68),
    ],
  },
  {
    id: "batch_g9p",
    name: "Grade 9 Physics",
    subject: "Physics",
    gradeLabel: "G9 Phy",
    colorHex: "#EF6C00",
    teacherId: "user_mehta",
    students: [
      student("kabirs", "Kabir Singh", "#EF6C00", "Harjit Singh", "harjit.singh@example.in", 0.58, 0.35, 0.45),
      student("anika", "Anika Verma", "#00897B", "Sunil Verma", "sunil.verma@example.in", 0.66, 0.4, 0.5),
      student("rohan", "Rohan Iyer", "#5C6BC0", "Meera Iyer", "meera.iyer@example.in", 0.84, 0.7, 0.66),
      student("zara", "Zara Sheikh", "#EC407A", "Amina Sheikh", "amina.sheikh@example.in", 0.9, 0.82, 0.79),
      student("dev", "Dev Malhotra", "#43A047", "Karan Malhotra", "karan.malhotra@example.in", 0.76, 0.6, 0.58),
      student("nisha", "Nisha Pillai", "#8E24AA", "Geeta Pillai", "geeta.pillai@example.in", 0.88, 0.75, 0.72),
      student("yash", "Yash Agarwal", "#1E88E5", "Pooja Agarwal", "pooja.agarwal@example.in", 0.8, 0.66, 0.63),
      student("pari", "Pari Reddy", "#D81B60", "Srinivas Reddy", "srinivas.reddy@example.in", 0.94, 0.9, 0.85),
    ],
  },
  {
    id: "batch_g5e",
    name: "Grade 5 English",
    subject: "English",
    gradeLabel: "G5 Eng",
    colorHex: "#26A69A",
    teacherId: "user_khan",
    students: [
      student("diya", "Diya Patel", "#26A69A", "Hemal Patel", "hemal.patel@example.in", 0.75, 0.58, 0.6),
      student("kian", "Kian Dutta", "#F4511E", "Sohini Dutta", "sohini.dutta@example.in", 0.82, 0.68, 0.65),
      student("mira", "Mira Joshi", "#26A69A", "Ashok Joshi", "ashok.joshi@example.in", 0.9, 0.85, 0.8),
      student("aryan", "Aryan Chatterjee", "#5C6BC0", "Rina Chatterjee", "rina.chatterjee@example.in", 0.86, 0.74, 0.7),
      student("tara", "Tara Bose", "#F4511E", "Ritu Bose", "tara.parent@example.in", 0.93, 0.9, 0.84),
      student("neel", "Neel Kulkarni", "#8E24AA", "Sadhana Kulkarni", "sadhana.kulkarni@example.in", 0.7, 0.5, 0.52),
    ],
  },
  {
    id: "batch_g6s",
    name: "Grade 6 Science",
    subject: "Science",
    gradeLabel: "G6 Sci",
    colorHex: "#43A047",
    teacherId: "user_rao",
    students: [
      student("sara", "Sara Iyer", "#D81B60", "Lakshmi Iyer", "lakshmi.iyer@example.in", 0.97, 0.98, 0.91),
      student("veer", "Veer Chauhan", "#3949AB", "Manish Chauhan", "manish.chauhan@example.in", 0.9, 0.8, 0.75),
      student("ira", "Ira Banerjee", "#EC407A", "Suchitra Banerjee", "suchitra.banerjee@example.in", 0.94, 0.9, 0.86),
      student("advait", "Advait Rane", "#00897B", "Prakash Rane", "prakash.rane@example.in", 0.87, 0.7, 0.68),
      student("kiara", "Kiara Sethi", "#7E57C2", "Nidhi Sethi", "nidhi.sethi@example.in", 0.92, 0.88, 0.82),
    ],
  },
  {
    id: "batch_g8c",
    name: "Grade 8 Chemistry",
    subject: "Chemistry",
    gradeLabel: "G8 Chem",
    colorHex: "#3949AB",
    teacherId: "user_bose",
    students: [
      student("rudra", "Rudra Deshmukh", "#3949AB", "Sneha Deshmukh", "sneha.deshmukh@example.in", 0.88, 0.78, 0.74),
      student("avni", "Avni Kaur", "#D81B60", "Gurpreet Kaur", "gurpreet.kaur@example.in", 0.91, 0.86, 0.8),
      student("ayaan", "Ayaan Mirza", "#1E88E5", "Sameer Mirza", "sameer.mirza@example.in", 0.83, 0.64, 0.62),
      student("navya", "Navya Shetty", "#43A047", "Roshan Shetty", "roshan.shetty@example.in", 0.89, 0.82, 0.77),
    ],
  },
];

// -------------------------------------------------------- deterministic RNG --

/**
 * Mulberry32 — a small, fast, deterministic PRNG.
 * `Math.random()` would make every seed run produce different metrics, so a
 * screenshot in a bug report could never be reproduced.
 */
function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260803);

/** Weekdays only, oldest first — tuition centres do not meet on Sundays. */
function recentWeekdays(count: number): Date[] {
  const days: Date[] = [];
  let cursor = startOfDayUtc();

  while (days.length < count) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0) days.push(new Date(cursor));
    cursor = addDays(cursor, -1);
  }

  return days.reverse();
}

// -------------------------------------------------------------------- seed --

async function seedPeople(passwordHash: string) {
  await db.centre.upsert({
    where: { id: CENTRE_ID },
    create: {
      id: CENTRE_ID,
      name: "Bright Minds Academy",
      slug: "bright-minds-academy",
      plan: "CENTRE",
      seatLimit: 150,
    },
    update: { name: "Bright Minds Academy" },
  });

  for (const member of STAFF) {
    await db.user.upsert({
      where: { id: member.id },
      create: {
        id: member.id,
        centreId: CENTRE_ID,
        email: member.email,
        passwordHash,
        fullName: member.fullName,
        role: member.role,
        avatarColor: member.color,
      },
      update: { fullName: member.fullName, passwordHash, role: member.role },
    });
  }
}

async function seedBatchesAndStudents(passwordHash: string) {
  for (const batch of BATCHES) {
    await db.batch.upsert({
      where: { id: batch.id },
      create: {
        id: batch.id,
        centreId: CENTRE_ID,
        name: batch.name,
        subject: batch.subject,
        gradeLabel: batch.gradeLabel,
        colorHex: batch.colorHex,
        teacherId: batch.teacherId,
      },
      update: { name: batch.name, teacherId: batch.teacherId },
    });

    for (const fixture of batch.students) {
      const studentId = `stu_${fixture.key}`;
      const parentId = `par_${fixture.key}`;

      await db.student.upsert({
        where: { id: studentId },
        create: {
          id: studentId,
          centreId: CENTRE_ID,
          fullName: fixture.fullName,
          avatarColor: fixture.color,
          gradeLabel: batch.gradeLabel,
        },
        update: { fullName: fixture.fullName },
      });

      await db.user.upsert({
        where: { id: parentId },
        create: {
          id: parentId,
          centreId: CENTRE_ID,
          email: fixture.guardianEmail,
          passwordHash,
          fullName: fixture.guardianName,
          role: ROLE.PARENT,
          phone: "+910000000000",
          avatarColor: fixture.color,
        },
        update: { fullName: fixture.guardianName, passwordHash },
      });

      await db.parentLink.upsert({
        where: { parentId_studentId: { parentId, studentId } },
        create: { parentId, studentId, isPrimary: true },
        update: {},
      });

      await db.enrollment.upsert({
        where: { batchId_studentId: { batchId: batch.id, studentId } },
        create: { batchId: batch.id, studentId },
        update: { isActive: true },
      });
    }
  }
}

/** A staff session, exactly as the app would construct it after login. */
function sessionFor(userId: string): SessionUser {
  const member = STAFF.find((candidate) => candidate.id === userId);
  if (!member) throw new Error(`Unknown staff fixture: ${userId}`);

  return {
    userId: member.id,
    centreId: CENTRE_ID,
    role: member.role,
    fullName: member.fullName,
    email: member.email,
    isStaff: true,
  };
}

async function seedHistory() {
  const days = recentWeekdays(HISTORY_DAYS);

  for (const batch of BATCHES) {
    const session = sessionFor(batch.teacherId);

    for (const day of days) {
      const date = toDateInputValue(day);

      await saveBatchAttendance(session, {
        batchId: batch.id,
        sessionDate: date,
        marks: batch.students.map((fixture) => ({
          studentId: `stu_${fixture.key}`,
          status: rollAttendance(fixture.attendance),
        })),
      });

      // Homework is not set every single day — roughly three days in four.
      if (random() < 0.75) {
        await saveBatchHomework(session, {
          batchId: batch.id,
          recordedOn: date,
          marks: batch.students.map((fixture) => ({
            studentId: `stu_${fixture.key}`,
            status: rollHomework(fixture.homework),
          })),
        });
      }
    }

    // Two tests per batch across the period.
    const testDays = [days[Math.floor(days.length * 0.35)], days[days.length - 3]];

    for (const [index, testDay] of testDays.entries()) {
      if (!testDay) continue;

      const maxScore = 25;
      await saveAssessment(session, {
        batchId: batch.id,
        title: `${batch.subject} Unit Test ${index + 1}`,
        maxScore,
        assessedOn: toDateInputValue(testDay),
        scores: batch.students.map((fixture) => ({
          studentId: `stu_${fixture.key}`,
          score: rollScore(fixture.ability, maxScore),
        })),
      });
    }
  }
}

function rollAttendance(propensity: number) {
  const roll = random();
  if (roll < propensity) return ATTENDANCE_STATUS.PRESENT;
  // A small slice of non-attendance is lateness rather than absence.
  if (roll < propensity + 0.06) return ATTENDANCE_STATUS.LATE;
  return ATTENDANCE_STATUS.ABSENT;
}

function rollHomework(propensity: number) {
  const roll = random();
  if (roll < propensity) return HOMEWORK_STATUS.DONE;
  if (roll < propensity + 0.15) return HOMEWORK_STATUS.PARTIAL;
  return HOMEWORK_STATUS.MISSING;
}

function rollScore(ability: number, maxScore: number): number {
  // ±15% variation around the student's typical performance.
  const variation = (random() - 0.5) * 0.3;
  const fraction = Math.min(1, Math.max(0, ability + variation));
  return Math.round(fraction * maxScore);
}

/** A few human touches so the timelines do not read as pure machine output. */
async function seedHumanTouches() {
  const rao = sessionFor("user_rao");
  const mehta = sessionFor("user_mehta");

  await postNote(rao, {
    studentId: "stu_aarav",
    body: "Aarav answered two tricky algebra questions in front of the class today. Really strong week.",
  });

  await logEngagement(rao, {
    studentId: "stu_aarav",
    batchId: "batch_g7m",
    delta: 6,
    note: "Led the group problem-solving session confidently.",
  });

  await postNote(mehta, {
    studentId: "stu_kabirs",
    body: "Kabir has missed several sessions this month. Could we set up a short call to plan a catch-up?",
  });

  await logEngagement(mehta, {
    studentId: "stu_kabirs",
    batchId: "batch_g9p",
    delta: -6,
    note: "Struggled to focus today — worth a gentle word at home.",
  });

  await logEngagement(rao, {
    studentId: "stu_reyansh",
    batchId: "batch_g7m",
    delta: -6,
  });
}

/**
 * Backdate when historical entries were *written* to when they *happened*.
 *
 * The seed creates several weeks of history in one run, so every row's
 * `createdAt` is the moment the script ran. That makes the dashboard report
 * "1,434 progress updates posted today", which is true of the database and
 * absurd as a description of a centre. Aligning `createdAt` with `occurredAt`
 * for day-keyed entries makes seeded history look the way real history does.
 *
 * Entries recorded at a genuine moment (notes, engagement) already have
 * matching timestamps and are left untouched by the WHERE clause.
 */
async function backdateSeededHistory() {
  await db.$executeRaw`
    UPDATE "TimelineEntry"
    SET "createdAt" = "occurredAt"
    WHERE "occurredAt" < "createdAt"
  `;
}

async function main() {
  console.log("Seeding EduTrack…");

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  await seedPeople(passwordHash);
  await seedBatchesAndStudents(passwordHash);
  console.log("  people, batches and enrollments ready");

  await seedHistory();
  console.log(`  ${HISTORY_DAYS} weekdays of attendance, homework and tests logged`);

  await seedHumanTouches();
  await backdateSeededHistory();

  const [students, entries, queued] = await Promise.all([
    db.student.count({ where: { centreId: CENTRE_ID } }),
    db.timelineEntry.count({ where: { centreId: CENTRE_ID } }),
    db.notificationOutbox.count({ where: { centreId: CENTRE_ID } }),
  ]);

  console.log(
    `\nDone — ${students} students, ${entries} timeline entries, ${queued} notifications queued.`,
  );
  console.log("\nSign in at /login with password:", DEMO_PASSWORD);
  console.log("  Owner   priya@brightminds.in");
  console.log("  Teacher rao@brightminds.in");
  console.log("  Parent  anita.sharma@example.in  (Aarav Sharma)");
  console.log("  Parent  harjit.singh@example.in  (Kabir Singh — at risk)");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
