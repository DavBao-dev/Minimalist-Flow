import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  LayoutGrid,
  GanttChartSquare,
  Grid2x2,
  Plus,
  X,
  Trash2,
  Package,
  GripVertical,
  AlertTriangle,
  Sparkles,
  ListTodo,
  ChevronRight,
  Target,
  Calendar,
  CalendarDays,
  CalendarRange,
  Sun,
  Flame,
  Clock,
  BarChart3,
  BookOpen,
  FolderKanban,
  Tags,
  Link2,
  ExternalLink,
  Trophy,
  Save,
  RotateCcw,
  Library,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------
// Q1 rose(urgent+important) / Q2 cyan(important) / Q3 amber(urgent) / Q4 slate(neither)
const MATRIX = {
  Q1: { label: "Urgent · Important", short: "Q1", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/30", dot: "bg-rose-500", ring: "ring-rose-500/40", glow: "shadow-[0_0_20px_-4px_rgba(244,63,94,0.35)]" },
  Q2: { label: "Important · Not Urgent", short: "Q2", text: "text-cyan-300", bg: "bg-cyan-500/10", border: "border-cyan-500/30", dot: "bg-cyan-400", ring: "ring-cyan-400/40", glow: "shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)]" },
  Q3: { label: "Urgent · Not Important", short: "Q3", text: "text-amber-300", bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-400", ring: "ring-amber-400/40", glow: "shadow-[0_0_20px_-4px_rgba(251,191,36,0.35)]" },
  Q4: { label: "Not Urgent · Not Important", short: "Q4", text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/30", dot: "bg-slate-500", ring: "ring-slate-400/30", glow: "" },
};

// Year, Quarter, Month = pure direction, live only in Timeline as goals.
// Week, Day = the execution pipeline, live entirely on the Board now.
const GOAL_HORIZONS = ["Year", "Quarter", "Month"];
const EXECUTION_HORIZONS = ["Week", "Day"];
const HORIZON_META = {
  Year: { icon: Target, color: "text-fuchsia-300", label: "Yearly Goals" },
  Quarter: { icon: CalendarRange, color: "text-violet-300", label: "Quarterly Initiatives" },
  Month: { icon: Calendar, color: "text-teal-300", label: "Monthly Plans" },
  Week: { icon: CalendarDays, color: "text-sky-300", label: "Weekly Focus" },
  Day: { icon: Sun, color: "text-emerald-300", label: "Daily Execution" },
};

const uid = () => Math.random().toString(36).slice(2, 10);

// Reference-material taxonomy — separate from the Eisenhower matrix, purely
// for organizing linked docs/sheets attached to a task.
const CATEGORY = {
  "STUDY-RESEARCH": { label: "Study / Research", icon: BookOpen, text: "text-violet-300", bg: "bg-violet-500/10", border: "border-violet-500/30" },
  PROJECT: { label: "Project", icon: FolderKanban, text: "text-blue-300", bg: "bg-blue-500/10", border: "border-blue-500/30" },
  MISC: { label: "Misc", icon: Tags, text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/30" },
};
const CATEGORIES = Object.keys(CATEGORY);

// Day-of-week helpers for the Work Efficiency view.
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL = { Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" };
const todayAbbrev = () => DAYS[(new Date().getDay() + 6) % 7]; // JS getDay(): 0=Sun -> remap to Mon-first

// time-block helpers for Focus Day
const parseTimeToMinutes = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};
const blockDurationHours = (block) =>
  Math.max(parseTimeToMinutes(block.end) - parseTimeToMinutes(block.start), 0) / 60;
const formatHour = (t) => {
  const [h, m] = t.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? ":" + String(m).padStart(2, "0") : ""}${period}`;
};

// ---------------------------------------------------------------------------
// Mock data — pre-loaded so capacity bar + matrix are testable immediately
// ---------------------------------------------------------------------------
// Fixed ids so mock tasks can reference mock free-time blocks below.
const BLOCK_DEEP_AM = uid();
const BLOCK_MEETINGS = uid();
const BLOCK_DEEP_PM = uid();

// Small helper so every mock task gets sane defaults for the newer fields
// (category, materials, completedDay) without repeating them everywhere.
const base = (overrides) => ({
  isBatchBox: false,
  subtasks: [],
  blockId: null,
  category: "MISC",
  materials: [],
  completedDay: null,
  ...overrides,
});

const MOCK_TASKS = [
  base({ id: uid(), title: "Fix production bug #482", matrix: "Q1", estimate: 3, horizon: "Day", status: "Today", blockId: BLOCK_DEEP_AM, category: "PROJECT",
    materials: [{ id: uid(), title: "Incident #482 runbook", url: "https://docs.google.com/document/d/example-incident-482" }] }),
  base({ id: uid(), title: "Prepare board deck", matrix: "Q1", estimate: 6, horizon: "Week", status: "This Week", category: "PROJECT",
    materials: [{ id: uid(), title: "Board Deck — Q3", url: "https://docs.google.com/presentation/d/example-board-deck" }] }),
  base({ id: uid(), title: "Reorganize Slack channels", matrix: "Q4", estimate: 1, horizon: "Week", status: "This Week" }),
  base({ id: uid(), title: "Watch competitor webinar replay", matrix: "Q4", estimate: 1, horizon: "Day", status: "This Week" }),
  base({ id: uid(), title: "Triage non-critical Slack pings", matrix: "Q3", estimate: 2, horizon: "Day", status: "Today" }),
  base({ id: uid(), title: "Clean out downloads folder", matrix: "Q4", estimate: 0.5, horizon: "Day", status: "This Week" }),
  base({ id: uid(), title: "Audit unused subscriptions", matrix: "Q4", estimate: 1, horizon: "Week", status: "This Week" }),
  base({ id: uid(), title: "Quarterly OKR planning — this week's slice", matrix: "Q2", estimate: 4, horizon: "Week", status: "This Week", category: "PROJECT" }),
  base({ id: uid(), title: "Write product blog draft", matrix: "Q2", estimate: 5, horizon: "Week", status: "This Week", category: "PROJECT",
    materials: [{ id: uid(), title: "Blog draft — Google Doc", url: "https://docs.google.com/document/d/example-blog-draft" }] }),
  base({ id: uid(), title: "Team standup prep", matrix: "Q3", estimate: 1, horizon: "Day", status: "Today", blockId: BLOCK_MEETINGS }),
  base({ id: uid(), title: "[Batch] Misc Admin", matrix: "Q3", estimate: 2, horizon: "Week", status: "This Week", isBatchBox: true,
    subtasks: ["Clear inbox to zero", "Water the office plants", "Pay utility bill"] }),
  base({ id: uid(), title: "Redesign logo (again)", matrix: "Q4", estimate: 3, horizon: "Quarter", status: "Dropped" }),

  // Study / research examples
  base({ id: uid(), title: "Read up on vector databases", matrix: "Q2", estimate: 3, horizon: "Week", status: "This Week", category: "STUDY-RESEARCH",
      materials: [
        {
          id: uid(),
          title: "Project Spec",
          url: "https://docs.google.com/..."
        }
      ]}),
  base({ id: uid(), title: "Competitor pricing research", matrix: "Q2", estimate: 2, horizon: "Week", status: "This Week", category: "STUDY-RESEARCH",
    materials: [{ id: uid(), title: "Pricing research sheet", url: "https://docs.google.com/spreadsheets/d/example-pricing" }] }),

  // Goal-status: Year/Quarter/Month items — pure direction, live only in Timeline, never on the Board.
  base({ id: uid(), title: "Learn Rust fundamentals", matrix: "Q2", estimate: 10, horizon: "Year", status: "Goal", category: "STUDY-RESEARCH" }),
  base({ id: uid(), title: "Launch v3 to 10k users", matrix: "Q1", estimate: 40, horizon: "Year", status: "Goal", category: "PROJECT" }),
  base({ id: uid(), title: "Redesign onboarding flow", matrix: "Q2", estimate: 8, horizon: "Quarter", status: "Goal", category: "PROJECT" }),
  base({ id: uid(), title: "Migrate infra to new provider", matrix: "Q2", estimate: 20, horizon: "Quarter", status: "Goal", category: "PROJECT" }),
  base({ id: uid(), title: "Close 5 new enterprise deals", matrix: "Q1", estimate: 15, horizon: "Month", status: "Goal", category: "PROJECT" }),
  base({ id: uid(), title: "Publish 4 study notes on system design", matrix: "Q2", estimate: 6, horizon: "Month", status: "Goal", category: "STUDY-RESEARCH" }),

  // Done, spread across the week, so the Work Efficiency view has something to show immediately.
  base({ id: uid(), title: "Ship v2.1 release", matrix: "Q1", estimate: 5, horizon: "Week", status: "Done", category: "PROJECT", completedDay: "Wed",
    materials: [{ id: uid(), title: "v2.1 release notes", url: "https://docs.google.com/document/d/example-release-notes" }] }),
  base({ id: uid(), title: "Fix onboarding email typo", matrix: "Q3", estimate: 0.5, horizon: "Day", status: "Done", completedDay: "Mon" }),
  base({ id: uid(), title: "Weekly newsletter draft", matrix: "Q2", estimate: 2, horizon: "Week", status: "Done", category: "PROJECT", completedDay: "Wed" }),
  base({ id: uid(), title: "Customer call — churn interview", matrix: "Q1", estimate: 1, horizon: "Day", status: "Done", category: "STUDY-RESEARCH", completedDay: "Wed" }),
  base({ id: uid(), title: "Refactor auth middleware", matrix: "Q2", estimate: 4, horizon: "Week", status: "Done", category: "PROJECT", completedDay: "Tue" }),
  base({ id: uid(), title: "Update pricing page copy", matrix: "Q3", estimate: 1.5, horizon: "Day", status: "Done", completedDay: "Fri" }),
  base({ id: uid(), title: "Review pull requests", matrix: "Q1", estimate: 1, horizon: "Day", status: "Done", category: "PROJECT", completedDay: "Mon" }),
  base({ id: uid(), title: "Book travel for conference", matrix: "Q3", estimate: 1, horizon: "Day", status: "Done", completedDay: "Fri" }),
];

// Mock free-time blocks for the Focus Day view — the real gaps in today's calendar.
const MOCK_FREE_BLOCKS = [
  { id: BLOCK_DEEP_AM, start: "09:00", end: "11:00", label: "Deep Work" },
  { id: BLOCK_MEETINGS, start: "11:30", end: "12:30", label: "Meetings buffer" },
  { id: BLOCK_DEEP_PM, start: "14:00", end: "16:30", label: "Deep Work" },
];

const STORAGE_KEY = "minimalist-flow-data";

const DEFAULT_DATA = {
  tasks: MOCK_TASKS,
  freeBlocks: MOCK_FREE_BLOCKS,
};

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return DEFAULT_DATA;

    const data = JSON.parse(raw);

    return {
      tasks: data.tasks || MOCK_TASKS,
      freeBlocks: data.freeBlocks || MOCK_FREE_BLOCKS,
      materials: data.materials || [],
    };
  } catch {
    return {
      tasks: MOCK_TASKS,
      freeBlocks: MOCK_FREE_BLOCKS,
      materials: [],
    };
  }
};

const COLUMNS = [
  { key: "This Week", label: "This Week", hint: "Steps 1 & 3 — dump it here, then fill to capacity" },
  { key: "Today", label: "Today", hint: "WIP limit · 3" },
  { key: "Done", label: "Done", hint: "Shipped" },
];

// ---------------------------------------------------------------------------
// Small shared UI atoms
// ---------------------------------------------------------------------------
function Mono({ children, className = "" }) {
  return <span className={`font-['JetBrains_Mono'] tabular-nums ${className}`}>{children}</span>;
}

function MatrixPill({ q, size = "xs" }) {
  const m = MATRIX[q];
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded border ${m.border} ${m.bg} ${m.text} ${pad} font-medium tracking-wide uppercase`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.short}
    </span>
  );
}

function MatrixSelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-zinc-900 border border-zinc-800 rounded text-[11px] px-1.5 py-1 ${MATRIX[value].text} focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer`}
    >
      {Object.keys(MATRIX).map((k) => (
        <option key={k} value={k} className="bg-zinc-900 text-zinc-200">
          {k} · {MATRIX[k].label}
        </option>
      ))}
    </select>
  );
}

function CategoryPill({ category }) {
  const c = CATEGORY[category];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded border ${c.border} ${c.bg} ${c.text} px-1.5 py-0.5 text-[10px] font-medium`}>
      <Icon size={10} />
      {c.label}
    </span>
  );
}

function CategorySelect({ value, onChange }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`bg-zinc-900 border border-zinc-800 rounded text-[11px] px-1.5 py-1 ${CATEGORY[value].text} focus:outline-none focus:ring-1 focus:ring-zinc-600 cursor-pointer`}
    >
      {CATEGORIES.map((k) => (
        <option key={k} value={k} className="bg-zinc-900 text-zinc-200">
          {CATEGORY[k].label}
        </option>
      ))}
    </select>
  );
}

// Inline manager for a task's reference material (Docs/Sheets/links).
function MaterialsCell({ task, onAddMaterial, onRemoveMaterial }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const submit = () => {
    if (!url.trim()) return;
    onAddMaterial(task.id, { title: title.trim() || url.trim(), url: url.trim() });
    setTitle("");
    setUrl("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-1 min-w-[180px]">
      <div className="flex flex-wrap gap-1">
        {task.materials.map((m) => (
          <a
            key={m.id}
            href={m.url}
            target="_blank"
            rel="noreferrer"
            className="group/mat inline-flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900/70 hover:bg-zinc-900 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:text-zinc-100 transition-colors max-w-[140px]"
          >
            <Link2 size={10} className="shrink-0 text-zinc-500" />
            <span className="truncate">{m.title}</span>
            <ExternalLink size={9} className="shrink-0 text-zinc-600" />
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onRemoveMaterial(task.id, m.id);
              }}
              className="opacity-0 group-hover/mat:opacity-100 text-zinc-600 hover:text-rose-400 transition-opacity shrink-0"
            >
              <X size={9} />
            </button>
          </a>
        ))}
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded border border-dashed border-zinc-800 hover:border-zinc-600 px-1.5 py-0.5 text-[10px] text-zinc-600 hover:text-zinc-300 transition-colors"
        >
          <Plus size={10} /> Link
        </button>
      </div>
      {open && (
        <div className="flex items-center gap-1 pt-1">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            className="w-24 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="https://docs.google.com/…"
            className="w-36 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-1 text-[10px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
          <button onClick={submit} className="text-[10px] px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Board view
// ---------------------------------------------------------------------------
function TaskCard({ task, onDragStart, onDelete, onDrop: onFieldChange, onAddSubtask, isDragging }) {
  const m = MATRIX[task.matrix];
  const [subtaskDraft, setSubtaskDraft] = useState("");

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      className={`group relative rounded-lg border ${m.border} bg-zinc-900/70 backdrop-blur-sm p-3 cursor-grab active:cursor-grabbing transition-all hover:bg-zinc-900 hover:-translate-y-0.5 ${
        isDragging ? "opacity-30" : ""
      } ${task.isBatchBox ? `ring-1 ${m.ring}` : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <GripVertical size={13} className="shrink-0 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
          {task.isBatchBox && <Package size={13} className="shrink-0 text-amber-400" />}
          <p className="text-sm text-zinc-100 leading-snug truncate">{task.title}</p>
        </div>
        <button
          onClick={() => onDelete(task.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-600 hover:text-rose-400 shrink-0"
          aria-label="Delete task"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <MatrixPill q={task.matrix} />
        <span className="flex items-center gap-1 text-zinc-500 text-[11px]">
          <Mono>{task.estimate}h</Mono>
        </span>
        <span className="text-zinc-700 text-[10px]">·</span>
        <span className="text-zinc-500 text-[11px]">{task.horizon}</span>
        {task.materials.length > 0 && (
          <>
            <span className="text-zinc-700 text-[10px]">·</span>
            <span className="flex items-center gap-0.5 text-zinc-500 text-[11px]">
              <Link2 size={10} /> {task.materials.length}
            </span>
          </>
        )}
      </div>

      {task.isBatchBox && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-1.5">
          {task.subtasks.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[12px] text-zinc-400">
              <span className="h-1 w-1 rounded-full bg-amber-500/60 shrink-0" />
              {s}
            </div>
          ))}
          <div className="flex items-center gap-1 pt-1">
            <input
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && subtaskDraft.trim()) {
                  onAddSubtask(task.id, subtaskDraft.trim());
                  setSubtaskDraft("");
                }
              }}
              placeholder="Add misc item…"
              className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-[11px] text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
            />
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wide">Box estimate</span>
            <input
              type="number"
              min="0"
              step="0.5"
              value={task.estimate}
              onChange={(e) => onFieldChange(task.id, "estimate", parseFloat(e.target.value) || 0)}
              className="w-14 bg-zinc-950 border border-zinc-800 rounded px-1.5 py-0.5 text-[11px] font-['JetBrains_Mono'] text-zinc-300 focus:outline-none focus:border-amber-500/40"
            />
            <span className="text-[10px] text-zinc-600">h</span>
          </div>
        </div>
      )}
    </div>
  );
}

function QuickAdd({ onAdd, placeholder = "Add a task and hit enter…" }) {
  const [val, setVal] = useState("");
  return (
    <input
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && val.trim()) {
          onAdd(val.trim());
          setVal("");
        }
      }}
      placeholder={placeholder}
      className="w-full bg-zinc-950/60 border border-dashed border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
    />
  );
}

function CapacityGauge({ capacity, scheduled, onCapacityChange }) {
  const pct = capacity > 0 ? Math.min((scheduled / capacity) * 100, 100) : 0;
  const over = scheduled > capacity;
  const segments = 24;
  const filledSegments = Math.round((Math.min(scheduled, capacity * 1.3) / (capacity || 1)) * segments);

  let barColor = "bg-emerald-400";
  let glow = "shadow-[0_0_12px_1px_rgba(52,211,153,0.5)]";
  if (pct > 85 && !over) {
    barColor = "bg-amber-400";
    glow = "shadow-[0_0_12px_1px_rgba(251,191,36,0.5)]";
  }
  if (over) {
    barColor = "bg-rose-500";
    glow = "shadow-[0_0_14px_2px_rgba(244,63,94,0.6)]";
  }

  return (
    <div className={`rounded-xl border p-4 transition-colors ${over ? "border-rose-500/40 bg-rose-500/[0.04]" : "border-zinc-800 bg-zinc-900/50"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame size={14} className={over ? "text-rose-400" : "text-zinc-500"} />
          <span className="text-[11px] uppercase tracking-widest text-zinc-500">Weekly Capacity</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Mono className={`text-sm font-semibold ${over ? "text-rose-400" : "text-zinc-100"}`}>{scheduled}</Mono>
          <span className="text-zinc-600 text-sm">/</span>
          <input
            type="number"
            min="0"
            value={capacity}
            onChange={(e) => onCapacityChange(parseFloat(e.target.value) || 0)}
            className="w-12 bg-transparent text-sm font-['JetBrains_Mono'] text-zinc-400 text-right focus:outline-none focus:text-zinc-100 border-b border-transparent focus:border-zinc-700"
          />
          <span className="text-zinc-500 text-xs">hrs</span>
        </div>
      </div>

      {/* segmented telemetry meter */}
      <div className="flex gap-[3px] h-3 mb-1.5">
        {Array.from({ length: segments }).map((_, i) => (
          <div
            key={i}
            className={`flex-1 rounded-[1px] transition-all duration-300 ${
              i < filledSegments ? `${barColor} ${glow}` : "bg-zinc-800"
            }`}
            style={{ transitionDelay: `${i * 8}ms` }}
          />
        ))}
      </div>

      {over ? (
        <div className="flex items-center gap-1.5 text-rose-400 text-[11px] mt-2">
          <AlertTriangle size={12} />
          Over capacity by <Mono>{(scheduled - capacity).toFixed(1)}h</Mono> — cut something before committing.
        </div>
      ) : (
        <div className="text-[11px] text-zinc-600 mt-2">
          <Mono>{Math.max(capacity - scheduled, 0).toFixed(1)}h</Mono> of headroom left this week.
        </div>
      )}
    </div>
  );
}

function BoardView({ tasks, setTasks }) {
  const [dragId, setDragId] = useState(null);
  const [capacity, setCapacity] = useState(80);

  const scheduled = useMemo(
    () =>
      tasks
        .filter((t) => t.status === "This Week" || t.status === "Today")
        .reduce((sum, t) => sum + Number(t.estimate || 0), 0),
    [tasks]
  );

  const grouped = useMemo(() => {
    const g = { "This Week": [], Today: [], Done: [] };
    tasks.forEach((t) => {
      if (g[t.status]) g[t.status].push(t);
    });
    return g;
  }, [tasks]);

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (status) => {
    if (!dragId) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== dragId) return t;
        if (status === "Done" && t.status !== "Done") return { ...t, status, completedDay: todayAbbrev() };
        if (status !== "Done" && t.status === "Done") return { ...t, status, completedDay: null };
        return { ...t, status };
      })
    );
    setDragId(null);
  };

  const addTask = (status, title) => {
    setTasks((prev) => [...prev, base({ id: uid(), title, matrix: "Q3", estimate: 1, horizon: "Week", status })]);
  };

  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const updateField = (id, field, value) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  const addSubtask = (id, text) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, subtasks: [...t.subtasks, text] } : t)));

  const createBatchBox = () => {
    const exists = tasks.some((t) => t.isBatchBox && t.status !== "Done" && t.status !== "Dropped");
    if (exists) return;
    setTasks((prev) => [
      ...prev,
      base({ id: uid(), title: "[Batch] Misc Admin", matrix: "Q3", estimate: 1, horizon: "Week", status: "This Week", isBatchBox: true }),
    ]);
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Scheduler widget */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CapacityGauge capacity={capacity} scheduled={scheduled} onCapacityChange={setCapacity} />
        </div>
        <button
          onClick={createBatchBox}
          className="group flex items-center justify-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.05] hover:bg-amber-500/[0.1] hover:border-amber-500/40 transition-all text-amber-300 text-sm font-medium px-4"
        >
          <Package size={16} className="group-hover:scale-110 transition-transform" />
          Create Weekly Batch Box
        </button>
      </div>

      {/* Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 flex-1 min-h-0">
        {COLUMNS.map((col) => {
          const items = grouped[col.key];
          const isToday = col.key === "Today";
          const overWip = isToday && items.length > 3;
          return (
            <div
              key={col.key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(col.key)}
              className={`flex flex-col rounded-xl border bg-zinc-950/40 min-h-[420px] transition-colors ${
                overWip ? "border-rose-500/50 bg-rose-500/[0.03]" : "border-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-zinc-100">{col.label}</h3>
                    <span
                      className={`font-['JetBrains_Mono'] text-[11px] rounded-full px-1.5 leading-4 ${
                        overWip ? "bg-rose-500/20 text-rose-300" : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {items.length}
                    </span>
                    {overWip && <AlertTriangle size={12} className="text-rose-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{col.hint}</p>
                </div>
              </div>

              <div className="flex-1 px-3 pb-3 space-y-2 overflow-y-auto">
                {items.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    isDragging={dragId === t.id}
                    onDragStart={handleDragStart}
                    onDelete={deleteTask}
                    onDrop={updateField}
                    onAddSubtask={addSubtask}
                  />
                ))}
                {col.key !== "Done" && <QuickAdd onAdd={(title) => addTask(col.key, title)} />}
                {items.length === 0 && col.key === "Done" && (
                  <p className="text-center text-zinc-700 text-xs py-8">Nothing shipped yet.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline view
// ---------------------------------------------------------------------------
function TimelineView({ tasks, setTasks }) {
  const addTask = (horizon, title) => {
    // Timeline only ever deals in Year/Quarter/Month — all pure direction, all status Goal.
    setTasks((prev) => [...prev, base({ id: uid(), title, matrix: "Q2", estimate: 1, horizon, status: "Goal" })]);
  };
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const active = tasks.filter((t) => t.status !== "Dropped");

  return (
    <div className="flex flex-col gap-0">
      <p className="text-sm text-zinc-500 mb-6 max-w-2xl">
        Direction only — Year, Quarter, and Month goals live here. Weekly focus and daily execution
        already live on the Board, so this stays clean of busywork.
      </p>
      <div className="relative">
        {/* connecting spine */}
        <div className="absolute left-[15px] top-6 bottom-6 w-px bg-gradient-to-b from-fuchsia-500/40 via-violet-500/30 to-teal-500/30" />
        <div className="flex flex-col gap-3">
          {GOAL_HORIZONS.map((h, idx) => {
            const meta = HORIZON_META[h];
            const Icon = meta.icon;
            const items = active.filter((t) => t.horizon === h);
            return (
              <div key={h} className="relative pl-10">
                <div
                  className={`absolute left-0 top-1.5 h-8 w-8 rounded-full border border-zinc-800 bg-zinc-950 flex items-center justify-center ${meta.color}`}
                >
                  <Icon size={15} />
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className={`text-sm font-semibold ${meta.color}`}>{meta.label}</h3>
                    </div>
                    <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-600">
                      {items.length} item{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {items.map((t) => (
                      <div
                        key={t.id}
                        className="group flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950/60 pl-3 pr-2 py-1.5"
                      >
                        <MatrixPill q={t.matrix} />
                        <CategoryPill category={t.category} />
                        <span className="text-xs text-zinc-200">{t.title}</span>
                        <span className="text-[10px] text-zinc-600 font-['JetBrains_Mono']">{t.estimate}h</span>
                        <button
                          onClick={() => deleteTask(t.id)}
                          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-opacity"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {items.length === 0 && <span className="text-xs text-zinc-700 italic">Empty — nothing aimed here yet.</span>}
                  </div>
                  <QuickAdd onAdd={(title) => addTask(h, title)} placeholder={`Add a ${h.toLowerCase()} goal…`} />
                </div>
                {idx < GOAL_HORIZONS.length - 1 && (
                  <div className="flex justify-center py-1 text-zinc-700">
                    <ChevronRight size={14} className="rotate-90" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task view — Matrix + List
// ---------------------------------------------------------------------------
function MatrixQuadrant({ qkey, tasks, onDelete, highlight }) {
  const m = MATRIX[qkey];
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col min-h-[220px] transition-all ${m.border} ${
        highlight ? `${m.bg} ${m.glow}` : "bg-zinc-900/30"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className={`h-2 w-2 rounded-full ${m.dot}`} />
        <h4 className={`text-xs font-semibold uppercase tracking-wider ${m.text}`}>{qkey} · {m.label}</h4>
        <span className="ml-auto font-['JetBrains_Mono'] text-[11px] text-zinc-600">{tasks.length}</span>
      </div>
      <div className="space-y-1.5 overflow-y-auto flex-1">
        {tasks.map((t) => (
          <div key={t.id} className="group flex items-center justify-between gap-2 rounded-md bg-zinc-950/50 border border-zinc-800/70 px-2.5 py-1.5">
            <span className="text-xs text-zinc-300 truncate">{t.title}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-zinc-600 font-['JetBrains_Mono']">{t.estimate}h</span>
              <button onClick={() => onDelete(t.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-opacity">
                <X size={11} />
              </button>
            </div>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-[11px] text-zinc-700 italic py-4 text-center">Nothing here.</p>}
      </div>
    </div>
  );
}

function TaskListRow({ task, onUpdate, onDelete, onAddMaterial, onRemoveMaterial }) {
  return (
    <tr className="border-b border-zinc-900 hover:bg-zinc-900/40 transition-colors group align-top">
      <td className="py-2 pr-3">
        <input
          value={task.title}
          onChange={(e) => onUpdate(task.id, "title", e.target.value)}
          className="bg-transparent text-sm text-zinc-200 w-full focus:outline-none focus:text-white"
        />
      </td>
      <td className="py-2 pr-3">
        <MatrixSelect value={task.matrix} onChange={(v) => onUpdate(task.id, "matrix", v)} />
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          step="0.5"
          min="0"
          value={task.estimate}
          onChange={(e) => onUpdate(task.id, "estimate", parseFloat(e.target.value) || 0)}
          className="w-16 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-1 text-xs font-['JetBrains_Mono'] text-zinc-300 focus:outline-none focus:border-zinc-600"
        />
      </td>
      <td className="py-2 pr-3">
        <select
          value={task.horizon}
          onChange={(e) => onUpdate(task.id, "horizon", e.target.value)}
          className="bg-zinc-900 border border-zinc-800 rounded text-xs px-1.5 py-1 text-zinc-300 focus:outline-none focus:border-zinc-600"
        >
          {(task.status === "Goal" ? HORIZONS : EXECUTION_HORIZONS).map((h) => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
      </td>
      <td className="py-2 pr-3">
        <span
          className={`text-[11px] px-1.5 py-0.5 rounded border ${
            task.status === "Dropped"
              ? "border-zinc-800 text-zinc-600"
              : task.status === "Done"
              ? "border-emerald-800 text-emerald-400"
              : task.status === "Goal"
              ? "border-violet-800 text-violet-300"
              : "border-zinc-700 text-zinc-400"
          }`}
        >
          {task.status}
        </span>
        {task.completedDay && <div className="text-[10px] text-zinc-600 mt-1">{DAY_FULL[task.completedDay]}</div>}
      </td>
      <td className="py-2 pr-3">
        <CategorySelect value={task.category} onChange={(v) => onUpdate(task.id, "category", v)} />
      </td>
      <td className="py-2 pr-3">
        <MaterialsCell task={task} onAddMaterial={onAddMaterial} onRemoveMaterial={onRemoveMaterial} />
      </td>
      <td className="py-2 text-right">
        <button onClick={() => onDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-rose-400 transition-opacity">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
}

function TaskView({ tasks, setTasks }) {
  const [tab, setTab] = useState("matrix");
  const deleteTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));
  const updateField = (id, field, value) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, [field]: value } : t)));

  const byQuadrant = (q) => tasks.filter((t) => t.matrix === q && t.status !== "Dropped" && t.status !== "Done");
  const q4BacklogCount = tasks.filter((t) => t.matrix === "Q4" && t.status === "Backlog").length;

  const purgeQ4 = () => {
    setTasks((prev) =>
      prev.map((t) => (t.matrix === "Q4" && t.status === "Backlog" ? { ...t, status: "Dropped" } : t))
    );
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <div className="flex items-center gap-1 border border-zinc-800 rounded-lg p-1 w-fit bg-zinc-900/50">
        <button
          onClick={() => setTab("matrix")}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === "matrix" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <Grid2x2 size={13} /> Matrix
        </button>
        <button
          onClick={() => setTab("list")}
          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
            tab === "list" ? "bg-zinc-800 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"
          }`}
        >
          <ListTodo size={13} /> List
        </button>
      </div>

      {tab === "matrix" ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between rounded-xl border border-slate-700/40 bg-slate-500/[0.04] px-4 py-3">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Sparkles size={15} className="text-slate-400" />
              <span>
                <Mono className="text-slate-200 font-semibold">{q4BacklogCount}</Mono> backlog task
                {q4BacklogCount !== 1 ? "s" : ""} sit in Q4 — not urgent, not important. Minimize means dropping these on sight.
              </span>
            </div>
            <button
              onClick={purgeQ4}
              disabled={q4BacklogCount === 0}
              className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide px-3 py-2 rounded-lg bg-slate-100 text-zinc-950 hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <Trash2 size={13} /> Purge Q4
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <MatrixQuadrant qkey="Q1" tasks={byQuadrant("Q1")} onDelete={deleteTask} />
            <MatrixQuadrant qkey="Q2" tasks={byQuadrant("Q2")} onDelete={deleteTask} />
            <MatrixQuadrant qkey="Q3" tasks={byQuadrant("Q3")} onDelete={deleteTask} />
            <MatrixQuadrant qkey="Q4" tasks={byQuadrant("Q4")} onDelete={deleteTask} highlight />
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900/60">
                <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Title</th>
                <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Matrix</th>
                <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Est.</th>
                <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Horizon</th>
                <th className="py-2 px-3 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">Status</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody className="px-3">
              {tasks.map((t) => (
                <TaskListRow key={t.id} task={t} onUpdate={updateField} onDelete={deleteTask} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


function MaterialView({
    tasks,
    materials,
    setMaterials,
}) {
  
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  function importMaterial() {
    if (!title.trim() || !url.trim()) return;

    setMaterials(prev => [
      ...prev,
      {
        id: uid(),
        title,
        url,
        category: "Imported",
      },
    ]);

    setTitle("");
    setUrl("");
  }

  return (
    <>
      <div className="flex gap-2 mb-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title: Project Spec"
          className="rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
        />

        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://docs.google.com/..."
          className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-3 py-2"
        />

        <button
          onClick={importMaterial}
          className="px-4 rounded-lg bg-blue-600 hover:bg-blue-500"
        >
          Import
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {materials.map(mat => (
          <div
            key={mat.id}
            className="rounded-xl border border-zinc-800 p-4"
          >
            <div className="text-sm text-zinc-400">
              {mat.category}
            </div>

            <div className="font-medium">
              {mat.title}
            </div>

            <a
              href={mat.url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 text-sm"
            >
              Open
            </a>

            <button
              onClick={() =>
                setMaterials(prev => prev.filter(x => x.id !== mat.id))
              }
              className="ml-3 text-red-400 text-sm"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Focus Day view — list the real gaps in today's calendar, then drag
// "Today" tasks into the block they actually fit. Overbooked blocks glow red,
// same telemetry language as the weekly capacity gauge, just scoped to a slot.
// ---------------------------------------------------------------------------
function BlockCapacityBar({ used, capacity }) {
  const segments = 12;
  const over = used > capacity;
  const filled = capacity > 0 ? Math.round((Math.min(used, capacity * 1.3) / capacity) * segments) : 0;
  let color = "bg-emerald-400";
  if (!over && capacity > 0 && used / capacity > 0.85) color = "bg-amber-400";
  if (over) color = "bg-rose-500";
  return (
    <div className="flex gap-[2px] h-1.5">
      {Array.from({ length: segments }).map((_, i) => (
        <div key={i} className={`flex-1 rounded-[1px] transition-colors ${i < filled ? color : "bg-zinc-800"}`} />
      ))}
    </div>
  );
}

function FocusDayView({ tasks, setTasks, freeBlocks, setFreeBlocks }) {
  const [dragId, setDragId] = useState(null);
  const [newStart, setNewStart] = useState("09:00");
  const [newEnd, setNewEnd] = useState("10:00");
  const [newLabel, setNewLabel] = useState("");

  const todayTasks = tasks.filter((t) => t.status === "Today");
  const unscheduled = todayTasks.filter((t) => !t.blockId);
  const sortedBlocks = useMemo(
    () => [...freeBlocks].sort((a, b) => parseTimeToMinutes(a.start) - parseTimeToMinutes(b.start)),
    [freeBlocks]
  );

  const handleDragStart = (e, id) => {
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
  };
  const assign = (blockId) => {
    if (!dragId) return;
    setTasks((prev) => prev.map((t) => (t.id === dragId ? { ...t, blockId } : t)));
    setDragId(null);
  };

  const addBlock = () => {
    if (!newStart || !newEnd || parseTimeToMinutes(newEnd) <= parseTimeToMinutes(newStart)) return;
    setFreeBlocks((prev) => [...prev, { id: uid(), start: newStart, end: newEnd, label: newLabel.trim() || "Free time" }]);
    setNewLabel("");
  };
  const deleteBlock = (id) => {
    setFreeBlocks((prev) => prev.filter((b) => b.id !== id));
    setTasks((prev) => prev.map((t) => (t.blockId === id ? { ...t, blockId: null } : t)));
  };

  return (
    <div className="flex flex-col gap-5 h-full">
      <p className="text-sm text-zinc-500 max-w-2xl">
        List the real gaps in today's calendar, then drag each <span className="text-zinc-300">Today</span> task
        into the slot it actually fits. If a block overflows, something needs to move back to This Week — not
        squeeze in anyway.
      </p>

      {/* add free block */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-zinc-600">Start</label>
          <input
            type="time"
            value={newStart}
            onChange={(e) => setNewStart(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase tracking-wide text-zinc-600">End</label>
          <input
            type="time"
            value={newEnd}
            onChange={(e) => setNewEnd(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <label className="text-[10px] uppercase tracking-wide text-zinc-600">Label (optional)</label>
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Deep work, meetings…"
            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>
        <button
          onClick={addBlock}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-300 hover:bg-sky-500/20 transition-colors"
        >
          <Plus size={13} /> Add free block
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 flex-1 min-h-0">
        {/* unscheduled pool */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => assign(null)}
          className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 flex flex-col gap-2 min-h-[300px]"
        >
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Unscheduled Today</h3>
            <span className="font-['JetBrains_Mono'] text-[11px] text-zinc-600">{unscheduled.length}</span>
          </div>
          {unscheduled.map((t) => (
            <div
              key={t.id}
              draggable
              onDragStart={(e) => handleDragStart(e, t.id)}
              className={`group rounded-lg border border-zinc-800 bg-zinc-900/70 p-2.5 cursor-grab active:cursor-grabbing hover:bg-zinc-900 transition-all ${
                dragId === t.id ? "opacity-30" : ""
              }`}
            >
              <div className="flex items-center gap-1.5">
                <GripVertical size={12} className="text-zinc-700" />
                <span className="text-xs text-zinc-200 truncate">{t.title}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 pl-4">
                <MatrixPill q={t.matrix} />
                <Mono className="text-[11px] text-zinc-500">{t.estimate}h</Mono>
              </div>
            </div>
          ))}
          {todayTasks.length === 0 && (
            <p className="text-[11px] text-zinc-700 italic text-center py-6">
              Nothing in Today yet — pull tasks in from the Board first.
            </p>
          )}
          {todayTasks.length > 0 && unscheduled.length === 0 && (
            <p className="text-[11px] text-zinc-700 italic text-center py-6">Everything's placed. Nice.</p>
          )}
        </div>

        {/* free-time blocks */}
        <div className="flex flex-col gap-3 overflow-y-auto">
          {sortedBlocks.map((block) => {
            const assigned = todayTasks.filter((t) => t.blockId === block.id);
            const used = assigned.reduce((s, t) => s + Number(t.estimate || 0), 0);
            const capacity = blockDurationHours(block);
            const over = used > capacity;
            return (
              <div
                key={block.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => assign(block.id)}
                className={`group/block rounded-xl border p-3.5 transition-colors ${
                  over ? "border-rose-500/40 bg-rose-500/[0.03]" : "border-zinc-800 bg-zinc-900/30"
                }`}
              >
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Clock size={13} className={over ? "text-rose-400 shrink-0" : "text-sky-300 shrink-0"} />
                    <span className="text-sm font-medium text-zinc-100 truncate">{block.label}</span>
                    <span className="text-[11px] text-zinc-500 font-['JetBrains_Mono'] shrink-0">
                      {formatHour(block.start)}–{formatHour(block.end)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Mono className={`text-[11px] ${over ? "text-rose-400" : "text-zinc-500"}`}>
                      {used}/{capacity}h
                    </Mono>
                    <button
                      onClick={() => deleteBlock(block.id)}
                      className="opacity-0 group-hover/block:opacity-100 text-zinc-600 hover:text-rose-400 transition-opacity"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <BlockCapacityBar used={used} capacity={capacity} />
                <div className="flex flex-wrap gap-2 mt-2.5">
                  {assigned.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, t.id)}
                      className={`flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/60 pl-2 pr-2 py-1 cursor-grab active:cursor-grabbing hover:bg-zinc-900 transition-all ${
                        dragId === t.id ? "opacity-30" : ""
                      }`}
                    >
                      <MatrixPill q={t.matrix} />
                      <span className="text-[11px] text-zinc-300">{t.title}</span>
                      <Mono className="text-[10px] text-zinc-600">{t.estimate}h</Mono>
                    </div>
                  ))}
                  {assigned.length === 0 && <span className="text-[11px] text-zinc-700 italic">Drop a task here…</span>}
                </div>
                {over && (
                  <div className="flex items-center gap-1.5 text-rose-400 text-[11px] mt-2">
                    <AlertTriangle size={11} /> Overbooked by <Mono>{(used - capacity).toFixed(1)}h</Mono> — move
                    something back to This Week.
                  </div>
                )}
              </div>
            );
          })}
          {sortedBlocks.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center text-zinc-700 text-xs">
              No free blocks yet — add the real gaps in today's calendar above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatisticsView({ tasks }) {
  const stats = DAYS.map((day) => ({
    day,
    count: tasks.filter(
      (t) => t.status === "Done" && t.completedDay === day
    ).length,
  }));

  const max = Math.max(...stats.map((s) => s.count), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
        <h2 className="text-lg font-semibold text-zinc-100 mb-1">
          Hiệu quả công việc
        </h2>
        <p className="text-sm text-zinc-500">
          Số lượng task hoàn thành theo từng ngày trong tuần.
        </p>
      </div>

      <div className="space-y-3">
        {stats.map((s) => (
          <div
            key={s.day}
            className={`rounded-lg border p-3 ${
              s.count === max && max > 0
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-zinc-800 bg-zinc-900/40"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-zinc-200">
                {DAY_FULL[s.day]}
              </span>

              <span className="font-['JetBrains_Mono'] text-zinc-400">
                {s.count} task{s.count !== 1 ? "s" : ""}
                {s.count === max && max > 0 && " 🏆"}
              </span>
            </div>

            <div className="w-full h-2 bg-zinc-800 rounded">
              <div
                className="h-2 rounded bg-emerald-400"
                style={{
                  width: `${max === 0 ? 0 : (s.count / max) * 100}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root app
// ---------------------------------------------------------------------------
export default function MinimalistFlow() {
  const initial = loadData();
  const [tasks, setTasks] = useState(initial.tasks);
  const [freeBlocks, setFreeBlocks] = useState(initial.freeBlocks);
  const [materials, setMaterials] = useState(initial.materials || []);
  const [view, setView] = useState("board");
  const saveData = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        tasks,
        freeBlocks,
        materials,
      })
    );
  };

  useEffect(() => {
    saveData();
  }, [tasks, freeBlocks, materials]);

  const resetData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setTasks(MOCK_TASKS);
    setFreeBlocks(MOCK_FREE_BLOCKS);
    setMaterials([]);
  };  

const navItems = [
  { key: "board", label: "Board", icon: LayoutGrid },
  { key: "focus", label: "Focus Day", icon: Clock },
  { key: "timeline", label: "Timeline", icon: GanttChartSquare },
  { key: "task", label: "Task", icon: Grid2x2 },
  { key: "material", label: "Material", icon: Library }, // THÊM DÒNG NÀY
];

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-200 font-['Inter'] flex">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #27272a; border-radius: 4px; }
      `}</style>

      {/* faint console grid texture */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-zinc-900 flex flex-col relative z-10">
        <div className="px-5 py-5 border-b border-zinc-900">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-gradient-to-br from-rose-500 via-amber-400 to-cyan-400" />
            <span className="font-semibold text-zinc-100 text-sm tracking-tight">Minimalist Flow</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-1 uppercase tracking-widest">Minimize · Aim · Schedule · Execute</p>
        </div>

        <nav className="flex flex-col gap-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const activeItem = view === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setView(item.key)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  activeItem
                    ? "bg-zinc-900 text-zinc-100 border border-zinc-800"
                    : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50 border border-transparent"
                }`}
              >
                <Icon size={15} className={activeItem ? "text-zinc-100" : ""} />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-zinc-900">
          <div className="text-[10px] text-zinc-700 leading-relaxed">
            <Mono className="text-zinc-600">{tasks.filter((t) => t.status !== "Dropped").length}</Mono> active tasks ·{" "}
            <Mono className="text-zinc-600">{tasks.filter((t) => t.status === "Dropped").length}</Mono> dropped
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 relative z-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <header className="mb-6">
            <h1 className="text-lg font-semibold text-zinc-100">
              {view === "stats" && "Hiệu quả công việc"}
              {view === "board" && "Board"}
              {view === "focus" && "Focus Day"}
              {view === "timeline" && "Timeline"}
              {view === "task" && "Task"}
              {view === "material" && "Material"}
            </h1>
            <p className="text-xs text-zinc-600 mt-0.5">
              {view === "board" && "Schedule against real capacity, then execute — nothing more."}
              {view === "stats" && "Statistics of completed tasks by weekday."}
              {view === "focus" && "Give today's tasks a real time slot, not just a place in a list."}
              {view === "timeline" && "Trace every task back to what it's actually for."}
              {view === "task" && "Audit everything. Drop what doesn't earn its place."}
              {view === "material" && "Documents, Sheets and references for your work."}
            </p>
          </header>

          {view === "board" && <BoardView tasks={tasks} setTasks={setTasks} />}
          {view === "focus" && (
            <FocusDayView tasks={tasks} setTasks={setTasks} freeBlocks={freeBlocks} setFreeBlocks={setFreeBlocks} />
          )}
          {view === "timeline" && <TimelineView tasks={tasks} setTasks={setTasks} />}
          {view === "task" && <TaskView tasks={tasks} setTasks={setTasks} />}
          {view === "stats" && (
              <StatisticsView
                  tasks={tasks}
              />
          )}
          {view === "material" && (
              <MaterialView
                  tasks={tasks}
                  materials={materials}
                  setMaterials={setMaterials}
              />
          )}
        </div>
      </main>
    </div>
  );
}