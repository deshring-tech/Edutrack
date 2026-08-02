import React, { useState, useMemo } from "react";
import {
  ArrowLeft, Search, Send, Check, CheckCheck, MoreVertical,
  CalendarCheck, BookOpen, Star, StickyNote, X, ChevronDown,
  Users, GraduationCap, ShieldCheck, Phone, Video, AlertTriangle,
  TrendingUp, Activity, Layers, Check as CheckIcon, Sparkles,
  ClipboardList, Award, Paperclip, Plus, FileText,
  Minus, ChevronRight, UserCheck, Bell
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";

/* ============================================================
   EduTrack — student progress tracker (MVP, multi-view)
   Views: Teacher app · Parent app · Centre dashboard · Plans
   ============================================================ */

const GREEN_DARK = "#075E54";
const GREEN = "#128C7E";
const GREEN_BRIGHT = "#25D366";
const BUBBLE_OUT = "#D9FDD3";
const CHAT_BG = "#ECE5DD";
const PANEL = "#F7F4EF";
const INK = "#15302C";

const doodle =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23000000' stroke-opacity='0.03' stroke-width='2'%3E%3Ccircle cx='20' cy='20' r='8'/%3E%3Cpath d='M70 30 l12 0 0 12'/%3E%3Crect x='80' y='75' width='16' height='16' rx='3'/%3E%3Cpath d='M25 85 q10 -12 22 0'/%3E%3C/g%3E%3C/svg%3E\")";

const KIND = {
  attendance: { icon: CalendarCheck, label: "Attendance", tint: "#1E88E5" },
  homework:   { icon: BookOpen,      label: "Homework",   tint: "#43A047" },
  engagement: { icon: Star,          label: "Engagement", tint: "#FB8C00" },
  assignment: { icon: ClipboardList, label: "Assignment", tint: "#3949AB" },
  test:       { icon: Award,         label: "Test result", tint: "#00897B" },
  note:       { icon: StickyNote,    label: "Note",       tint: "#8E24AA" },
};

const seedStudents = [
  { id: 1, name: "Aarav Sharma", klass: "Grade 7 · Math", color: "#7E57C2", mine: true, unread: 2,
    daysPresent: 18, daysTotal: 20, hwDone: 14, hwTotal: 16, engagement: 82,
    feed: [
      { id: "a1", kind: "attendance", text: "Present in today's session.", by: "Ms. Rao", time: "9:02 AM", ack: false },
      { id: "a2", kind: "homework", text: "Submitted Algebra worksheet — on time, 9/10 correct.", by: "Ms. Rao", time: "9:40 AM", ack: false },
      { id: "a3", kind: "engagement", text: "Answered two tricky questions confidently. Great focus today ⭐", by: "Ms. Rao", time: "10:15 AM", ack: false },
    ] },
  { id: 2, name: "Diya Patel", klass: "Grade 5 · English", color: "#26A69A", mine: false, unread: 0,
    daysPresent: 15, daysTotal: 20, hwDone: 9, hwTotal: 15, engagement: 58,
    feed: [
      { id: "b1", kind: "note", text: "Reading fluency improving. Suggest 10 mins daily reading at home.", by: "Mr. Khan", time: "Yesterday", ack: true },
      { id: "b2", kind: "homework", text: "Essay homework pending — due tomorrow.", by: "Mr. Khan", time: "4:30 PM", ack: false },
    ] },
  { id: 3, name: "Kabir Singh", klass: "Grade 9 · Physics", color: "#EF6C00", mine: true, unread: 1,
    daysPresent: 12, daysTotal: 20, hwDone: 6, hwTotal: 14, engagement: 44,
    feed: [
      { id: "c1", kind: "attendance", text: "Marked absent today. Please confirm reason.", by: "Dr. Mehta", time: "8:50 AM", ack: false },
      { id: "c2", kind: "note", text: "Missed two homeworks this week. Let's set up a catch-up plan.", by: "Dr. Mehta", time: "Mon", ack: true },
    ] },
  { id: 4, name: "Sara Iyer", klass: "Grade 6 · Science", color: "#D81B60", mine: false, unread: 0,
    daysPresent: 19, daysTotal: 20, hwDone: 13, hwTotal: 13, engagement: 91,
    feed: [
      { id: "d1", kind: "engagement", text: "Led the group experiment beautifully today ⭐", by: "Ms. Rao", time: "11:00 AM", ack: true },
    ] },
];

const classesData = [
  { name: "Grade 7 Math", short: "G7 Math", teacher: "Ms. Rao", students: 22, att: 91, hw: 84, status: "good" },
  { name: "Grade 6 Science", short: "G6 Sci", teacher: "Ms. Rao", students: 20, att: 94, hw: 88, status: "good" },
  { name: "Grade 8 Chemistry", short: "G8 Chem", teacher: "Mr. Bose", students: 19, att: 85, hw: 73, status: "good" },
  { name: "Grade 5 English", short: "G5 Eng", teacher: "Mr. Khan", students: 18, att: 79, hw: 61, status: "watch" },
  { name: "Grade 9 Physics", short: "G9 Phy", teacher: "Dr. Mehta", students: 15, att: 72, hw: 55, status: "risk" },
];

const atRisk = [
  { name: "Kabir Singh", klass: "G9 Physics", reason: "Attendance 60% · 2 HW missed", color: "#EF6C00" },
  { name: "Reyansh Gupta", klass: "G5 English", reason: "Engagement low 3 weeks", color: "#5C6BC0" },
  { name: "Anika Verma", klass: "G9 Physics", reason: "Homework 41% this month", color: "#00897B" },
];

function pct(a, b) { return b === 0 ? 0 : Math.round((a / b) * 100); }
function engLabel(v) { return v >= 80 ? "Excellent" : v >= 60 ? "Good" : v >= 40 ? "Fair" : "Needs focus"; }
function lastSnippet(s) { const f = s.feed[s.feed.length - 1]; return f ? f.text : "No updates yet"; }
function lastTime(s) { const f = s.feed[s.feed.length - 1]; return f ? f.time : ""; }
const statusColor = { good: "#43A047", watch: "#FB8C00", risk: "#E53935" };
const statusLabel = { good: "On track", watch: "Watch", risk: "At risk" };

function Avatar({ name, color, size = 46 }) {
  const initials = name.split(" ").map(w => w[0]).slice(0, 2).join("");
  return (
    <div className="flex items-center justify-center text-white font-semibold shrink-0"
      style={{ width: size, height: size, borderRadius: "50%", background: color, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

function Ring({ value, size = 40, label }) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  const col = value >= 75 ? GREEN_BRIGHT : value >= 50 ? "#FBC02D" : "#E53935";
  return (
    <div className="flex flex-col items-center" style={{ width: size + 8 }}>
      <svg width={size} height={size}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#E3E3E3" strokeWidth="5" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={col} strokeWidth="5"
          strokeDasharray={c} strokeDashoffset={c - (c * value) / 100} strokeLinecap="round"
          transform={`rotate(-90 ${size/2} ${size/2})`} style={{ transition: "stroke-dashoffset .5s ease" }} />
        <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
          fontSize={size * 0.28} fontWeight="700" fill="#444">{value}</text>
      </svg>
      {label && <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>}
    </div>
  );
}

function MetricBar({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 30, height: 30, background: tint + "22" }}>
        <Icon size={16} style={{ color: tint }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline">
          <span className="text-[13px] font-medium text-gray-700">{label}</span>
          <span className="text-[13px] font-semibold text-gray-800">{sub}</span>
        </div>
        <div className="h-1.5 rounded-full mt-1" style={{ background: "#E6E1D8" }}>
          <div className="h-1.5 rounded-full" style={{ width: value + "%", background: tint, transition: "width .5s ease" }} />
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, grow }) {
  return (
    <label className={grow ? "flex-1 block" : "block"}>
      <span className="text-[11px] font-semibold text-gray-500 ml-0.5">{label}</span>
      {children}
    </label>
  );
}

function Chip({ icon: Icon, label, color, onClick }) {
  return (
    <button onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap shadow-sm"
      style={{ background: "#fff", color, border: `1px solid ${color}33` }}>
      <Icon size={13} /> {label}
    </button>
  );
}

/* ---------------- PHONE APP (teacher / parent) ---------------- */
function PhoneApp({ role, students, setStudents }) {
  const [selId, setSelId] = useState(null);
  const [draft, setDraft] = useState("");
  const [showPanel, setShowPanel] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null); // 'assign' | 'test' | null
  const [asgTitle, setAsgTitle] = useState("");
  const [asgDue, setAsgDue] = useState("");
  const [asgFile, setAsgFile] = useState("");
  const [testName, setTestName] = useState("");
  const [testScore, setTestScore] = useState("");
  const [testMax, setTestMax] = useState("");

  const visible = useMemo(() => {
    let list = role === "parent" ? students.filter(s => s.mine) : students;
    if (query.trim()) list = list.filter(s => s.name.toLowerCase().includes(query.toLowerCase()));
    return list;
  }, [students, role, query]);

  const sel = students.find(s => s.id === selId) || null;

  function openStudent(id) {
    setSelId(id); setShowPanel(false);
    setStudents(prev => prev.map(s => s.id === id ? { ...s, unread: 0 } : s));
  }
  function applyDeltas(s, d) {
    const out = {};
    if (d.present) { out.daysPresent = s.daysPresent + 1; out.daysTotal = s.daysTotal + 1; }
    if (d.absent)  { out.daysTotal = s.daysTotal + 1; }
    if (d.hwDone)  { out.hwDone = s.hwDone + 1; out.hwTotal = s.hwTotal + 1; }
    if (d.eng)     { out.engagement = Math.min(100, s.engagement + 6); }
    return out;
  }
  function pushUpdate(kind, text, deltas = {}) {
    setStudents(prev => prev.map(s => {
      if (s.id !== selId) return s;
      const ns = { ...s, ...applyDeltas(s, deltas) };
      ns.feed = [...s.feed, { id: Math.random().toString(36).slice(2), kind, text, by: "You", time: "Just now", ack: false }];
      return ns;
    }));
  }
  function sendNote() { if (!draft.trim()) return; pushUpdate("note", draft.trim()); setDraft(""); }
  function postAssignment() {
    if (!asgTitle.trim()) return;
    const bits = [`New assignment: ${asgTitle.trim()}`];
    if (asgDue) bits.push(`due ${asgDue}`);
    if (asgFile) bits.push(`📎 ${asgFile}`);
    pushUpdate("assignment", bits.join(" · "));
    setModal(null); setAsgTitle(""); setAsgDue(""); setAsgFile("");
  }
  function postTest() {
    if (!testName.trim() || !testScore) return;
    const sc = Number(testScore), mx = Number(testMax) || 100;
    const p = Math.round((sc / mx) * 100);
    setStudents(prev => prev.map(s => {
      if (s.id !== selId) return s;
      const tests = [...(s.tests || []), { name: testName.trim(), score: sc, max: mx }];
      return { ...s, tests, feed: [...s.feed, {
        id: Math.random().toString(36).slice(2), kind: "test",
        text: `${testName.trim()}: ${sc}/${mx} (${p}%)`, by: "You", time: "Just now", ack: false }] };
    }));
    setModal(null); setTestName(""); setTestScore(""); setTestMax("");
  }
  function acknowledge(fid) {
    setStudents(prev => prev.map(s => s.id !== selId ? s :
      { ...s, feed: s.feed.map(f => f.id === fid ? { ...f, ack: true } : f) }));
  }

  return (
    <div className="relative rounded-[2.2rem] shadow-2xl overflow-hidden mx-auto"
      style={{ width: 420, maxWidth: "100%", height: 720, background: "#000", padding: 8 }}>
      <div className="relative w-full h-full overflow-hidden rounded-[1.8rem] flex flex-col" style={{ background: CHAT_BG }}>
        {!sel ? (
          <>
            <div className="px-4 pt-3 pb-3 flex items-center justify-between" style={{ background: GREEN_DARK }}>
              <div>
                <h1 className="text-white text-lg font-semibold leading-tight">{role === "teacher" ? "My Students" : "My Children"}</h1>
                <p className="text-[11px]" style={{ color: "#B9E0DA" }}>{role === "teacher" ? "Tap a student to update progress" : "Tap to view live progress"}</p>
              </div>
              <MoreVertical color="#fff" size={20} />
            </div>
            <div className="px-3 py-2" style={{ background: GREEN_DARK }}>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: "#0b6b60" }}>
                <Search size={16} color="#9fd6cd" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search students"
                  className="bg-transparent outline-none text-sm text-white placeholder:text-[#9fd6cd] w-full" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto bg-white">
              {visible.map(s => {
                const k = KIND[s.feed[s.feed.length - 1]?.kind] || KIND.note; const KIcon = k.icon;
                return (
                  <button key={s.id} onClick={() => openStudent(s.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 border-b text-left hover:bg-gray-50" style={{ borderColor: "#F0F0F0" }}>
                    <Avatar name={s.name} color={s.color} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <span className="font-semibold text-[15px] text-gray-900 truncate">{s.name}</span>
                        <span className="text-[11px] text-gray-400 shrink-0 ml-2">{lastTime(s)}</span>
                      </div>
                      <div className="flex justify-between items-center mt-0.5">
                        <span className="text-[12.5px] text-gray-500 truncate flex items-center gap-1">
                          <KIcon size={12} style={{ color: k.tint }} className="shrink-0" />{lastSnippet(s)}
                        </span>
                        {s.unread > 0 && (
                          <span className="ml-2 shrink-0 text-[10px] font-bold text-white rounded-full flex items-center justify-center"
                            style={{ background: GREEN_BRIGHT, minWidth: 18, height: 18, padding: "0 5px" }}>{s.unread}</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {visible.length === 0 && <div className="text-center text-sm text-gray-400 mt-16">No students found.</div>}
            </div>
            <div className="px-4 py-2 text-center text-[10px] text-gray-400 bg-white border-t" style={{ borderColor: "#eee" }}>
              {role === "teacher" ? "Posting as a tutor at Bright Minds Academy" : "Read-only parent view · updates in real time"}
            </div>
          </>
        ) : (
          <>
            <div className="px-2 py-2 flex items-center gap-2" style={{ background: GREEN_DARK }}>
              <button onClick={() => setSelId(null)}><ArrowLeft color="#fff" size={22} /></button>
              <Avatar name={sel.name} color={sel.color} size={38} />
              <button className="flex-1 text-left" onClick={() => setShowPanel(p => !p)}>
                <div className="text-white font-semibold text-[15px] leading-tight">{sel.name}</div>
                <div className="text-[11px]" style={{ color: "#B9E0DA" }}>{sel.klass} · tap for progress</div>
              </button>
              <Video color="#fff" size={19} className="mr-1" />
              <Phone color="#fff" size={18} className="mr-1" />
              <ChevronDown color="#fff" size={20} onClick={() => setShowPanel(p => !p)}
                style={{ transform: showPanel ? "rotate(180deg)" : "none", transition: ".2s" }} />
            </div>
            {showPanel && (
              <div className="px-4 py-3 border-b" style={{ background: PANEL, borderColor: "#E6E1D8" }}>
                <div className="flex items-center justify-around mb-2">
                  <Ring value={pct(sel.daysPresent, sel.daysTotal)} label="Attendance" />
                  <Ring value={pct(sel.hwDone, sel.hwTotal)} label="Homework" />
                  <Ring value={sel.engagement} label="Engagement" />
                </div>
                <MetricBar icon={CalendarCheck} label="Attendance" tint="#1E88E5" value={pct(sel.daysPresent, sel.daysTotal)} sub={`${sel.daysPresent}/${sel.daysTotal} days`} />
                <MetricBar icon={BookOpen} label="Homework done" tint="#43A047" value={pct(sel.hwDone, sel.hwTotal)} sub={`${sel.hwDone}/${sel.hwTotal}`} />
                <MetricBar icon={Star} label="Class engagement" tint="#FB8C00" value={sel.engagement} sub={engLabel(sel.engagement)} />
                {sel.tests && sel.tests.length > 0 && (() => {
                  const avg = Math.round(sel.tests.reduce((a, t) => a + (t.score / t.max) * 100, 0) / sel.tests.length);
                  return <MetricBar icon={Award} label={`Test average (${sel.tests.length})`} tint="#00897B" value={avg} sub={avg + "%"} />;
                })()}
                {role === "parent" && sel.batchHw != null && (() => {
                  const mine = pct(sel.hwDone, sel.hwTotal), diff = mine - sel.batchHw;
                  const band = diff >= 6 ? ["Ahead of batch pace", "#2E7D32", "#E8F5E9"]
                    : diff <= -6 ? ["Slightly behind — a gentle nudge helps", "#B26A00", "#FFF4E5"]
                    : ["Keeping pace with the batch", "#1565C0", "#E8F0FE"];
                  return (
                    <div className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: band[2] }}>
                      <TrendingUp size={15} style={{ color: band[1] }} />
                      <span className="text-[12px] font-semibold" style={{ color: band[1] }}>{band[0]}</span>
                      <span className="text-[11px] text-gray-500 ml-auto">your child {mine}% · batch {sel.batchHw}%</span>
                    </div>
                  );
                })()}
              </div>
            )}
            <div className="flex-1 overflow-y-auto px-3 py-3" style={{ background: CHAT_BG, backgroundImage: doodle }}>
              <div className="flex justify-center mb-3">
                <span className="text-[10px] px-2 py-0.5 rounded-md" style={{ background: "#D9E7E4", color: "#5b6b68" }}>Progress timeline</span>
              </div>
              {sel.feed.map(f => {
                const k = KIND[f.kind]; const KIcon = k.icon;
                return (
                  <div key={f.id} className={`flex mb-2 ${role === "teacher" ? "justify-end" : "justify-start"}`}>
                    <div className="max-w-[80%] rounded-lg px-2.5 py-2 shadow-sm" style={{ background: role === "teacher" ? BUBBLE_OUT : "#fff" }}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <KIcon size={12} style={{ color: k.tint }} />
                        <span className="text-[10.5px] font-bold" style={{ color: k.tint }}>{k.label}</span>
                        <span className="text-[10px] text-gray-400">· {f.by}</span>
                      </div>
                      <p className="text-[13.5px] text-gray-800 leading-snug">{f.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-0.5">
                        {role === "parent" && !f.ack && (
                          <button onClick={() => acknowledge(f.id)} className="text-[10px] font-semibold mr-auto px-1.5 py-0.5 rounded" style={{ color: GREEN, background: "#E8F5E9" }}>Acknowledge</button>
                        )}
                        {f.ack && <span className="text-[10px] mr-auto" style={{ color: GREEN }}>✓ Seen by parent</span>}
                        <span className="text-[10px] text-gray-400">{f.time}</span>
                        {role === "teacher" && (f.ack ? <CheckCheck size={13} color="#34B7F1" /> : <Check size={13} color="#9aa" />)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {role === "teacher" ? (
              <div style={{ background: PANEL }} className="border-t">
                <div className="flex gap-2 px-3 pt-2 pb-1 overflow-x-auto">
                  <Chip color="#1E88E5" icon={CalendarCheck} label="Present" onClick={() => pushUpdate("attendance", "Marked present for today's session.", { present: true })} />
                  <Chip color="#E53935" icon={X} label="Absent" onClick={() => pushUpdate("attendance", "Marked absent today.", { absent: true })} />
                  <Chip color="#43A047" icon={BookOpen} label="HW done" onClick={() => pushUpdate("homework", "Homework submitted on time ✓", { hwDone: true })} />
                  <Chip color="#FB8C00" icon={Star} label="+Engagement" onClick={() => pushUpdate("engagement", "Active and engaged in class today ⭐", { eng: true })} />
                  <Chip color="#3949AB" icon={ClipboardList} label="Assign" onClick={() => setModal("assign")} />
                  <Chip color="#00897B" icon={Award} label="Test score" onClick={() => setModal("test")} />
                </div>
                <div className="flex items-center gap-2 px-3 pb-3 pt-1">
                  <div className="flex-1 flex items-center gap-2 bg-white rounded-full px-3 py-2 shadow-sm">
                    <StickyNote size={16} color="#8E24AA" />
                    <input value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && sendNote()}
                      placeholder="Write a note to parent…" className="flex-1 bg-transparent outline-none text-sm text-gray-800" />
                  </div>
                  <button onClick={sendNote} className="flex items-center justify-center rounded-full shadow" style={{ width: 42, height: 42, background: GREEN_DARK }}>
                    <Send size={18} color="#fff" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-3 border-t" style={{ background: PANEL }}>
                <div className="flex-1 flex items-center gap-2 text-[12.5px] text-gray-500 bg-white rounded-full px-4 py-2.5 shadow-sm">
                  <ShieldCheck size={15} color={GREEN} /> Updates are posted by your tutor. Tap a card to acknowledge.
                </div>
              </div>
            )}

            {/* Modals: assignment / test */}
            {modal && (
              <div className="absolute inset-0 z-20 flex items-end" style={{ background: "rgba(0,0,0,0.35)" }}
                onClick={() => setModal(null)}>
                <div className="w-full rounded-t-2xl bg-white p-4 pb-5" onClick={e => e.stopPropagation()}
                  style={{ animation: "none" }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {modal === "assign"
                        ? <><ClipboardList size={18} color="#3949AB" /><span className="font-semibold text-gray-800">New assignment</span></>
                        : <><Award size={18} color="#00897B" /><span className="font-semibold text-gray-800">Record test result</span></>}
                    </div>
                    <button onClick={() => setModal(null)}><X size={18} color="#999" /></button>
                  </div>

                  {modal === "assign" ? (
                    <div className="space-y-2.5">
                      <Field label="Title">
                        <input value={asgTitle} onChange={e => setAsgTitle(e.target.value)} autoFocus
                          placeholder="e.g. Algebra worksheet — Ch. 4" className="modal-in" />
                      </Field>
                      <div className="flex gap-2">
                        <Field label="Due date" grow>
                          <input value={asgDue} onChange={e => setAsgDue(e.target.value)} placeholder="e.g. Fri 6 Jun" className="modal-in" />
                        </Field>
                      </div>
                      <button onClick={() => setAsgFile(asgFile ? "" : "worksheet_ch4.pdf")}
                        className="flex items-center gap-2 text-[13px] font-medium px-3 py-2 rounded-lg w-full border border-dashed"
                        style={{ color: "#3949AB", borderColor: "#3949AB55", background: "#3949AB0d" }}>
                        <Paperclip size={15} /> {asgFile ? `Attached: ${asgFile} (tap to remove)` : "Attach worksheet (photo / PDF)"}
                      </button>
                      <p className="text-[11px] text-gray-400 leading-snug">
                        Parents see the assignment instantly and get a reminder before it's due.
                      </p>
                      <button onClick={postAssignment} disabled={!asgTitle.trim()}
                        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white mt-1 disabled:opacity-40"
                        style={{ background: GREEN_DARK }}>Post assignment</button>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Field label="Test / quiz name">
                        <input value={testName} onChange={e => setTestName(e.target.value)} autoFocus
                          placeholder="e.g. Unit Test 3 — Fractions" className="modal-in" />
                      </Field>
                      <div className="flex gap-2">
                        <Field label="Score" grow>
                          <input value={testScore} onChange={e => setTestScore(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="numeric" placeholder="18" className="modal-in" />
                        </Field>
                        <Field label="Out of" grow>
                          <input value={testMax} onChange={e => setTestMax(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="numeric" placeholder="25" className="modal-in" />
                        </Field>
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug">
                        Recorded on the child's timeline and rolled into their test average — no auto-grading, just the result.
                      </p>
                      <button onClick={postTest} disabled={!testName.trim() || !testScore}
                        className="w-full rounded-xl py-2.5 text-sm font-semibold text-white mt-1 disabled:opacity-40"
                        style={{ background: GREEN_DARK }}>Save result</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ---------------- CENTRE DASHBOARD (desktop) ---------------- */
function Kpi({ icon: Icon, label, value, sub, tint }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: "#EEE" }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-medium text-gray-500">{label}</span>
        <div className="flex items-center justify-center rounded-lg" style={{ width: 30, height: 30, background: tint + "1c" }}>
          <Icon size={16} style={{ color: tint }} />
        </div>
      </div>
      <div className="text-3xl font-bold" style={{ color: INK, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{value}</div>
      <div className="text-[11.5px] text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function Dashboard() {
  const totalStudents = classesData.reduce((a, c) => a + c.students, 0);
  const wAtt = Math.round(classesData.reduce((a, c) => a + c.att * c.students, 0) / totalStudents);
  const wHw = Math.round(classesData.reduce((a, c) => a + c.hw * c.students, 0) / totalStudents);
  const chart = classesData.map(c => ({ name: c.short, att: c.att, color: statusColor[c.status] }));

  return (
    <div className="w-full max-w-[960px] mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: INK, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Bright Minds Academy</h2>
          <p className="text-sm text-gray-500">Centre overview · today</p>
        </div>
        <span className="text-xs font-semibold px-3 py-1.5 rounded-full" style={{ background: "#E8F5E9", color: GREEN_DARK }}>Centre plan · 124/150 seats</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi icon={Users} label="Active students" value={totalStudents} sub="across 5 classes" tint="#1E88E5" />
        <Kpi icon={CalendarCheck} label="Avg attendance" value={wAtt + "%"} sub="this month" tint="#43A047" />
        <Kpi icon={BookOpen} label="Homework done" value={wHw + "%"} sub="completion rate" tint="#FB8C00" />
        <Kpi icon={AlertTriangle} label="Need attention" value="9" sub="flagged students" tint="#E53935" />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: "#EEE" }}>
          <div className="flex items-center gap-2 mb-3"><Layers size={16} color={GREEN} /><h3 className="font-semibold text-gray-800">Classes</h3></div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-[11px] text-gray-400 uppercase">
                <th className="py-2">Class</th><th>Teacher</th><th>Students</th><th>Attendance</th><th>Status</th>
              </tr></thead>
              <tbody>
                {classesData.map(c => (
                  <tr key={c.name} className="border-t" style={{ borderColor: "#F2F2F2" }}>
                    <td className="py-2.5 font-medium text-gray-800">{c.name}</td>
                    <td className="text-gray-500">{c.teacher}</td>
                    <td className="text-gray-600">{c.students}</td>
                    <td><div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 rounded-full" style={{ background: "#EEE" }}>
                        <div className="h-1.5 rounded-full" style={{ width: c.att + "%", background: statusColor[c.status] }} /></div>
                      <span className="text-gray-600 text-xs">{c.att}%</span></div></td>
                    <td><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ background: statusColor[c.status] + "1c", color: statusColor[c.status] }}>{statusLabel[c.status]}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-1"><TrendingUp size={15} color={GREEN} /><span className="text-[12px] font-semibold text-gray-600">Attendance by class</span></div>
            <div style={{ width: "100%", height: 150 }}>
              <ResponsiveContainer>
                <BarChart data={chart} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#aaa" }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: "#00000008" }} contentStyle={{ borderRadius: 10, fontSize: 12, border: "1px solid #eee" }} />
                  <Bar dataKey="att" radius={[6, 6, 0, 0]}>
                    {chart.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: "#EEE" }}>
            <div className="flex items-center gap-2 mb-3"><AlertTriangle size={16} color="#E53935" /><h3 className="font-semibold text-gray-800">Needs attention</h3></div>
            {atRisk.map(a => (
              <div key={a.name} className="flex items-center gap-2.5 py-2 border-t first:border-0" style={{ borderColor: "#F2F2F2" }}>
                <Avatar name={a.name} color={a.color} size={34} />
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-gray-800 truncate">{a.name} <span className="text-gray-400 font-normal">· {a.klass}</span></div>
                  <div className="text-[11px] text-red-500 truncate">{a.reason}</div>
                </div>
              </div>
            ))}
            <button className="text-[12px] font-semibold mt-2" style={{ color: GREEN }}>View all 9 →</button>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border" style={{ borderColor: "#EEE" }}>
            <div className="flex items-center gap-2 mb-2"><Activity size={16} color={GREEN} /><h3 className="font-semibold text-gray-800">Teacher activity today</h3></div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              <b style={{ color: INK }}>47</b> progress updates posted · <b style={{ color: INK }}>5</b> of 5 teachers active ·
              parents acknowledged <b style={{ color: INK }}>38</b> updates.
            </p>
            <div className="mt-2 h-1.5 rounded-full" style={{ background: "#EEE" }}>
              <div className="h-1.5 rounded-full" style={{ width: "81%", background: GREEN_BRIGHT }} />
            </div>
            <p className="text-[11px] text-gray-400 mt-1">81% parent engagement this week</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- PLANS ---------------- */
const plans = [
  { name: "Solo Tutor", price: "₹499", unit: "/mo", tag: "For individual tutors", seats: "Up to 25 students",
    feats: ["1 teacher account", "Attendance · homework · engagement", "Parent app (free for parents)", "Basic progress timeline"], hot: false },
  { name: "Centre", price: "₹3,499", unit: "/mo", tag: "For coaching centres", seats: "Up to 150 students",
    feats: ["Unlimited teachers", "Centre admin dashboard", "At-risk student alerts", "Class & attendance reports", "Branded with your logo"], hot: true },
  { name: "Institute", price: "Custom", unit: "", tag: "For schools & chains", seats: "Unlimited students",
    feats: ["Multi-branch admin", "Role-based access", "Data export & API", "Priority support & onboarding", "SSO for staff"], hot: false },
];

function Plans() {
  return (
    <div className="w-full max-w-[960px] mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold" style={{ color: INK, fontFamily: "'Bricolage Grotesque', sans-serif" }}>Plans for centres & schools</h2>
        <p className="text-sm text-gray-500 mt-1">Centres pay per active student. <b>Parents always join free.</b> 14-day free trial.</p>
        <p className="text-[11px] text-gray-400 mt-1">Prices are placeholders for the demo — your call.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {plans.map(p => (
          <div key={p.name} className="relative rounded-2xl p-5 bg-white border shadow-sm flex flex-col"
            style={{ borderColor: p.hot ? GREEN : "#EEE", borderWidth: p.hot ? 2 : 1 }}>
            {p.hot && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white px-3 py-1 rounded-full flex items-center gap-1" style={{ background: GREEN_DARK }}>
                <Sparkles size={11} /> MOST POPULAR
              </span>
            )}
            <h3 className="font-bold text-lg" style={{ color: INK }}>{p.name}</h3>
            <p className="text-[12px] text-gray-400 mb-3">{p.tag}</p>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold" style={{ color: INK, fontFamily: "'Bricolage Grotesque', sans-serif" }}>{p.price}</span>
              <span className="text-sm text-gray-400">{p.unit}</span>
            </div>
            <p className="text-[12px] font-semibold mb-3" style={{ color: GREEN }}>{p.seats}</p>
            <div className="flex-1 space-y-2 mb-4">
              {p.feats.map(f => (
                <div key={f} className="flex items-start gap-2 text-[13px] text-gray-600">
                  <CheckIcon size={15} className="mt-0.5 shrink-0" style={{ color: GREEN_BRIGHT }} /> {f}
                </div>
              ))}
            </div>
            <button className="w-full rounded-xl py-2.5 text-sm font-semibold transition-transform hover:scale-[1.02]"
              style={p.hot ? { background: GREEN_DARK, color: "#fff" } : { background: "#F1F1F1", color: INK }}>
              {p.price === "Custom" ? "Contact sales" : "Start free trial"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- BATCH LOGGING (teacher, one screen) ---------------- */
const ROSTERS = {
  g7m: {
    name: "Grade 7 · Math", teacher: "Ms. Rao", color: "#7E57C2",
    seed: { att: 91, hw: 84, testAvg: 72 },
    roster: [
      ["Aarav Sharma", "#7E57C2"], ["Diya Patel", "#26A69A"], ["Ishaan Roy", "#5C6BC0"],
      ["Ananya Das", "#EC407A"], ["Vivaan Nair", "#00897B"], ["Myra Kapoor", "#8E24AA"],
      ["Kabir Jain", "#EF6C00"], ["Saanvi Rao", "#43A047"], ["Reyansh Gupta", "#3949AB"],
      ["Aisha Khan", "#D81B60"], ["Arjun Menon", "#1E88E5"], ["Tara Bose", "#F4511E"],
    ],
  },
  g9p: {
    name: "Grade 9 · Physics", teacher: "Dr. Mehta", color: "#EF6C00",
    seed: { att: 72, hw: 55, testAvg: 61 },
    roster: [
      ["Kabir Singh", "#EF6C00"], ["Anika Verma", "#00897B"], ["Rohan Iyer", "#5C6BC0"],
      ["Zara Sheikh", "#EC407A"], ["Dev Malhotra", "#43A047"], ["Nisha Pillai", "#8E24AA"],
      ["Yash Agarwal", "#1E88E5"], ["Pari Reddy", "#D81B60"], ["Kian Dutta", "#F4511E"],
      ["Mira Joshi", "#26A69A"],
    ],
  },
};

function BatchView() {
  const [selBatch, setSelBatch] = useState(null);
  const [task, setTask] = useState("attendance");
  const [present, setPresent] = useState({});
  const [hw, setHw] = useState({});
  const [scores, setScores] = useState({});
  const [testName, setTestName] = useState("");
  const [testMax, setTestMax] = useState("25");
  const [banner, setBanner] = useState(null);
  const [stats, setStats] = useState(() => {
    const o = {}; Object.keys(ROSTERS).forEach(k => o[k] = { ...ROSTERS[k].seed }); return o;
  });

  const batch = selBatch ? ROSTERS[selBatch] : null;
  const roster = batch ? batch.roster.map(([n, c], i) => ({ id: `${selBatch}-${i}`, name: n, color: c })) : [];

  function openBatch(id) {
    setSelBatch(id); setTask("attendance"); setBanner(null);
    const p = {}; ROSTERS[id].roster.forEach((_, i) => p[`${id}-${i}`] = true);
    setPresent(p); setHw({}); setScores({}); setTestName(""); setTestMax("25");
  }
  function flash(msg) { setBanner(msg); setTimeout(() => setBanner(null), 3200); }

  const presentCount = roster.filter(r => present[r.id]).length;
  const absentCount = roster.length - presentCount;
  const hwCounts = roster.reduce((a, r) => { const v = hw[r.id]; if (v) a[v] = (a[v] || 0) + 1; return a; }, {});
  const enteredScores = roster.map(r => scores[r.id]).filter(v => v !== undefined && v !== "");
  const liveAvg = enteredScores.length
    ? Math.round((enteredScores.reduce((a, v) => a + Number(v), 0) / enteredScores.length / (Number(testMax) || 1)) * 100)
    : null;

  function saveAttendance() {
    setStats(s => ({ ...s, [selBatch]: { ...s[selBatch], att: Math.round((presentCount / roster.length) * 100) } }));
    flash(`Attendance saved · ${presentCount} present, ${absentCount} absent · ${roster.length} parents notified`);
  }
  function saveHomework() {
    const done = (hwCounts.done || 0) + (hwCounts.partial || 0) * 0.5;
    setStats(s => ({ ...s, [selBatch]: { ...s[selBatch], hw: Math.round((done / roster.length) * 100) } }));
    flash(`Homework saved for ${roster.length} students · each parent sees their own child's status`);
  }
  function saveTest() {
    if (!testName.trim() || enteredScores.length === 0) { flash("Add a test name and at least one score."); return; }
    setStats(s => ({ ...s, [selBatch]: { ...s[selBatch], testAvg: liveAvg } }));
    flash(`"${testName.trim()}" recorded · class avg ${liveAvg}% · results sent to parents`);
  }

  /* ---- batch picker ---- */
  if (!batch) {
    return (
      <div className="relative rounded-[2.2rem] shadow-2xl overflow-hidden mx-auto" style={{ width: 420, maxWidth: "100%", height: 720, background: "#000", padding: 8 }}>
        <div className="w-full h-full overflow-hidden rounded-[1.8rem] flex flex-col" style={{ background: "#fff" }}>
          <div className="px-4 pt-3 pb-3" style={{ background: GREEN_DARK }}>
            <h1 className="text-white text-lg font-semibold leading-tight">My Batches</h1>
            <p className="text-[11px]" style={{ color: "#B9E0DA" }}>Mark the whole class in seconds — it splits into each child's record</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ background: "#F7F7F5" }}>
            {Object.entries(ROSTERS).map(([id, b]) => (
              <button key={id} onClick={() => openBatch(id)}
                className="w-full bg-white rounded-2xl p-4 shadow-sm border text-left flex items-center gap-3 hover:shadow-md transition-shadow" style={{ borderColor: "#EEE" }}>
                <div className="flex items-center justify-center rounded-xl shrink-0" style={{ width: 46, height: 46, background: b.color + "22" }}>
                  <UserCheck size={22} style={{ color: b.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-[15px] text-gray-900">{b.name}</div>
                  <div className="text-[12px] text-gray-500">{b.teacher} · {b.roster.length} students</div>
                  <div className="flex gap-3 mt-1.5 text-[11px]">
                    <span style={{ color: "#1E88E5" }}>Att {stats[id].att}%</span>
                    <span style={{ color: "#43A047" }}>HW {stats[id].hw}%</span>
                    <span style={{ color: "#00897B" }}>Test {stats[id].testAvg}%</span>
                  </div>
                </div>
                <ChevronRight size={20} color="#bbb" />
              </button>
            ))}
            <p className="text-[11px] text-gray-400 text-center px-4 pt-2">
              Tap a batch → log attendance, homework or a test for everyone at once. Each entry becomes that child's timeline that their parent sees.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /* ---- roster screen ---- */
  const tasks = [["attendance", "Attendance", CalendarCheck, "#1E88E5"], ["homework", "Homework", BookOpen, "#43A047"], ["test", "Test", Award, "#00897B"]];
  return (
    <div className="relative rounded-[2.2rem] shadow-2xl overflow-hidden mx-auto" style={{ width: 420, maxWidth: "100%", height: 720, background: "#000", padding: 8 }}>
      <div className="w-full h-full overflow-hidden rounded-[1.8rem] flex flex-col" style={{ background: "#fff" }}>
        {/* header */}
        <div className="px-2 py-2.5 flex items-center gap-2" style={{ background: GREEN_DARK }}>
          <button onClick={() => setSelBatch(null)}><ArrowLeft color="#fff" size={22} /></button>
          <div className="flex-1">
            <div className="text-white font-semibold text-[15px] leading-tight">{batch.name}</div>
            <div className="text-[11px]" style={{ color: "#B9E0DA" }}>{batch.roster.length} students · today</div>
          </div>
        </div>

        {/* task selector */}
        <div className="flex gap-1 p-1.5" style={{ background: "#EFEFED" }}>
          {tasks.map(([t, lbl, Ic, col]) => (
            <button key={t} onClick={() => setTask(t)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-[12.5px] font-semibold transition-colors"
              style={task === t ? { background: "#fff", color: col, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" } : { color: "#888" }}>
              <Ic size={14} /> {lbl}
            </button>
          ))}
        </div>

        {/* live summary strip */}
        <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: "#EEE", background: "#FAFAF8" }}>
          {task === "attendance" && (
            <div className="flex items-center gap-4 text-[13px]">
              <span className="font-semibold" style={{ color: "#43A047" }}>{presentCount} present</span>
              <span className="font-semibold" style={{ color: absentCount ? "#E53935" : "#bbb" }}>{absentCount} absent</span>
              <span className="text-[11px] text-gray-400">tap a row to flip</span>
            </div>
          )}
          {task === "homework" && (
            <div className="flex items-center gap-3 text-[12.5px]">
              <span className="font-semibold" style={{ color: "#43A047" }}>✓ {hwCounts.done || 0}</span>
              <span className="font-semibold" style={{ color: "#FB8C00" }}>~ {hwCounts.partial || 0}</span>
              <span className="font-semibold" style={{ color: "#E53935" }}>✗ {hwCounts.missing || 0}</span>
              <span className="text-[11px] text-gray-400">of {roster.length}</span>
            </div>
          )}
          {task === "test" && (
            <div className="flex items-center gap-2 w-full">
              <input value={testName} onChange={e => setTestName(e.target.value)} placeholder="Test name (e.g. Unit Test 3)"
                className="flex-1 text-[13px] outline-none bg-transparent border-b" style={{ borderColor: "#DDD", paddingBottom: 2 }} />
              <span className="text-[11px] text-gray-400">/</span>
              <input value={testMax} onChange={e => setTestMax(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric"
                className="w-10 text-[13px] text-center outline-none bg-transparent border-b" style={{ borderColor: "#DDD" }} />
              {liveAvg !== null && <span className="text-[12px] font-bold ml-1" style={{ color: "#00897B" }}>avg {liveAvg}%</span>}
            </div>
          )}
        </div>

        {/* roster */}
        <div className="flex-1 overflow-y-auto">
          {roster.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-3 py-2 border-b" style={{ borderColor: "#F4F4F2" }}>
              <Avatar name={r.name} color={r.color} size={34} />
              <span className="flex-1 text-[13.5px] font-medium text-gray-800 truncate">{r.name}</span>

              {task === "attendance" && (
                <button onClick={() => setPresent(p => ({ ...p, [r.id]: !p[r.id] }))}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors"
                  style={present[r.id] ? { background: "#E8F5E9", color: "#2E7D32" } : { background: "#FFEBEE", color: "#C62828" }}>
                  {present[r.id] ? "Present" : "Absent"}
                </button>
              )}

              {task === "homework" && (
                <div className="flex gap-1">
                  {[["done", Check, "#43A047"], ["partial", Minus, "#FB8C00"], ["missing", X, "#E53935"]].map(([v, Ic, col]) => (
                    <button key={v} onClick={() => setHw(h => ({ ...h, [r.id]: v }))}
                      className="flex items-center justify-center rounded-lg transition-colors" style={{
                        width: 30, height: 30,
                        background: hw[r.id] === v ? col : col + "14",
                        color: hw[r.id] === v ? "#fff" : col,
                      }}>
                      <Ic size={15} />
                    </button>
                  ))}
                </div>
              )}

              {task === "test" && (
                <div className="flex items-center gap-1">
                  <input value={scores[r.id] ?? ""} onChange={e => setScores(s => ({ ...s, [r.id]: e.target.value.replace(/[^0-9.]/g, "") }))}
                    inputMode="numeric" placeholder="–"
                    className="w-12 text-[13px] text-center rounded-lg py-1.5 outline-none" style={{ background: "#F2F2F0", border: "1px solid #E4E4E2" }} />
                  <span className="text-[12px] text-gray-400 w-8">/{testMax}</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* save bar */}
        <div className="p-3 border-t" style={{ borderColor: "#EEE", background: "#FAFAF8" }}>
          {banner && (
            <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg text-[12px]" style={{ background: "#E8F5E9", color: "#2E7D32" }}>
              <Bell size={14} className="mt-0.5 shrink-0" /> <span>{banner}</span>
            </div>
          )}
          <button
            onClick={task === "attendance" ? saveAttendance : task === "homework" ? saveHomework : saveTest}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2"
            style={{ background: GREEN_DARK }}>
            <Check size={17} />
            {task === "attendance" ? `Save attendance · notify ${roster.length} parents`
              : task === "homework" ? "Save homework · notify parents"
              : "Save results · notify parents"}
          </button>
        </div>
      </div>
    </div>
  );
}


export default function EduTrackMVP() {
  const [view, setView] = useState("teacher");
  const [students, setStudents] = useState(() => seedStudents.map(s => ({
    ...s,
    batchHw: s.id === 1 ? 84 : s.id === 2 ? 70 : s.id === 3 ? 55 : 86, // batch homework avg
    tests: s.id === 1 ? [{ name: "Algebra Unit Test", score: 18, max: 25 }, { name: "Mental Math Quiz", score: 9, max: 10 }]
         : s.id === 4 ? [{ name: "Science Quiz", score: 23, max: 25 }]
         : [],
  })));

  const tabs = [
    ["teacher", "Teacher app", GraduationCap],
    ["batch", "Batch logging", UserCheck],
    ["parent", "Parent app", Users],
    ["dashboard", "Centre dashboard", Layers],
    ["plans", "Plans", Sparkles],
  ];

  return (
    <div style={{ fontFamily: "'Hanken Grotesk', system-ui, sans-serif", background: "#FBFAF7" }} className="w-full min-h-full py-6 px-3">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap');
        .modal-in{width:100%;margin-top:4px;border:1px solid #E2E2E2;border-radius:10px;padding:9px 11px;font-size:14px;outline:none;background:#FAFAFA;}
        .modal-in:focus{border-color:${GREEN};background:#fff;}
      `}</style>

      <div className="flex items-center gap-2 justify-center mb-2">
        <div className="flex items-center justify-center rounded-xl" style={{ width: 32, height: 32, background: GREEN_DARK }}>
          <GraduationCap size={19} color="#fff" />
        </div>
        <span style={{ fontFamily: "'Bricolage Grotesque', sans-serif", fontWeight: 800 }} className="text-xl text-gray-800">EduTrack</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#E8F5E9", color: GREEN_DARK }}>MVP</span>
      </div>

      <div className="flex justify-center mb-6">
        <div className="flex flex-wrap justify-center gap-1 p-1 rounded-full" style={{ background: "#ECE7DE" }}>
          {tabs.map(([v, lbl, Ic]) => (
            <button key={v} onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-semibold transition-colors"
              style={view === v ? { background: GREEN_DARK, color: "#fff" } : { color: "#5b5b5b" }}>
              <Ic size={14} /> {lbl}
            </button>
          ))}
        </div>
      </div>

      {(view === "teacher" || view === "parent") && <PhoneApp role={view} students={students} setStudents={setStudents} />}
      {view === "batch" && <BatchView />}
      {view === "dashboard" && <Dashboard />}
      {view === "plans" && <Plans />}

      <p className="text-[11px] text-gray-400 mt-6 max-w-[600px] text-center mx-auto">
        Teacher posts updates → student metrics & timeline update live → parent sees and acknowledges → centre admin sees it all roll up on the dashboard.
      </p>
    </div>
  );
}
