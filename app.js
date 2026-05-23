const storageKey = "orbit-planner-state-v1";
const todayIso = getLocalDateIso();

const defaults = {
  schedule: [
    {
      id: crypto.randomUUID(),
      title: "复盘本周学习计划",
      date: todayIso,
      time: "09:30",
      duration: 45,
      notes: "整理 Python 和 C++ 的练习重点。"
    },
    {
      id: crypto.randomUUID(),
      title: "晚间阅读",
      date: todayIso,
      time: "21:00",
      duration: 30,
      notes: "给睡前留一个安静收尾。"
    }
  ],
  tasks: [
    {
      id: crypto.randomUUID(),
      title: "完成 3 道数组题",
      date: todayIso,
      priority: "high",
      done: false,
      notes: "重点关注边界条件。"
    },
    {
      id: crypto.randomUUID(),
      title: "整理桌面文件",
      date: todayIso,
      priority: "medium",
      done: false,
      notes: ""
    },
    {
      id: crypto.randomUUID(),
      title: "记录今天饮水量",
      date: todayIso,
      priority: "low",
      done: true,
      notes: ""
    }
  ],
  workouts: [
    {
      id: crypto.randomUUID(),
      title: "上肢力量",
      date: todayIso,
      time: "18:30",
      duration: 50,
      workoutType: "力量",
      done: false,
      notes: "俯卧撑、划船、肩部稳定。"
    },
    {
      id: crypto.randomUUID(),
      title: "轻松拉伸",
      date: shiftDate(todayIso, 1),
      time: "20:30",
      duration: 20,
      workoutType: "拉伸",
      done: false,
      notes: "髋部和后链。"
    }
  ]
};

let state = loadState();
let activeDate = todayIso;
let activeView = "dashboard";
let taskFilter = "all";

const viewTitles = {
  dashboard: "总览",
  schedule: "行程",
  tasks: "待办",
  fitness: "健身"
};

const priorityLabels = {
  high: "高优先级",
  medium: "中优先级",
  low: "低优先级"
};

const elements = {
  activeDate: document.querySelector("#activeDate"),
  todayLabel: document.querySelector("#todayLabel"),
  viewTitle: document.querySelector("#viewTitle"),
  scheduleCount: document.querySelector("#scheduleCount"),
  taskProgress: document.querySelector("#taskProgress"),
  workoutMinutes: document.querySelector("#workoutMinutes"),
  weeklyWorkout: document.querySelector("#weeklyWorkout"),
  todayTimeline: document.querySelector("#todayTimeline"),
  priorityTasks: document.querySelector("#priorityTasks"),
  workoutStrip: document.querySelector("#workoutStrip"),
  scheduleList: document.querySelector("#scheduleList"),
  taskList: document.querySelector("#taskList"),
  workoutList: document.querySelector("#workoutList"),
  weeklyGoalText: document.querySelector("#weeklyGoalText"),
  goalRing: document.querySelector("#goalRing"),
  entryDialog: document.querySelector("#entryDialog"),
  entryForm: document.querySelector("#entryForm"),
  dialogTitle: document.querySelector("#dialogTitle"),
  entryType: document.querySelector("#entryType"),
  entryTitle: document.querySelector("#entryTitle"),
  entryDate: document.querySelector("#entryDate"),
  entryTime: document.querySelector("#entryTime"),
  entryDuration: document.querySelector("#entryDuration"),
  entryPriority: document.querySelector("#entryPriority"),
  entryWorkoutType: document.querySelector("#entryWorkoutType"),
  entryNotes: document.querySelector("#entryNotes")
};

init();

function init() {
  registerServiceWorker();
  elements.activeDate.value = activeDate;
  elements.todayLabel.textContent = formatShortDate(todayIso);
  bindEvents();
  render();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("service-worker.js").catch(() => {
    // Offline mode is a bonus; the planner still works if registration is blocked.
  });
}

function bindEvents() {
  document.querySelectorAll(".nav-tab").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  document.querySelectorAll("[data-open-form]").forEach((button) => {
    button.addEventListener("click", () => openForm(button.dataset.openForm));
  });

  document.querySelectorAll("[data-task-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      taskFilter = button.dataset.taskFilter;
      document.querySelectorAll("[data-task-filter]").forEach((item) => item.classList.toggle("active", item === button));
      renderTasks();
    });
  });

  elements.activeDate.addEventListener("change", () => {
    activeDate = elements.activeDate.value || todayIso;
    render();
  });

  document.querySelector("#quickAdd").addEventListener("click", () => {
    const typeByView = {
      dashboard: "task",
      schedule: "schedule",
      tasks: "task",
      fitness: "workout"
    };
    openForm(typeByView[activeView]);
  });

  document.querySelector("#resetDemo").addEventListener("click", () => {
    state = structuredClone(defaults);
    saveState();
    render();
  });

  elements.entryForm.addEventListener("submit", (event) => {
    if (event.submitter?.value === "cancel") return;
    event.preventDefault();
    saveEntry();
  });
}

function switchView(view) {
  activeView = view;
  elements.viewTitle.textContent = viewTitles[view];
  document.querySelectorAll(".nav-tab").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  document.querySelectorAll(".view").forEach((section) => section.classList.remove("active"));
  document.querySelector(`#${view}View`).classList.add("active");
  render();
}

function openForm(type) {
  elements.entryForm.reset();
  elements.entryType.value = type;
  elements.entryDate.value = activeDate;
  elements.entryDuration.value = type === "workout" ? 45 : 30;
  elements.entryPriority.value = "medium";
  elements.entryWorkoutType.value = "力量";
  elements.dialogTitle.textContent = {
    schedule: "新增行程",
    task: "新增待办",
    workout: "新增训练"
  }[type];

  document.querySelectorAll(".schedule-only").forEach((node) => node.classList.toggle("hidden", type !== "schedule" && type !== "workout"));
  document.querySelectorAll(".task-only").forEach((node) => node.classList.toggle("hidden", type !== "task"));
  document.querySelectorAll(".workout-only").forEach((node) => node.classList.toggle("hidden", type !== "workout"));

  elements.entryDialog.showModal();
  elements.entryTitle.focus();
}

function saveEntry() {
  const type = elements.entryType.value;
  const base = {
    id: crypto.randomUUID(),
    title: elements.entryTitle.value.trim(),
    date: elements.entryDate.value,
    notes: elements.entryNotes.value.trim()
  };

  if (!base.title) return;

  if (type === "schedule") {
    state.schedule.push({
      ...base,
      time: elements.entryTime.value || "09:00",
      duration: Number(elements.entryDuration.value || 30)
    });
  }

  if (type === "task") {
    state.tasks.push({
      ...base,
      priority: elements.entryPriority.value,
      done: false
    });
  }

  if (type === "workout") {
    state.workouts.push({
      ...base,
      time: elements.entryTime.value || "18:00",
      duration: Number(elements.entryDuration.value || 45),
      workoutType: elements.entryWorkoutType.value,
      done: false
    });
  }

  saveState();
  elements.entryDialog.close();
  render();
}

function render() {
  renderDashboard();
  renderSchedule();
  renderTasks();
  renderFitness();
}

function renderDashboard() {
  const daySchedule = state.schedule.filter((item) => item.date === activeDate).sort(sortByTime);
  const dayTasks = state.tasks.filter((item) => item.date === activeDate);
  const doneTasks = dayTasks.filter((item) => item.done);
  const dayWorkouts = state.workouts.filter((item) => item.date === activeDate);
  const weekWorkouts = workoutsInActiveWeek();

  elements.scheduleCount.textContent = daySchedule.length;
  elements.taskProgress.textContent = `${doneTasks.length}/${dayTasks.length}`;
  elements.workoutMinutes.textContent = dayWorkouts.reduce((sum, item) => sum + item.duration, 0);
  elements.weeklyWorkout.textContent = `${weekWorkouts.filter((item) => item.done).length} 次`;

  elements.todayTimeline.innerHTML = daySchedule.length
    ? daySchedule.map(renderTimelineItem).join("")
    : emptyState("今天还没有行程。");

  const priorityTasks = [...dayTasks]
    .sort(sortTasks)
    .slice(0, 4);
  elements.priorityTasks.innerHTML = priorityTasks.length
    ? priorityTasks.map(renderCompactTask).join("")
    : emptyState("今天没有待办。");

  elements.workoutStrip.innerHTML = dayWorkouts.length
    ? dayWorkouts.map(renderWorkoutPill).join("")
    : emptyState("今天还没有训练安排。");
}

function renderSchedule() {
  const schedule = [...state.schedule].sort((a, b) => a.date.localeCompare(b.date) || sortByTime(a, b));
  elements.scheduleList.innerHTML = schedule.length
    ? schedule.map((item) => renderItemCard(item, "schedule")).join("")
    : emptyState("添加你的第一个行程。");
}

function renderTasks() {
  let tasks = [...state.tasks].sort(sortTasks);
  if (taskFilter === "open") tasks = tasks.filter((item) => !item.done);
  if (taskFilter === "done") tasks = tasks.filter((item) => item.done);

  elements.taskList.innerHTML = tasks.length
    ? tasks.map((item) => renderItemCard(item, "task")).join("")
    : emptyState("这个过滤条件下没有待办。");
}

function renderFitness() {
  const workouts = [...state.workouts].sort((a, b) => a.date.localeCompare(b.date) || sortByTime(a, b));
  const week = workoutsInActiveWeek();
  const done = week.filter((item) => item.done).length;
  const percent = Math.min(100, Math.round((done / 4) * 100));
  elements.weeklyGoalText.textContent = `${done}/4 次`;
  elements.goalRing.textContent = `${percent}%`;
  elements.goalRing.style.background = `conic-gradient(var(--green) ${percent * 3.6}deg, #e6ebe7 0deg)`;

  elements.workoutList.innerHTML = workouts.length
    ? workouts.map((item) => renderItemCard(item, "workout")).join("")
    : emptyState("添加你的第一条训练计划。");
}

function renderTimelineItem(item) {
  return `
    <article class="timeline-item">
      <span class="time-label">${escapeHtml(item.time)}</span>
      <div>
        <p class="item-title">${escapeHtml(item.title)}</p>
        <p class="item-note">${item.duration} 分钟${item.notes ? ` · ${escapeHtml(item.notes)}` : ""}</p>
      </div>
    </article>
  `;
}

function renderCompactTask(item) {
  return `
    <article class="compact-item">
      <div class="task-line">
        <span class="pill priority-${item.priority}">${priorityLabels[item.priority]}</span>
        <span class="status-pill ${item.done ? "status-done" : ""}">${item.done ? "已完成" : "进行中"}</span>
      </div>
      <p class="item-title">${escapeHtml(item.title)}</p>
    </article>
  `;
}

function renderWorkoutPill(item) {
  return `
    <article class="workout-pill">
      <div>
        <span class="pill">${escapeHtml(item.workoutType)}</span>
        <p class="item-title">${escapeHtml(item.title)}</p>
      </div>
      <p class="item-note">${escapeHtml(item.time)} · ${item.duration} 分钟</p>
    </article>
  `;
}

function renderItemCard(item, type) {
  const meta = [];
  meta.push(formatShortDate(item.date));
  if (item.time) meta.push(item.time);
  if (item.duration) meta.push(`${item.duration} 分钟`);
  if (item.priority) meta.push(priorityLabels[item.priority]);
  if (item.workoutType) meta.push(item.workoutType);

  const canToggle = type === "task" || type === "workout";
  return `
    <article class="item-card ${item.done ? "done" : ""}">
      <div>
        <div class="item-meta">
          ${meta.map((text) => `<span class="pill">${escapeHtml(text)}</span>`).join("")}
          ${canToggle ? `<span class="status-pill ${item.done ? "status-done" : ""}">${item.done ? "已完成" : "进行中"}</span>` : ""}
        </div>
        <p class="item-title">${escapeHtml(item.title)}</p>
        ${item.notes ? `<p class="item-note">${escapeHtml(item.notes)}</p>` : ""}
      </div>
      <div class="item-actions">
        ${canToggle ? `<button type="button" data-action="toggle" data-type="${type}" data-id="${item.id}">${item.done ? "恢复" : "完成"}</button>` : ""}
        <button type="button" data-action="delete" data-type="${type}" data-id="${item.id}">删除</button>
      </div>
    </article>
  `;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const collection = getCollection(button.dataset.type);
  const id = button.dataset.id;

  if (button.dataset.action === "toggle") {
    const item = collection.find((entry) => entry.id === id);
    if (item) item.done = !item.done;
  }

  if (button.dataset.action === "delete") {
    const index = collection.findIndex((entry) => entry.id === id);
    if (index >= 0) collection.splice(index, 1);
  }

  saveState();
  render();
});

function getCollection(type) {
  if (type === "schedule") return state.schedule;
  if (type === "task") return state.tasks;
  return state.workouts;
}

function workoutsInActiveWeek() {
  const date = parseLocalDate(activeDate);
  const day = date.getDay() || 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - day + 1);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return state.workouts.filter((item) => {
    const itemDate = parseLocalDate(item.date);
    return itemDate >= monday && itemDate <= sunday;
  });
}

function sortByTime(a, b) {
  return (a.time || "00:00").localeCompare(b.time || "00:00");
}

function sortTasks(a, b) {
  const weight = { high: 0, medium: 1, low: 2 };
  return Number(a.done) - Number(b.done) || weight[a.priority] - weight[b.priority] || a.date.localeCompare(b.date);
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function loadState() {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return structuredClone(defaults);
  try {
    const parsed = JSON.parse(raw);
    return {
      schedule: parsed.schedule || [],
      tasks: parsed.tasks || [],
      workouts: parsed.workouts || []
    };
  } catch {
    return structuredClone(defaults);
  }
}

function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return getLocalDateIso(date);
}

function formatShortDate(isoDate) {
  const date = parseLocalDate(isoDate);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function getLocalDateIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(isoDate) {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
