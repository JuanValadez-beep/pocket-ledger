const DB_NAME = "pocket-ledger-db";
const DB_VERSION = 1;
const STORE = "state";
const STATE_KEY = "app";

const months = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const categorySeed = [
  { id: "ingresos", name: "Ingresos", color: "#218bd6", icon: "I", type: "income", active: true },
  { id: "casa", name: "Casa", color: "#15a880", icon: "C", type: "expense", active: true },
  { id: "gasolina", name: "Gasolina", color: "#ff8a3d", icon: "G", type: "expense", active: true },
  { id: "ahorro", name: "Ahorro", color: "#2ec4b6", icon: "A", type: "saving", active: true },
  { id: "carro", name: "Carro", color: "#f7b731", icon: "R", type: "debt", active: true },
  { id: "laptop", name: "Laptop", color: "#f56565", icon: "L", type: "debt", active: true },
  { id: "chat", name: "Chat", color: "#7c5ce5", icon: "T", type: "expense", active: true },
  { id: "otros", name: "Otros", color: "#a5acb6", icon: "O", type: "expense", active: true },
];

function tx(concept, amount, direction, date, categoryId, period, status, type = "variable") {
  return {
    id: crypto.randomUUID(),
    concept,
    amount,
    direction,
    date,
    categoryId,
    period,
    status,
    type,
    paymentMethod: "debito",
    notes: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const demoState = {
  settings: {
    currency: "MXN",
    baseSalary: 6000,
    effectiveFrom: "2025-01-01",
    monthlySavingsTarget: 0,
    showSavingsSummary: true,
    paymentFrequency: "biweekly",
    warningLimit: 82,
    dangerLimit: 100,
    antExpenseLimit: 120,
    pin: "",
    appLocked: false,
    theme: "light",
    lastBackupAt: null,
  },
  selected: {
    month: 4,
    year: 2025,
    period: "second",
    view: "home",
  },
  categories: categorySeed,
  fixedExpenses: [
    { id: "fx-casa", name: "Casa", amount: 1200, day: 1, categoryId: "casa", active: true, paid: false },
    { id: "fx-internet", name: "Internet", amount: 450, day: 3, categoryId: "otros", active: true, paid: false },
    { id: "fx-luz", name: "Luz", amount: 320, day: 6, categoryId: "otros", active: true, paid: false },
    { id: "fx-chat", name: "Chat", amount: 400, day: 15, categoryId: "chat", active: true, paid: true },
  ],
  budgets: [
    { id: "b-casa", year: 2025, month: 4, categoryId: "casa", amount: 2200 },
    { id: "b-gasolina", year: 2025, month: 4, categoryId: "gasolina", amount: 1800 },
    { id: "b-ahorro", year: 2025, month: 4, categoryId: "ahorro", amount: 1200 },
  ],
  savingGoals: [
    { id: "goal-emergency", name: "Fondo de emergencia", targetAmount: 15000, currentAmount: 600, targetDate: "2025-12-31", categoryId: "ahorro", status: "active", notes: "" },
    { id: "goal-trip", name: "Viaje", targetAmount: 12000, currentAmount: 2000, targetDate: "2025-10-15", categoryId: "ahorro", status: "active", notes: "" },
  ],
  debts: [
    { id: "debt-laptop", name: "Laptop", totalAmount: 19980, paidAmount: 7770, startDate: "2025-01-01", dueDate: "2026-06-30", minimumPayment: 1110, frequency: "monthly", status: "active", notes: "18 pagos" },
    { id: "debt-carro", name: "Carro", totalAmount: 7260, paidAmount: 2420, startDate: "2025-06-01", dueDate: "2025-11-30", minimumPayment: 1210, frequency: "monthly", status: "active", notes: "6 pagos" },
  ],
  debtPayments: [
    { id: "dp-laptop-1", debtId: "debt-laptop", date: "2025-05-23", amount: 1110, notes: "Pago mensual" },
  ],
  transactions: [
    tx("Sueldo quincenal", 6000, "income", "2025-05-16", "otros", "second", "paid"),
    tx("Casa", 1200, "expense", "2025-05-01", "casa", "first", "paid", "fixed"),
    tx("Gasolina", 850, "expense", "2025-05-18", "gasolina", "second", "paid"),
    tx("Ahorro", 600, "expense", "2025-05-20", "ahorro", "second", "paid", "saving"),
    tx("Carro", 450, "expense", "2025-05-21", "carro", "second", "paid", "debt"),
    tx("Laptop", 250, "expense", "2025-05-23", "laptop", "second", "paid", "debt"),
    tx("Chat", 200, "expense", "2025-05-24", "chat", "second", "paid"),
  ],
};

let state = structuredClone(demoState);
let isUnlocked = false;
let movementDirection = "expense";
let editorState = null;
let unlockError = "";

const $ = (selector) => document.querySelector(selector);
const money = (value) => new Intl.NumberFormat("es-MX", { style: "currency", currency: state.settings?.currency || "MXN" }).format(value || 0);
const shortMoney = (value) => money(value).replace(state.settings?.currency || "MXN", "").trim();
const textDecoder = new TextDecoder();
const decodeText = (data) => data ? textDecoder.decode(data) : "";
const byPeriod = (item) => getSelectedPeriodIds().includes(item.period);
const byMonth = (item) => {
  const date = new Date(`${item.date}T12:00:00`);
  return date.getFullYear() === Number(state.selected.year) && date.getMonth() === Number(state.selected.month);
};
const categoryById = (id) => state.categories.find((item) => item.id === id) || state.categories.at(-1);
const movementCategories = (direction) => {
  if (direction === "income") {
    return state.categories.filter((item) => item.type === "income" || item.id === "otros");
  }
  return state.categories.filter((item) => item.type !== "income");
};
function ensureStateDefaults() {
  state.settings = { ...demoState.settings, ...(state.settings || {}) };
  state.payProfiles = state.payProfiles?.length ? state.payProfiles : [{
    id: "pay-default",
    effectiveFrom: state.settings.effectiveFrom || "2025-01-01",
    baseSalary: Number(state.settings.baseSalary || 0),
    paymentFrequency: state.settings.paymentFrequency || "biweekly",
  }];
  state.selected = { ...demoState.selected, ...(state.selected || {}) };
  state.categories = state.categories?.length ? state.categories : structuredClone(demoState.categories);
  for (const category of categorySeed) {
    if (!state.categories.some((item) => item.id === category.id)) state.categories.unshift(structuredClone(category));
  }
  state.fixedExpenses = state.fixedExpenses || [];
  state.budgets = state.budgets || structuredClone(demoState.budgets);
  state.savingGoals = state.savingGoals || structuredClone(demoState.savingGoals);
  state.debts = state.debts || structuredClone(demoState.debts);
  state.debtPayments = state.debtPayments || structuredClone(demoState.debtPayments);
  state.transactions = state.transactions || [];
  syncCurrentPayProfile();
  if (!getPeriods().some((period) => period.id === state.selected.period)) {
    state.selected.period = getPeriods()[0].id;
  }
}

function selectedMonthDate(day = 1) {
  return `${state.selected.year}-${String(Number(state.selected.month) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function getEffectivePayProfile(dateText = defaultMovementDate()) {
  const fallback = {
    effectiveFrom: "1900-01-01",
    baseSalary: Number(state.settings.baseSalary || 0),
    paymentFrequency: state.settings.paymentFrequency || "biweekly",
  };
  const profiles = (state.payProfiles?.length ? state.payProfiles : [fallback])
    .slice()
    .sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  return profiles.filter((profile) => String(profile.effectiveFrom) <= String(dateText)).at(-1) || profiles[0] || fallback;
}

function syncCurrentPayProfile() {
  const profile = getEffectivePayProfile(defaultMovementDate());
  state.settings.baseSalary = Number(profile.baseSalary || 0);
  state.settings.paymentFrequency = profile.paymentFrequency || "biweekly";
  state.settings.effectiveFrom = state.settings.effectiveFrom || selectedMonthDate();
}

function upsertPayProfile(effectiveFrom, baseSalary, paymentFrequency) {
  const date = effectiveFrom || selectedMonthDate();
  const existing = state.payProfiles.find((profile) => profile.effectiveFrom === date);
  const next = {
    id: existing?.id || `pay-${crypto.randomUUID()}`,
    effectiveFrom: date,
    baseSalary: Number(baseSalary || 0),
    paymentFrequency: paymentFrequency || "biweekly",
  };
  if (existing) Object.assign(existing, next);
  else state.payProfiles.push(next);
  state.payProfiles.sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
  syncCurrentPayProfile();
}

function getPeriods(dateText = defaultMovementDate()) {
  const frequency = getEffectivePayProfile(dateText).paymentFrequency || "biweekly";
  if (frequency === "weekly") {
    return [
      { id: "week1", label: "Semana 1", range: "1 - 7" },
      { id: "week2", label: "Semana 2", range: "8 - 14" },
      { id: "week3", label: "Semana 3", range: "15 - 21" },
      { id: "week4", label: "Semana 4", range: "22 - 31" },
    ];
  }
  if (frequency === "monthly") {
    return [{ id: "month", label: "Mes completo", range: "1 - 31" }];
  }
  return [
    { id: "first", label: "1a Quincena", range: "1 - 15" },
    { id: "second", label: "2a Quincena", range: "16 - 31" },
  ];
}

function getSelectedPeriodIds() {
  if (state.selected.period === "month") return getPeriods().map((period) => period.id);
  return [state.selected.period];
}

function periodLabel(periodId = state.selected.period) {
  return getPeriods().find((period) => period.id === periodId)?.label || "Periodo";
}

function periodNoun() {
  const frequency = state.settings.paymentFrequency || "biweekly";
  if (frequency === "weekly") return "semana";
  if (frequency === "monthly") return "mes";
  return "quincena";
}

function payFrequencyLabel(frequency) {
  if (frequency === "weekly") return "semana";
  if (frequency === "monthly") return "mes";
  return "quincena";
}

function periodRange(periodId = state.selected.period) {
  const period = getPeriods().find((item) => item.id === periodId) || getPeriods()[0];
  return `${period.range} ${months[state.selected.month].slice(0, 3)}`;
}

function defaultMovementDate() {
  const period = state.selected.period;
  const dayByPeriod = { first: 1, second: 16, week1: 1, week2: 8, week3: 15, week4: 22, month: 1 };
  const day = String(dayByPeriod[period] || 1).padStart(2, "0");
  return `${state.selected.year}-${String(Number(state.selected.month) + 1).padStart(2, "0")}-${day}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function loadState() {
  try {
    const db = await openDb();
    const saved = await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(STATE_KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    if (saved) state = saved;
  } catch {
    const fallback = localStorage.getItem("pocket-ledger-state");
    if (fallback) state = JSON.parse(fallback);
  }
}

async function saveState() {
  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, "readwrite").objectStore(STORE).put(state, STATE_KEY);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    localStorage.setItem("pocket-ledger-state", JSON.stringify(state));
  }
}

function currentTransactions() {
  return state.transactions.filter(byMonth);
}

function periodTransactions() {
  return currentTransactions().filter(byPeriod);
}

function plannedIncomeForPeriods(periodIds = getSelectedPeriodIds()) {
  return Number(getEffectivePayProfile(defaultMovementDate()).baseSalary || 0) * Math.max(1, periodIds.length);
}

function totals() {
  const periodItems = periodTransactions();
  const monthItems = currentTransactions();
  const actualIncome = periodItems.filter((t) => t.direction === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expenses = periodItems.filter((t) => t.direction === "expense" && t.status !== "cancelled").reduce((s, t) => s + Number(t.amount), 0);
  const actualMonthIncome = monthItems.filter((t) => t.direction === "income").reduce((s, t) => s + Number(t.amount), 0);
  const plannedIncome = plannedIncomeForPeriods();
  const plannedMonthIncome = plannedIncomeForPeriods(getPeriods().map((period) => period.id));
  const income = plannedIncome > 0 ? plannedIncome : actualIncome;
  const monthIncome = plannedMonthIncome > 0 ? plannedMonthIncome : actualMonthIncome;
  const monthExpense = monthItems.filter((t) => t.direction === "expense" && t.status !== "cancelled").reduce((s, t) => s + Number(t.amount), 0);
  const savings = monthItems.filter((t) => t.categoryId === "ahorro").reduce((s, t) => s + Number(t.amount), 0);
  return {
    income,
    actualIncome,
    expenses,
    available: income - expenses,
    monthIncome,
    actualMonthIncome,
    monthExpense,
    monthAvailable: monthIncome - monthExpense,
    savings,
    usedPct: income ? Math.min(100, Math.round((expenses / income) * 100)) : 0,
    savingsPct: monthIncome ? Math.round((savings / monthIncome) * 100) : 0,
  };
}

function groupedCategories() {
  const rows = [];
  const total = totals().expenses;
  for (const category of state.categories) {
    const amount = periodTransactions()
      .filter((t) => t.direction === "expense" && t.categoryId === category.id && t.status !== "cancelled")
      .reduce((sum, t) => sum + Number(t.amount), 0);
    if (amount > 0) rows.push({ ...category, amount, pct: total ? Math.round((amount / total) * 100) : 0 });
  }
  return rows.sort((a, b) => b.amount - a.amount);
}

function monthKey(year = state.selected.year, month = state.selected.month) {
  return `${year}-${String(Number(month) + 1).padStart(2, "0")}`;
}

function daysUntil(dateText) {
  const today = new Date();
  const target = new Date(`${dateText}T12:00:00`);
  return Math.ceil((target - today) / 86400000);
}

function selectedPeriodBounds(periodId = state.selected.period) {
  const year = Number(state.selected.year);
  const month = Number(state.selected.month);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const ranges = {
    first: [1, 15],
    second: [16, lastDay],
    week1: [1, 7],
    week2: [8, 14],
    week3: [15, 21],
    week4: [22, lastDay],
    month: [1, lastDay],
  };
  const [start, end] = ranges[periodId] || ranges[state.selected.period] || [1, lastDay];
  return {
    start: new Date(year, month, start, 12),
    end: new Date(year, month, Math.min(end, lastDay), 12),
    startDay: start,
    endDay: Math.min(end, lastDay),
  };
}

function daysLeftInSelectedPeriod() {
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const { start, end } = selectedPeriodBounds();
  if (today < start) return Math.max(0, Math.ceil((end - start) / 86400000) + 1);
  if (today > end) return 0;
  return Math.max(0, Math.ceil((end - today) / 86400000));
}

function dueText(dateText) {
  const diff = daysUntil(dateText);
  if (diff < 0) return `Vencido hace ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? "" : "s"}`;
  if (diff === 0) return "Vence hoy";
  return `En ${diff} dia${diff === 1 ? "" : "s"}`;
}

function fixedDueDate(fx) {
  const day = Math.min(Number(fx.day || 1), new Date(Number(state.selected.year), Number(state.selected.month) + 1, 0).getDate());
  return selectedMonthDate(day);
}

function monthlyCategorySpend(categoryId) {
  return currentTransactions()
    .filter((t) => t.direction === "expense" && t.status !== "cancelled" && t.categoryId === categoryId)
    .reduce((sum, item) => sum + Number(item.amount), 0);
}

function budgetRows() {
  return movementCategories("expense").map((category) => {
    const existing = state.budgets.find((budget) => Number(budget.year) === Number(state.selected.year) && Number(budget.month) === Number(state.selected.month) && budget.categoryId === category.id);
    const assigned = Number(existing?.amount || 0);
    const spent = monthlyCategorySpend(category.id);
    const used = assigned ? Math.round((spent / assigned) * 100) : 0;
    const status = assigned === 0 ? "Sin presupuesto" : used >= 100 ? "Excedido" : used >= 85 ? "Cerca del limite" : "Dentro";
    return { ...category, budgetId: existing?.id, assigned, spent, remaining: assigned - spent, used, status };
  });
}

function debtBalance(debt) {
  const payments = state.debtPayments.filter((payment) => payment.debtId === debt.id).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const paid = Math.max(Number(debt.paidAmount || 0), payments);
  return { paid, pending: Math.max(0, Number(debt.totalAmount || 0) - paid) };
}

function calendarItems() {
  const year = Number(state.selected.year);
  const month = Number(state.selected.month);
  const items = [];
  for (const txItem of currentTransactions()) {
    items.push({ date: txItem.date, label: txItem.concept, amount: txItem.amount, type: txItem.direction === "income" ? "Ingreso" : "Movimiento", status: txItem.status });
  }
  for (const fx of state.fixedExpenses.filter((item) => item.active)) {
    items.push({ date: `${year}-${String(month + 1).padStart(2, "0")}-${String(fx.day).padStart(2, "0")}`, label: fx.name, amount: fx.amount, type: "Pago fijo", status: fx.paid ? "Pagado" : "Pendiente" });
  }
  for (const debt of state.debts.filter((item) => item.status !== "paid")) {
    const due = debt.dueDate || `${year}-${String(month + 1).padStart(2, "0")}-28`;
    if (new Date(`${due}T12:00:00`).getMonth() === month) {
      items.push({ date: due, label: debt.name, amount: debt.minimumPayment, type: "Deuda", status: "Pendiente" });
    }
  }
  return items.sort((a, b) => a.date.localeCompare(b.date));
}

function reportMetrics() {
  const t = totals();
  const monthItems = currentTransactions();
  const expenses = monthItems.filter((item) => item.direction === "expense" && item.status !== "cancelled");
  const topExpense = expenses.slice().sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  const daily = expenses.reduce((map, item) => {
    map[item.date] = (map[item.date] || 0) + Number(item.amount);
    return map;
  }, {});
  const maxDay = Object.entries(daily).sort((a, b) => b[1] - a[1])[0];
  const avgDaily = expenses.length ? expenses.reduce((sum, item) => sum + Number(item.amount), 0) / Math.max(1, new Set(expenses.map((item) => item.date)).size) : 0;
  const projected = t.monthExpense + avgDaily * Math.max(0, 31 - new Date().getDate());
  return { ...t, topExpense, maxDay, avgDaily, projected };
}

function antExpenses() {
  const limit = Number(state.settings.antExpenseLimit || 120);
  const rows = currentTransactions().filter((item) => item.direction === "expense" && Number(item.amount) <= limit);
  const byCategory = rows.reduce((map, item) => {
    const name = categoryById(item.categoryId).name;
    map[name] = (map[name] || 0) + Number(item.amount);
    return map;
  }, {});
  return {
    limit,
    rows,
    total: rows.reduce((sum, item) => sum + Number(item.amount), 0),
    top: Object.entries(byCategory).sort((a, b) => b[1] - a[1]),
  };
}

function healthState() {
  const used = totals().usedPct;
  const warning = Number(state.settings.warningLimit || 82);
  const danger = Number(state.settings.dangerLimit || 100);
  if (used >= danger) return { title: "Presupuesto excedido", detail: "Conviene frenar gastos.", color: "#ef4444", active: "red" };
  if (used >= warning) return { title: "Cuidado", detail: "Vas cerca del limite.", color: "#f59e0b", active: "yellow" };
  return { title: "Vas bien", detail: "Llevas un buen ritmo. Sigue asi", color: "#12aa86", active: "green" };
}

function donutGradient(rows) {
  if (!rows.length) return "conic-gradient(#d7dee4 0 100%)";
  let cursor = 0;
  const segments = rows.map((row, index) => {
    const slice = index === rows.length - 1 ? 100 - cursor : row.pct;
    const start = cursor;
    const end = Math.min(100, cursor + slice);
    cursor = end;
    return `${row.color} ${start}% ${end}%`;
  });
  return `conic-gradient(${segments.join(", ")})`;
}

function render() {
  document.documentElement.dataset.theme = state.settings.theme;
  if (state.settings.pin && state.settings.appLocked && !isUnlocked) {
    $("#root").innerHTML = renderLock();
    bindLockEvents();
    return;
  }
  $("#root").innerHTML = `
    <main class="app-shell">
      ${renderTopbar()}
      <section class="content">
        ${renderHome()}
        ${renderMovements()}
        ${renderBudget()}
        ${renderSavings()}
        ${renderMore()}
        ${renderSettings()}
      </section>
      <button class="fab" id="addExpenseBtn" aria-label="Agregar movimiento">
        <span class="fab-circle">+</span>
      </button>
      ${renderBottomNav()}
      ${renderModal()}
      ${renderEditorModal()}
    </main>
  `;
  bindEvents();
}

function renderLock() {
  return `
    <main class="app-shell lock-shell">
      <section class="lock-card">
        <div class="brand-mark">P</div>
        <h1>Pocket Ledger</h1>
        <p class="subtle">Tus datos estan protegidos con PIN local.</p>
        ${unlockError ? `<p class="form-error">${unlockError}</p>` : ""}
        <form class="form-grid" id="unlockForm">
          <label class="field"><span>PIN</span><input name="pin" type="password" inputmode="numeric" autocomplete="current-password" autofocus></label>
          <button class="primary-btn">Entrar</button>
        </form>
      </section>
    </main>
  `;
}

function bindLockEvents() {
  $("#unlockForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (String(data.pin || "") !== String(state.settings.pin || "")) {
      unlockError = "PIN incorrecto.";
      render();
      return;
    }
    unlockError = "";
    isUnlocked = true;
    render();
  });
}

function renderTopbar() {
  return `
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark">P</div>
        <h1>Pocket Ledger</h1>
      </div>
      <div class="top-actions">
        <div class="offline-badge" title="Tus datos se guardan localmente">
          ${svgCloudOff()} <span>Sin conexion</span>
        </div>
        <button class="icon-btn ${state.selected.view === "config" ? "active" : ""}" data-nav="config" aria-label="Abrir configuracion">${svgSettings()}</button>
      </div>
    </header>
  `;
}

function renderControls() {
  return `
    <div class="period-row">
      <label class="month-picker">
        ${svgCalendar()}
        <select class="calendar-month-select" data-calendar-control="month" aria-label="Mes">
          ${months.map((m, i) => `<option value="${i}" ${i === Number(state.selected.month) ? "selected" : ""}>${m}</option>`).join("")}
        </select>
      </label>
      <select class="year-select calendar-year-select" data-calendar-control="year" aria-label="Anio">
        ${[2025, 2026, 2027].map((y) => `<option value="${y}" ${y === Number(state.selected.year) ? "selected" : ""}>${y}</option>`).join("")}
      </select>
    </div>
    <div class="segment" role="tablist">
      ${getPeriods().map((period) => `
        <button data-period="${period.id}" class="${state.selected.period === period.id ? "active" : ""}">
          ${state.selected.period === period.id ? "OK " : ""}${period.label}<br><span>${periodRange(period.id)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function renderHome() {
  const t = totals();
  const rows = groupedCategories();
  const health = healthState();
  const daysLeft = daysLeftInSelectedPeriod();
  return `
    <div class="view ${state.selected.view === "home" ? "active" : ""}" data-view="home">
      ${renderControls()}
      <section class="card">
        <div class="card-title"><h2>Disponible por ${periodNoun()}</h2><button class="info-dot" data-info="balance" aria-label="Ver informacion">i</button></div>
        <div class="split">
          <div>
            <div class="metric-big green-text">${shortMoney(Math.max(t.available, 0))} <span class="currency">${state.settings.currency}</span></div>
            <p class="subtle">${daysLeft} dia${daysLeft === 1 ? "" : "s"} restantes</p>
          </div>
          <div>
            <div class="progress-wrap"><div class="progress"><span style="width:${t.usedPct}%"></span></div><strong>${100 - t.usedPct}%</strong></div>
            <p class="subtle">Gastado: ${money(t.expenses)} de ${money(t.income)}</p>
          </div>
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">En que se va mi sueldo</h2>
        <div class="donut-row">
          <div class="donut" style="background:${donutGradient(rows)}"><div class="donut-center"><strong>${shortMoney(t.expenses)}</strong><span>Total</span></div></div>
          <div class="category-list">
            ${rows.map((row) => `
              <div class="category-row">
                <span class="dot" style="background:${row.color}">${row.icon}</span>
                <span>${row.name}</span>
                <strong>${shortMoney(row.amount)}</strong>
                <span class="subtle">${row.pct}%</span>
              </div>
            `).join("") || `<p class="empty">Aun no hay gastos en esta quincena.</p>`}
          </div>
        </div>
      </section>
      <section class="card">
        <div class="health">
          <div>
            <div class="card-title"><h2>Voy bien este mes</h2><button class="info-dot" data-info="health" aria-label="Ver limites del semaforo">i</button></div>
            <h3 style="color:${health.color}">${health.title}</h3>
            <p class="subtle">${health.detail}</p>
          </div>
          <div class="traffic">
            <div class="traffic-light">
              <span class="lamp red ${health.active === "red" ? "on" : ""}"></span>
              <span class="lamp yellow ${health.active === "yellow" ? "on" : ""}"></span>
              <span class="lamp green ${health.active === "green" ? "on" : ""}"></span>
            </div>
          </div>
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">Proximos pagos fijos</h2>
        <div class="payment-list">
          ${state.fixedExpenses.filter((fx) => fx.active && !fx.paid).slice(0, 3).map((fx) => {
            const category = categoryById(fx.categoryId);
            const due = fixedDueDate(fx);
            return `
              <div class="payment-row">
                <span class="tile" style="background:${category.color}22;color:${category.color}">${category.icon}</span>
                <div><strong>${fx.name}</strong><br><span class="subtle">${due}</span></div>
                <div><strong>${money(fx.amount)}</strong><br><span class="${daysUntil(due) <= 3 ? "danger" : "subtle"}">${dueText(due)}</span></div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMovements() {
  const items = currentTransactions().slice().sort((a, b) => b.date.localeCompare(a.date));
  return `
    <div class="view ${state.selected.view === "gastos" ? "active" : ""}" data-view="gastos">
      ${renderControls()}
      <section class="card">
        <div class="card-title"><h2>Movimientos</h2><button class="secondary-btn" id="seedBtn">Datos demo</button></div>
        <div class="movement-list">
          ${items.map((item) => {
            const cat = categoryById(item.categoryId);
            return `
              <div class="movement-row">
                <span class="tile" style="background:${cat.color}22;color:${cat.color}">${cat.icon}</span>
                <div><strong>${item.concept}</strong><br><span class="subtle">${item.date} · ${periodLabel(item.period)}</span></div>
                <strong class="${item.direction === "income" ? "green-text" : ""}">${item.direction === "income" ? "+" : "-"}${money(item.amount)}</strong>
                <div class="row-actions movement-actions">
                  <button class="secondary-btn small-btn" data-edit-transaction="${item.id}">Editar</button>
                  <button class="danger-btn small-btn" data-delete-transaction="${item.id}">Eliminar</button>
                </div>
              </div>
            `;
          }).join("") || `<p class="empty">Sin movimientos todavia.</p>`}
        </div>
      </section>
    </div>
  `;
}

function renderBudget() {
  const t = totals();
  const rows = budgetRows();
  return `
    <div class="view ${state.selected.view === "presupuesto" ? "active" : ""}" data-view="presupuesto">
      ${renderControls()}
      <section class="card">
        <h2 class="section-title">Presupuesto mensual</h2>
        <div class="pill-grid">
          <div class="mini-card"><span class="subtle">Ingreso del mes</span><strong>${money(t.monthIncome)}</strong></div>
          <div class="mini-card"><span class="subtle">Gasto del mes</span><strong>${money(t.monthExpense)}</strong></div>
          <div class="mini-card"><span class="subtle">Disponible cierre</span><strong>${money(t.monthAvailable)}</strong></div>
          <div class="mini-card"><span class="subtle">Sueldo usado</span><strong>${t.usedPct}%</strong></div>
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">Limites por categoria</h2>
        <form class="form-grid compact-form" id="budgetForm">
          <label class="field"><span>Categoria</span><select name="categoryId">${movementCategories("expense").map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label>
          <label class="field"><span>Limite mensual</span><input name="amount" required type="number" min="0" step="0.01" placeholder="1500"></label>
          <button class="secondary-btn">Guardar presupuesto</button>
        </form>
        <div class="admin-list">
          ${rows.map((row) => `
            <div class="admin-row">
              <span class="dot" style="background:${row.color}">${row.icon}</span>
              <div>
                <strong>${row.name}</strong><br>
                <span class="subtle">${money(row.spent)} de ${money(row.assigned)} · ${row.status}</span>
                <div class="progress mini-progress"><span style="width:${Math.min(100, row.used)}%"></span></div>
              </div>
              <div class="row-actions">
                <span class="${row.remaining < 0 ? "danger" : "green-text"}">${money(row.remaining)} restante</span>
                <button class="secondary-btn small-btn" data-edit-budget="${row.budgetId || row.id}">Editar</button>
                ${row.budgetId ? `<button class="danger-btn small-btn" data-delete-budget="${row.budgetId}">Eliminar</button>` : ""}
              </div>
            </div>
          `).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderSavings() {
  const t = totals();
  return `
    <div class="view ${state.selected.view === "ahorros" ? "active" : ""}" data-view="ahorros">
      ${renderControls()}
      <section class="card">
        <div class="card-title"><h2>Metas de ahorro</h2><button class="info-dot" data-info="goals" aria-label="Ver informacion">i</button></div>
        <form class="form-grid compact-form" id="goalForm">
          <label class="field"><span>Nombre</span><input name="name" required placeholder="Viaje"></label>
          <label class="field"><span>Objetivo</span><input name="targetAmount" required type="number" min="1" step="0.01" placeholder="12000"></label>
          <label class="field"><span>Actual</span><input name="currentAmount" type="number" min="0" step="0.01" placeholder="0"></label>
          <label class="field"><span>Fecha objetivo</span><input name="targetDate" type="date" value="${state.selected.year}-12-31"></label>
          <button class="secondary-btn">Agregar meta</button>
        </form>
        <div class="admin-list">
          ${state.savingGoals.map((goal) => {
            const pct = Math.min(100, Math.round((Number(goal.currentAmount || 0) / Number(goal.targetAmount || 1)) * 100));
            const missing = Math.max(0, Number(goal.targetAmount || 0) - Number(goal.currentAmount || 0));
            const monthsLeft = Math.max(1, Math.ceil(daysUntil(goal.targetDate) / 30));
            return `
              <div class="admin-row">
                <span class="tile" style="background:#2ec4b622;color:#2ec4b6">A</span>
                <div>
                  <strong>${goal.name}</strong><br>
                  <span class="subtle">${pct}% · faltan ${money(missing)} · sugerido ${money(missing / monthsLeft)}/mes</span>
                  <div class="progress mini-progress"><span style="width:${pct}%"></span></div>
                </div>
                <div class="row-actions">
                  <button class="secondary-btn small-btn" data-add-goal="${goal.id}">Aportar</button>
                  <button class="secondary-btn small-btn" data-edit-goal="${goal.id}">Editar</button>
                  <button class="danger-btn small-btn" data-delete-goal="${goal.id}">Eliminar</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
      ${state.settings.showSavingsSummary ? `<section class="card">
        <h2 class="section-title">Ahorro mensual</h2>
        <div class="pill-grid">
          <div class="mini-card"><span class="subtle">Destinado</span><strong>${money(t.savings)}</strong></div>
          <div class="mini-card"><span class="subtle">Meta</span><strong>${money(state.settings.monthlySavingsTarget)}</strong></div>
          <div class="mini-card"><span class="subtle">Porcentaje</span><strong>${t.savingsPct}%</strong></div>
          <div class="mini-card"><span class="subtle">Falta</span><strong>${money(Math.max(0, Number(state.settings.monthlySavingsTarget || 0) - t.savings))}</strong></div>
        </div>
        <div class="row-actions summary-actions">
          <button class="secondary-btn small-btn" id="editMonthlySavings">Editar ahorro</button>
          <button class="danger-btn small-btn" id="hideMonthlySavings">Quitar bloque</button>
        </div>
      </section>` : ""}
      <section class="card">
        <div class="card-title"><h2>Deudas</h2><button class="info-dot" data-info="debts" aria-label="Ver informacion">i</button></div>
        <form class="form-grid compact-form" id="debtForm">
          <label class="field"><span>Nombre</span><input name="name" required placeholder="Tarjeta"></label>
          <label class="field"><span>Monto total</span><input name="totalAmount" required type="number" min="1" step="0.01"></label>
          <label class="field"><span>Pagado inicial</span><input name="paidAmount" type="number" min="0" step="0.01" value="0"></label>
          <label class="field"><span>Pago minimo</span><input name="minimumPayment" type="number" min="0" step="0.01"></label>
          <label class="field"><span>Fecha limite</span><input name="dueDate" type="date"></label>
          <button class="secondary-btn">Agregar deuda</button>
        </form>
        <div class="admin-list">
          ${state.debts.map((debt) => {
            const balance = debtBalance(debt);
            const pct = Math.min(100, Math.round((balance.paid / Number(debt.totalAmount || 1)) * 100));
            return `
              <div class="admin-row">
                <span class="tile" style="background:#f5656522;color:#f56565">D</span>
                <div>
                  <strong>${debt.name}</strong><br>
                  <span class="subtle">${money(balance.paid)} pagado · ${money(balance.pending)} pendiente · vence ${debt.dueDate || "sin fecha"}</span>
                  <div class="progress mini-progress"><span style="width:${pct}%"></span></div>
                </div>
                <div class="row-actions">
                  <button class="secondary-btn small-btn" data-pay-debt="${debt.id}">Pagar</button>
                  <button class="secondary-btn small-btn" data-edit-debt="${debt.id}">Editar</button>
                  <button class="danger-btn small-btn" data-delete-debt="${debt.id}">Eliminar</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderMore() {
  const metrics = reportMetrics();
  const ant = antExpenses();
  return `
    <div class="view ${state.selected.view === "mas" ? "active" : ""}" data-view="mas">
      <section class="card">
        <h2 class="section-title">Importar / Exportar Excel</h2>
        <p class="subtle">El respaldo principal de la app ahora es Excel. Exporta todo y vuelve a importarlo cuando lo necesites.</p>
        <div class="toolbar">
          <button class="secondary-btn" id="exportExcel">Exportar Excel</button>
          <label class="secondary-btn">Importar Excel<input hidden type="file" id="importExcel" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
          <button class="secondary-btn" id="printReport">PDF mensual</button>
        </div>
        <p class="backup-date">Ultimo respaldo: ${state.settings.lastBackupAt ? new Date(state.settings.lastBackupAt).toLocaleString("es-MX") : "sin respaldo"}</p>
      </section>
      <section class="card">
        <div class="card-title"><h2>Reportes</h2><button class="info-dot" data-info="reports" aria-label="Ver informacion">i</button></div>
        <div class="pill-grid">
          <div class="mini-card"><span class="subtle">Mayor gasto</span><strong>${metrics.topExpense ? `${metrics.topExpense.concept} ${money(metrics.topExpense.amount)}` : "Sin datos"}</strong></div>
          <div class="mini-card"><span class="subtle">Dia con mas gasto</span><strong>${metrics.maxDay ? `${metrics.maxDay[0]} ${money(metrics.maxDay[1])}` : "Sin datos"}</strong></div>
          <div class="mini-card"><span class="subtle">Promedio diario</span><strong>${money(metrics.avgDaily)}</strong></div>
          <div class="mini-card"><span class="subtle">Proyeccion cierre</span><strong>${money(metrics.projected)}</strong></div>
        </div>
        <div class="bar-chart">
          <div><span>Ingresos</span><b style="width:${Math.min(100, metrics.monthIncome / Math.max(1, metrics.monthIncome, metrics.monthExpense) * 100)}%"></b><strong>${money(metrics.monthIncome)}</strong></div>
          <div><span>Gastos</span><b style="width:${Math.min(100, metrics.monthExpense / Math.max(1, metrics.monthIncome, metrics.monthExpense) * 100)}%"></b><strong>${money(metrics.monthExpense)}</strong></div>
          <div><span>Ahorro</span><b style="width:${Math.min(100, metrics.savings / Math.max(1, metrics.monthIncome) * 100)}%"></b><strong>${money(metrics.savings)}</strong></div>
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Calendario financiero</h2><button class="info-dot" data-info="calendar" aria-label="Ver informacion">i</button></div>
        <div class="admin-list">
          ${calendarItems().map((item) => `
            <div class="calendar-row">
              <span class="date-chip">${item.date.slice(8, 10)}</span>
              <div><strong>${item.label}</strong><br><span class="subtle">${item.type} · ${item.status}</span></div>
              <strong>${money(item.amount)}</strong>
            </div>
          `).join("") || `<p class="empty">Sin eventos este mes.</p>`}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Herramientas</h2><button class="info-dot" data-info="tools" aria-label="Ver informacion">i</button></div>
        <form class="form-grid compact-form" id="canBuyForm">
          <label class="field"><span>Compra posible</span><input name="concept" placeholder="Audifonos"></label>
          <label class="field"><span>Monto</span><input name="amount" type="number" min="0" step="0.01" placeholder="1000"></label>
          <label class="field"><span>Categoria</span><select name="categoryId">${movementCategories("expense").map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label>
          <button class="secondary-btn">Puedo comprar esto?</button>
        </form>
        <div id="canBuyResult" class="tool-result"></div>
        <form class="form-grid compact-form" id="simulatorForm">
          <label class="field"><span>Escenario</span><select name="type"><option value="extraExpense">Gasto extra</option><option value="extraSaving">Ahorrar mas</option><option value="debtPayment">Pagar deuda</option><option value="reduceExpense">Reducir gasto</option></select></label>
          <label class="field"><span>Monto</span><input name="amount" type="number" min="0" step="0.01" placeholder="500"></label>
          <button class="secondary-btn">Simular cierre</button>
        </form>
        <div id="simulatorResult" class="tool-result"></div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Gasto hormiga</h2><button class="info-dot" data-info="ant" aria-label="Ver informacion">i</button></div>
        <label class="field"><span>Limite para detectar gasto pequeno</span><input type="number" id="antLimitInput" value="${state.settings.antExpenseLimit}" min="1"></label>
        <div class="pill-grid">
          <div class="mini-card"><span class="subtle">Total hormiga</span><strong>${money(ant.total)}</strong></div>
          <div class="mini-card"><span class="subtle">Movimientos</span><strong>${ant.rows.length}</strong></div>
        </div>
        <div class="category-list">
          ${ant.top.map(([name, amount]) => `<div class="category-row"><span class="dot" style="background:#a5acb6">H</span><span>${name}</span><strong>${money(amount)}</strong><span class="subtle"></span></div>`).join("") || `<p class="empty">Sin gasto hormiga detectado.</p>`}
        </div>
      </section>
    </div>
  `;
}

function renderSettings() {
  return `
    <div class="view ${state.selected.view === "config" ? "active" : ""}" data-view="config">
      <section class="card">
        <div class="card-title"><h2>Configuracion</h2><button class="secondary-btn small-btn" id="themeBtn">${state.settings.theme === "dark" ? "Modo claro" : "Modo oscuro"}</button></div>
        <div class="form-grid">
          <label class="field"><span>Moneda</span><input value="${state.settings.currency}" id="currencyInput"></label>
          <label class="field"><span>Aplicar sueldo desde</span><input type="date" value="${state.settings.effectiveFrom || selectedMonthDate()}" id="effectiveFromInput"></label>
          <label class="field"><span>Frecuencia de pago</span><select id="paymentFrequencyInput">
            <option value="biweekly" ${state.settings.paymentFrequency === "biweekly" ? "selected" : ""}>Quincenal</option>
            <option value="weekly" ${state.settings.paymentFrequency === "weekly" ? "selected" : ""}>Semanal</option>
            <option value="monthly" ${state.settings.paymentFrequency === "monthly" ? "selected" : ""}>Mensual</option>
          </select></label>
          <label class="field"><span>Ingreso base por periodo</span><input type="number" min="0" step="0.01" value="${state.settings.baseSalary}" id="salaryInput"></label>
          <p class="subtle field-note">El sueldo y la frecuencia se guardan como perfil historico desde la fecha indicada. Los meses anteriores conservan el perfil que les correspondia.</p>
          <label class="field"><span>Alerta amarilla desde % usado</span><input type="number" min="1" max="100" value="${state.settings.warningLimit}" id="warningLimitInput"></label>
          <label class="field"><span>Alerta roja desde % usado</span><input type="number" min="1" max="200" value="${state.settings.dangerLimit}" id="dangerLimitInput"></label>
          <label class="field"><span>PIN local opcional</span><input type="password" value="${state.settings.pin || ""}" id="pinInput" placeholder="4 digitos"></label>
          <label class="field inline-field"><input type="checkbox" id="showSavingsInput" ${state.settings.showSavingsSummary ? "checked" : ""}><span>Mostrar ahorro mensual</span></label>
          ${state.settings.pin ? `<button class="secondary-btn" id="lockBtn">Bloquear ahora</button>` : ""}
          <button class="danger-btn" id="resetBtn">Borrar datos y volver a demo</button>
        </div>
      </section>
      <section class="card">
        <h2 class="section-title">Historial de sueldo</h2>
        <div class="admin-list">
          ${state.payProfiles.map((profile) => `
            <div class="admin-row">
              <span class="tile">$</span>
              <div><strong>${money(profile.baseSalary)} por ${payFrequencyLabel(profile.paymentFrequency)}</strong><br><span class="subtle">Desde ${profile.effectiveFrom}</span></div>
              <div class="row-actions">
                <button class="secondary-btn small-btn" data-edit-pay-profile="${profile.id}">Editar</button>
                <button class="danger-btn small-btn" data-delete-pay-profile="${profile.id}">Eliminar</button>
              </div>
            </div>
          `).join("") || `<p class="empty">Sin perfiles de sueldo.</p>`}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Categorias</h2><button class="info-dot" data-info="categories" aria-label="Ver informacion">i</button></div>
        <form class="form-grid compact-form" id="categoryForm">
          <label class="field"><span>Nombre</span><input name="name" required placeholder="Comida"></label>
          <label class="field"><span>Tipo</span><select name="type"><option value="expense">Gasto</option><option value="income">Ingreso</option><option value="saving">Ahorro</option><option value="debt">Deuda</option></select></label>
          <label class="field"><span>Color</span><input name="color" type="color" value="#218bd6"></label>
          <label class="field"><span>Inicial</span><input name="icon" maxlength="2" placeholder="C"></label>
          <button class="secondary-btn">Agregar categoria</button>
        </form>
        <div class="admin-list">
          ${state.categories.map((category) => `
            <div class="admin-row">
              <span class="dot" style="background:${category.color}">${category.icon}</span>
              <div><strong>${category.name}</strong><br><span class="subtle">${category.type || "expense"} · ${category.active === false ? "inactiva" : "activa"}</span></div>
              <div class="row-actions">
                <button class="secondary-btn small-btn" data-edit-category="${category.id}">Editar</button>
                <button class="danger-btn small-btn" data-delete-category="${category.id}">Eliminar</button>
              </div>
            </div>
          `).join("")}
        </div>
      </section>
      <section class="card">
        <div class="card-title"><h2>Pagos fijos</h2><button class="info-dot" data-info="fixed" aria-label="Ver informacion">i</button></div>
        <form class="form-grid compact-form" id="fixedForm">
          <label class="field"><span>Nombre</span><input name="name" required placeholder="Internet"></label>
          <label class="field"><span>Monto</span><input name="amount" required type="number" min="0" step="0.01" placeholder="450"></label>
          <label class="field"><span>Dia de pago</span><input name="day" required type="number" min="1" max="31" placeholder="3"></label>
          <label class="field"><span>Categoria</span><select name="categoryId">${movementCategories("expense").map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label>
          <label class="field"><span>Frecuencia</span><select name="frequency"><option value="monthly">Mensual</option><option value="biweekly">Quincenal</option><option value="weekly">Semanal</option></select></label>
          <button class="secondary-btn">Agregar pago fijo</button>
        </form>
        <div class="admin-list">
          ${state.fixedExpenses.map((fx) => {
            const category = categoryById(fx.categoryId);
            return `
              <div class="admin-row">
                <span class="tile" style="background:${category.color}22;color:${category.color}">${category.icon}</span>
                <div><strong>${fx.name}</strong><br><span class="subtle">Dia ${fx.day} · ${money(fx.amount)} · ${fx.active === false ? "inactivo" : "activo"}</span></div>
                <div class="row-actions">
                  <button class="secondary-btn small-btn" data-toggle-fixed="${fx.id}">${fx.paid ? "Pendiente" : "Pagado"}</button>
                  <button class="secondary-btn small-btn" data-edit-fixed="${fx.id}">Editar</button>
                  <button class="danger-btn small-btn" data-delete-fixed="${fx.id}">Eliminar</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderBottomNav() {
  const items = [
    ["home", "Inicio", svgHome()],
    ["gastos", "Gastos", svgPie()],
    ["presupuesto", "Presupuestos", svgWallet()],
    ["ahorros", "Ahorros", svgPig()],
    ["mas", "Mas", svgMore()],
  ];
  return `<nav class="bottom-nav">${items.map(([id, label, icon]) => `<button class="nav-item ${state.selected.view === id ? "active" : ""}" data-nav="${id}">${icon}<span>${label}</span></button>`).join("")}</nav>`;
}

function renderModal() {
  return `
    <div class="modal-backdrop" id="expenseModal">
      <section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
        <div class="modal-header">
          <h2 id="modalTitle">Agregar movimiento</h2>
          <button class="icon-btn" id="closeModal" aria-label="Cerrar">x</button>
        </div>
        <div class="movement-choice" id="movementChoice">
          <button class="choice-card income-choice" data-start-movement="income" type="button">
            <span>+</span>
            <strong>Ingreso</strong>
            <small>Sueldo, bono, reembolso o dinero extra</small>
          </button>
          <button class="choice-card expense-choice" data-start-movement="expense" type="button">
            <span>-</span>
            <strong>Gasto</strong>
            <small>Pago fijo, compra, deuda o gasto variable</small>
          </button>
        </div>
        <form class="form-grid" id="expenseForm">
          <input type="hidden" name="direction" value="${movementDirection}">
          <label class="field"><span>Concepto</span><input name="concept" required placeholder="Sueldo, gasolina, bono"></label>
          <label class="field"><span>Monto</span><input name="amount" required type="number" min="1" step="0.01" placeholder="850"></label>
          <label class="field"><span>Categoria</span><select name="categoryId">${movementCategories(movementDirection).map((c) => `<option value="${c.id}">${c.name}</option>`).join("")}</select></label>
          <label class="field"><span>Fecha</span><input name="date" type="date" value="${defaultMovementDate()}"></label>
          <label class="field"><span>Periodo</span><select name="period">${getPeriods().map((period) => `<option value="${period.id}" ${period.id === state.selected.period ? "selected" : ""}>${period.label}</option>`).join("")}</select></label>
          <label class="field"><span>Notas</span><textarea name="notes" rows="2"></textarea></label>
          <button class="primary-btn" id="movementSubmitBtn">Guardar movimiento</button>
        </form>
      </section>
    </div>
  `;
}

function renderEditorModal() {
  if (!editorState) return "";
  if (editorState.type === "confirm") {
    return `
      <div class="modal-backdrop open editor-backdrop" id="editorBackdrop">
        <section class="modal editor-modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2>${editorState.title}</h2>
            <button class="icon-btn" id="editorCancel" aria-label="Cerrar">x</button>
          </div>
          <p class="subtle">${editorState.message}</p>
          <div class="modal-actions">
            <button class="secondary-btn" id="editorDismiss" type="button">Cancelar</button>
            <button class="danger-btn" id="editorConfirm" type="button">${editorState.confirmLabel || "Confirmar"}</button>
          </div>
        </section>
      </div>
    `;
  }
  if (editorState.type === "notice") {
    return `
      <div class="modal-backdrop open editor-backdrop" id="editorBackdrop">
        <section class="modal editor-modal" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h2>${editorState.title}</h2>
            <button class="icon-btn" id="editorCancel" aria-label="Cerrar">x</button>
          </div>
          <p class="subtle">${editorState.message}</p>
          <div class="modal-actions">
            <button class="primary-btn" id="editorDismiss" type="button">Entendido</button>
          </div>
        </section>
      </div>
    `;
  }
  return `
    <div class="modal-backdrop open editor-backdrop" id="editorBackdrop">
      <section class="modal editor-modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${editorState.title}</h2>
          <button class="icon-btn" id="editorCancel" aria-label="Cerrar">x</button>
        </div>
        <form class="form-grid" id="editorForm">
          ${editorState.fields.map(renderEditorField).join("")}
          <div class="modal-actions">
            <button class="secondary-btn" id="editorDismiss" type="button">Cancelar</button>
            <button class="primary-btn">${editorState.submitLabel || "Guardar"}</button>
          </div>
        </form>
      </section>
    </div>
  `;
}

function renderEditorField(field) {
  if (field.type === "textarea") {
    return `<label class="field"><span>${field.label}</span><textarea name="${field.name}" rows="${field.rows || 3}" ${field.required ? "required" : ""}>${field.value || ""}</textarea></label>`;
  }
  if (field.type === "select") {
    return `<label class="field"><span>${field.label}</span><select name="${field.name}" ${field.required ? "required" : ""}>${field.options.map((option) => {
      const value = Array.isArray(option) ? option[0] : option.value;
      const label = Array.isArray(option) ? option[1] : option.label;
      return `<option value="${value}" ${String(value) === String(field.value) ? "selected" : ""}>${label}</option>`;
    }).join("")}</select></label>`;
  }
  if (field.type === "checkbox") {
    return `<label class="field inline-field"><input type="checkbox" name="${field.name}" ${field.value ? "checked" : ""}><span>${field.label}</span></label>`;
  }
  return `<label class="field"><span>${field.label}</span><input name="${field.name}" type="${field.type || "text"}" value="${field.value ?? ""}" ${field.min !== undefined ? `min="${field.min}"` : ""} ${field.max !== undefined ? `max="${field.max}"` : ""} ${field.step !== undefined ? `step="${field.step}"` : ""} ${field.required ? "required" : ""}></label>`;
}

function bindEvents() {
  document.querySelectorAll("[data-calendar-control='month']").forEach((select) => {
    select.addEventListener("change", (e) => updateSelected("month", Number(e.target.value)));
  });
  document.querySelectorAll("[data-calendar-control='year']").forEach((select) => {
    select.addEventListener("change", (e) => updateSelected("year", Number(e.target.value)));
  });
  document.querySelectorAll("[data-period]").forEach((btn) => btn.addEventListener("click", () => updateSelected("period", btn.dataset.period)));
  document.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => updateSelected("view", btn.dataset.nav)));
  $("#themeBtn")?.addEventListener("click", async () => {
    state.settings.theme = state.settings.theme === "light" ? "dark" : "light";
    await saveAndRender();
  });
  $("#addExpenseBtn")?.addEventListener("click", openMovementChoice);
  $("#closeModal")?.addEventListener("click", closeMovementModal);
  $("#expenseModal")?.addEventListener("click", (e) => {
    if (e.target.id === "expenseModal") closeMovementModal();
  });
  document.querySelectorAll("[data-start-movement]").forEach((btn) => btn.addEventListener("click", () => startMovement(btn.dataset.startMovement)));
  $("#expenseForm")?.addEventListener("submit", onExpenseSubmit);
  $("#categoryForm")?.addEventListener("submit", onCategorySubmit);
  $("#fixedForm")?.addEventListener("submit", onFixedSubmit);
  $("#budgetForm")?.addEventListener("submit", onBudgetSubmit);
  $("#goalForm")?.addEventListener("submit", onGoalSubmit);
  $("#debtForm")?.addEventListener("submit", onDebtSubmit);
  $("#canBuyForm")?.addEventListener("submit", onCanBuySubmit);
  $("#simulatorForm")?.addEventListener("submit", onSimulatorSubmit);
  $("#editorBackdrop")?.addEventListener("click", (e) => {
    if (e.target.id === "editorBackdrop") closeEditor();
  });
  $("#editorCancel")?.addEventListener("click", closeEditor);
  $("#editorDismiss")?.addEventListener("click", closeEditor);
  $("#editorForm")?.addEventListener("submit", onEditorSubmit);
  $("#editorConfirm")?.addEventListener("click", onEditorConfirm);
  $("#exportExcel")?.addEventListener("click", exportExcel);
  $("#importExcel")?.addEventListener("change", importExcel);
  $("#printReport")?.addEventListener("click", () => window.print());
  document.querySelectorAll("[data-info]").forEach((btn) => btn.addEventListener("click", () => showInfo(btn.dataset.info)));
  document.querySelectorAll("[data-edit-category]").forEach((btn) => btn.addEventListener("click", () => editCategory(btn.dataset.editCategory)));
  document.querySelectorAll("[data-delete-category]").forEach((btn) => btn.addEventListener("click", () => deleteCategory(btn.dataset.deleteCategory)));
  document.querySelectorAll("[data-edit-transaction]").forEach((btn) => btn.addEventListener("click", () => editTransaction(btn.dataset.editTransaction)));
  document.querySelectorAll("[data-delete-transaction]").forEach((btn) => btn.addEventListener("click", () => deleteTransaction(btn.dataset.deleteTransaction)));
  document.querySelectorAll("[data-edit-budget]").forEach((btn) => btn.addEventListener("click", () => editBudget(btn.dataset.editBudget)));
  document.querySelectorAll("[data-delete-budget]").forEach((btn) => btn.addEventListener("click", () => deleteBudget(btn.dataset.deleteBudget)));
  document.querySelectorAll("[data-toggle-fixed]").forEach((btn) => btn.addEventListener("click", () => toggleFixed(btn.dataset.toggleFixed)));
  document.querySelectorAll("[data-edit-fixed]").forEach((btn) => btn.addEventListener("click", () => editFixed(btn.dataset.editFixed)));
  document.querySelectorAll("[data-delete-fixed]").forEach((btn) => btn.addEventListener("click", () => deleteFixed(btn.dataset.deleteFixed)));
  document.querySelectorAll("[data-add-goal]").forEach((btn) => btn.addEventListener("click", () => addGoalContribution(btn.dataset.addGoal)));
  document.querySelectorAll("[data-edit-goal]").forEach((btn) => btn.addEventListener("click", () => editGoal(btn.dataset.editGoal)));
  document.querySelectorAll("[data-delete-goal]").forEach((btn) => btn.addEventListener("click", () => deleteGoal(btn.dataset.deleteGoal)));
  document.querySelectorAll("[data-pay-debt]").forEach((btn) => btn.addEventListener("click", () => payDebt(btn.dataset.payDebt)));
  document.querySelectorAll("[data-edit-debt]").forEach((btn) => btn.addEventListener("click", () => editDebt(btn.dataset.editDebt)));
  document.querySelectorAll("[data-delete-debt]").forEach((btn) => btn.addEventListener("click", () => deleteDebt(btn.dataset.deleteDebt)));
  document.querySelectorAll("[data-edit-pay-profile]").forEach((btn) => btn.addEventListener("click", () => editPayProfile(btn.dataset.editPayProfile)));
  document.querySelectorAll("[data-delete-pay-profile]").forEach((btn) => btn.addEventListener("click", () => deletePayProfile(btn.dataset.deletePayProfile)));
  $("#effectiveFromInput")?.addEventListener("change", async (e) => {
    state.settings.effectiveFrom = e.target.value || selectedMonthDate();
    await saveAndRender();
  });
  $("#salaryInput")?.addEventListener("change", async (e) => {
    upsertPayProfile($("#effectiveFromInput")?.value || selectedMonthDate(), Number(e.target.value || 0), $("#paymentFrequencyInput")?.value || state.settings.paymentFrequency);
    await saveAndRender();
  });
  $("#paymentFrequencyInput")?.addEventListener("change", async (e) => {
    upsertPayProfile($("#effectiveFromInput")?.value || selectedMonthDate(), Number($("#salaryInput")?.value || 0), e.target.value);
    if (!getPeriods().some((period) => period.id === state.selected.period)) state.selected.period = getPeriods()[0].id;
    await saveAndRender();
  });
  $("#warningLimitInput")?.addEventListener("change", async (e) => {
    state.settings.warningLimit = Number(e.target.value || 82);
    await saveAndRender();
  });
  $("#dangerLimitInput")?.addEventListener("change", async (e) => {
    state.settings.dangerLimit = Number(e.target.value || 100);
    await saveAndRender();
  });
  $("#antLimitInput")?.addEventListener("change", async (e) => {
    state.settings.antExpenseLimit = Number(e.target.value || 120);
    await saveAndRender();
  });
  $("#pinInput")?.addEventListener("change", async (e) => {
    state.settings.pin = e.target.value.trim();
    state.settings.appLocked = Boolean(state.settings.pin);
    isUnlocked = true;
    await saveAndRender();
  });
  $("#showSavingsInput")?.addEventListener("change", async (e) => {
    state.settings.showSavingsSummary = e.target.checked;
    await saveAndRender();
  });
  $("#editMonthlySavings")?.addEventListener("click", editMonthlySavings);
  $("#hideMonthlySavings")?.addEventListener("click", async () => {
    openConfirm("Ocultar ahorro mensual", "Quitar el bloque de ahorro mensual? Lo puedes volver a mostrar desde Configuracion.", () => {
      state.settings.showSavingsSummary = false;
    });
  });
  $("#lockBtn")?.addEventListener("click", async () => {
    state.settings.appLocked = true;
    isUnlocked = false;
    await saveAndRender();
  });
  $("#currencyInput")?.addEventListener("change", async (e) => {
    state.settings.currency = e.target.value || "MXN";
    await saveAndRender();
  });
  $("#resetBtn")?.addEventListener("click", async () => {
    openConfirm("Restaurar datos demo", "Seguro que quieres borrar los datos actuales y volver a los datos demo?", () => {
      state = structuredClone(demoState);
    }, "Borrar y restaurar");
  });
  $("#seedBtn")?.addEventListener("click", async () => {
    state = structuredClone(demoState);
    await saveAndRender();
  });
}

function openEditor(title, fields, onSave, submitLabel = "Guardar") {
  editorState = { type: "form", title, fields, onSave, submitLabel };
  render();
}

function openConfirm(title, message, onConfirm, confirmLabel = "Confirmar") {
  editorState = { type: "confirm", title, message, onConfirm, confirmLabel };
  render();
}

function openNotice(title, message) {
  editorState = { type: "notice", title, message };
  render();
}

function closeEditor() {
  editorState = null;
  render();
}

async function onEditorSubmit(event) {
  event.preventDefault();
  if (!editorState?.onSave) return;
  const form = event.currentTarget;
  const data = Object.fromEntries(new FormData(form));
  for (const field of editorState.fields || []) {
    if (field.type === "checkbox") data[field.name] = Boolean(form.elements[field.name]?.checked);
  }
  await editorState.onSave(data);
  editorState = null;
  await saveAndRender();
}

async function onEditorConfirm() {
  if (!editorState?.onConfirm) return;
  await editorState.onConfirm();
  editorState = null;
  await saveAndRender();
}

async function updateSelected(key, value) {
  state.selected[key] = value;
  if (key === "month" || key === "year") {
    state.settings.effectiveFrom = selectedMonthDate();
    syncCurrentPayProfile();
  }
  if (!getPeriods().some((period) => period.id === state.selected.period)) {
    state.selected.period = getPeriods()[0].id;
  }
  await saveAndRender();
}

function openMovementChoice() {
  const modal = $("#expenseModal");
  modal?.classList.add("open", "choosing");
  $("#modalTitle").textContent = "Que quieres agregar?";
}

function closeMovementModal() {
  const modal = $("#expenseModal");
  modal?.classList.remove("open", "choosing");
}

function startMovement(direction) {
  movementDirection = direction === "income" ? "income" : "expense";
  const isIncome = movementDirection === "income";
  $("#expenseModal")?.classList.remove("choosing");
  $("#modalTitle").textContent = isIncome ? "Agregar ingreso" : "Agregar gasto";
  const form = $("#expenseForm");
  form.elements.direction.value = movementDirection;
  form.elements.concept.placeholder = isIncome ? "Sueldo, bono, reembolso" : "Gasolina, casa, comida";
  form.elements.amount.placeholder = isIncome ? String(state.settings.baseSalary || 6000) : "850";
  form.elements.categoryId.innerHTML = movementCategories(movementDirection).map((c) => `<option value="${c.id}">${c.name}</option>`).join("");
  form.elements.categoryId.value = isIncome ? "ingresos" : movementCategories("expense")[0]?.id || "otros";
  $("#movementSubmitBtn").textContent = isIncome ? "Guardar ingreso" : "Guardar gasto";
  form.elements.concept.focus();
}

async function onCategorySubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const name = String(data.name || "").trim();
  if (!name) return;
  state.categories.push({
    id: `cat-${crypto.randomUUID()}`,
    name,
    color: data.color || "#218bd6",
    icon: String(data.icon || name[0] || "C").slice(0, 2).toUpperCase(),
    type: data.type || "expense",
    active: true,
  });
  await saveAndRender();
}

async function editCategory(id) {
  const category = categoryById(id);
  if (!category) return;
  openEditor("Editar categoria", [
    { name: "name", label: "Nombre", value: category.name, required: true },
    { name: "type", label: "Tipo", type: "select", value: category.type || "expense", options: [["expense", "Gasto"], ["income", "Ingreso"], ["saving", "Ahorro"], ["debt", "Deuda"]] },
    { name: "color", label: "Color", type: "color", value: category.color || "#218bd6" },
    { name: "icon", label: "Inicial o icono corto", value: category.icon || "" },
    { name: "active", label: "Categoria activa", type: "checkbox", value: category.active !== false },
  ], (data) => {
    category.name = String(data.name || category.name).trim();
    category.type = data.type || "expense";
    category.color = String(data.color || category.color).trim();
    category.icon = String(data.icon || category.name[0] || "C").slice(0, 2).toUpperCase();
    category.active = Boolean(data.active);
  });
}

async function deleteCategory(id) {
  if (state.transactions.some((item) => item.categoryId === id) || state.fixedExpenses.some((item) => item.categoryId === id)) {
    openNotice("Categoria en uso", "No se puede eliminar porque ya tiene movimientos o pagos fijos. Puedes editarla o desactivarla.");
    return;
  }
  openConfirm("Eliminar categoria", "Eliminar esta categoria?", () => {
    state.categories = state.categories.filter((item) => item.id !== id);
  }, "Eliminar");
}

async function editTransaction(id) {
  const item = state.transactions.find((transaction) => transaction.id === id);
  if (!item) return;
  openEditor("Editar movimiento", [
    { name: "concept", label: "Concepto", value: item.concept, required: true },
    { name: "amount", label: "Monto", type: "number", min: 0, step: "0.01", value: item.amount, required: true },
    { name: "direction", label: "Tipo", type: "select", value: item.direction, options: [["income", "Ingreso"], ["expense", "Gasto"]] },
    { name: "categoryId", label: "Categoria", type: "select", value: item.categoryId, options: state.categories.map((category) => [category.id, category.name]) },
    { name: "date", label: "Fecha", type: "date", value: item.date || defaultMovementDate() },
    { name: "period", label: "Periodo", type: "select", value: item.period || state.selected.period, options: getPeriods(item.date || defaultMovementDate()).map((period) => [period.id, period.label]) },
    { name: "status", label: "Estado", type: "select", value: item.status || "paid", options: [["paid", "Pagado"], ["pending", "Pendiente"], ["cancelled", "Cancelado"]] },
    { name: "type", label: "Clase", type: "select", value: item.type || item.direction, options: [["income", "Ingreso"], ["fixed", "Fijo"], ["variable", "Variable"], ["saving", "Ahorro"], ["debt", "Deuda"], ["extra", "Extra"], ["emergency", "Emergencia"]] },
    { name: "paymentMethod", label: "Metodo de pago", type: "select", value: item.paymentMethod || "debito", options: [["efectivo", "Efectivo"], ["debito", "Tarjeta debito"], ["credito", "Tarjeta credito"], ["transferencia", "Transferencia"], ["otro", "Otro"]] },
    { name: "notes", label: "Notas", type: "textarea", value: item.notes || "" },
  ], (data) => {
    item.concept = String(data.concept || item.concept).trim();
    item.amount = Math.max(0, Number(data.amount || 0));
    item.direction = data.direction || item.direction;
    item.categoryId = data.categoryId || item.categoryId;
    item.date = data.date || item.date;
    item.period = data.period || item.period;
    item.status = data.status || "paid";
    item.type = data.type || item.direction;
    item.paymentMethod = data.paymentMethod || "debito";
    item.notes = data.notes || "";
    item.updatedAt = new Date().toISOString();
  });
}

async function deleteTransaction(id) {
  openConfirm("Eliminar movimiento", "Eliminar este movimiento?", () => {
    state.transactions = state.transactions.filter((item) => item.id !== id);
  }, "Eliminar");
}

async function onFixedSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.fixedExpenses.push({
    id: `fx-${crypto.randomUUID()}`,
    name: String(data.name || "").trim(),
    amount: Number(data.amount || 0),
    day: Number(data.day || 1),
    categoryId: data.categoryId,
    frequency: data.frequency || "monthly",
    active: true,
    paid: false,
  });
  await saveAndRender();
}

async function toggleFixed(id) {
  const item = state.fixedExpenses.find((fixed) => fixed.id === id);
  if (!item) return;
  item.paid = !item.paid;
  await saveAndRender();
}

async function editFixed(id) {
  const item = state.fixedExpenses.find((fixed) => fixed.id === id);
  if (!item) return;
  openEditor("Editar pago fijo", [
    { name: "name", label: "Nombre", value: item.name, required: true },
    { name: "amount", label: "Monto", type: "number", min: 0, step: "0.01", value: item.amount, required: true },
    { name: "day", label: "Dia de pago", type: "number", min: 1, max: 31, value: item.day || 1, required: true },
    { name: "categoryId", label: "Categoria", type: "select", value: item.categoryId, options: movementCategories("expense").map((category) => [category.id, category.name]) },
    { name: "frequency", label: "Frecuencia", type: "select", value: item.frequency || "monthly", options: [["monthly", "Mensual"], ["biweekly", "Quincenal"], ["weekly", "Semanal"]] },
    { name: "active", label: "Pago activo", type: "checkbox", value: item.active !== false },
    { name: "paid", label: "Pagado en el periodo", type: "checkbox", value: item.paid === true },
    { name: "notes", label: "Notas", type: "textarea", value: item.notes || "" },
  ], (data) => {
    item.name = String(data.name || item.name).trim();
    item.amount = Number(data.amount || 0);
    item.day = Math.max(1, Math.min(31, Number(data.day || 1)));
    item.categoryId = data.categoryId || item.categoryId;
    item.frequency = data.frequency || "monthly";
    item.active = Boolean(data.active);
    item.paid = Boolean(data.paid);
    item.notes = data.notes || "";
  });
}

async function deleteFixed(id) {
  openConfirm("Eliminar pago fijo", "Eliminar este pago fijo?", () => {
    state.fixedExpenses = state.fixedExpenses.filter((item) => item.id !== id);
  }, "Eliminar");
}

async function onBudgetSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const existing = state.budgets.find((budget) => Number(budget.year) === Number(state.selected.year) && Number(budget.month) === Number(state.selected.month) && budget.categoryId === data.categoryId);
  if (existing) {
    existing.amount = Number(data.amount || 0);
  } else {
    state.budgets.push({ id: `budget-${crypto.randomUUID()}`, year: state.selected.year, month: state.selected.month, categoryId: data.categoryId, amount: Number(data.amount || 0) });
  }
  await saveAndRender();
}

async function editBudget(id) {
  const existing = state.budgets.find((budget) => budget.id === id);
  const fromCategory = existing || { id: `budget-${crypto.randomUUID()}`, year: state.selected.year, month: state.selected.month, categoryId: id, amount: 0 };
  openEditor("Editar limite", [
    { name: "categoryId", label: "Categoria", type: "select", value: fromCategory.categoryId, options: movementCategories("expense").map((category) => [category.id, category.name]) },
    { name: "amount", label: "Limite mensual", type: "number", min: 0, step: "0.01", value: fromCategory.amount || 0 },
    { name: "year", label: "Anio", type: "number", min: 2020, max: 2100, value: fromCategory.year || state.selected.year },
    { name: "month", label: "Mes", type: "select", value: fromCategory.month ?? state.selected.month, options: months.map((month, index) => [index, month]) },
  ], (data) => {
    fromCategory.categoryId = data.categoryId;
    fromCategory.amount = Number(data.amount || 0);
    fromCategory.year = Number(data.year || state.selected.year);
    fromCategory.month = Number(data.month ?? state.selected.month);
    if (!existing) state.budgets.push(fromCategory);
  });
}

async function deleteBudget(id) {
  openConfirm("Eliminar limite", "Eliminar este limite de categoria?", () => {
    state.budgets = state.budgets.filter((budget) => budget.id !== id);
  }, "Eliminar");
}

async function editMonthlySavings() {
  openEditor("Editar ahorro mensual", [
    { name: "target", label: "Meta mensual de ahorro", type: "number", min: 0, step: "0.01", value: state.settings.monthlySavingsTarget || 0 },
    { name: "amount", label: "Ahorro destinado este mes", type: "number", min: 0, step: "0.01", value: totals().savings || 0 },
  ], (data) => {
    const target = Math.max(0, Number(data.target || 0));
    const amount = Math.max(0, Number(data.amount || 0));
    state.settings.monthlySavingsTarget = target;
    const existing = currentTransactions().find((item) => item.categoryId === "ahorro" && item.type === "saving" && item.concept === "Ahorro mensual");
    if (amount > 0 && existing) {
      existing.amount = amount;
      existing.date = defaultMovementDate();
      existing.period = state.selected.period;
      existing.updatedAt = new Date().toISOString();
    } else if (amount > 0) {
      state.transactions.push(tx("Ahorro mensual", amount, "expense", defaultMovementDate(), "ahorro", state.selected.period, "paid", "saving"));
    } else if (existing) {
      state.transactions = state.transactions.filter((item) => item.id !== existing.id);
    }
  });
}

async function onGoalSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.savingGoals.push({
    id: `goal-${crypto.randomUUID()}`,
    name: String(data.name || "").trim(),
    targetAmount: Number(data.targetAmount || 0),
    currentAmount: Number(data.currentAmount || 0),
    targetDate: data.targetDate || `${state.selected.year}-12-31`,
    categoryId: "ahorro",
    status: "active",
    notes: "",
  });
  await saveAndRender();
}

async function addGoalContribution(id) {
  const goal = state.savingGoals.find((item) => item.id === id);
  if (!goal) return;
  openEditor("Aportar a meta", [
    { name: "amount", label: "Monto de aportacion", type: "number", min: 0, step: "0.01", value: 500, required: true },
  ], (data) => {
    const amount = Number(data.amount || 0);
    if (!amount) return;
    goal.currentAmount = Number(goal.currentAmount || 0) + amount;
    state.transactions.push(tx(`Ahorro: ${goal.name}`, amount, "expense", defaultMovementDate(), "ahorro", state.selected.period, "paid", "saving"));
  }, "Aportar");
}

async function editGoal(id) {
  const goal = state.savingGoals.find((item) => item.id === id);
  if (!goal) return;
  openEditor("Editar meta", [
    { name: "name", label: "Nombre", value: goal.name, required: true },
    { name: "targetAmount", label: "Monto objetivo", type: "number", min: 0, step: "0.01", value: goal.targetAmount || 0 },
    { name: "currentAmount", label: "Monto actual", type: "number", min: 0, step: "0.01", value: goal.currentAmount || 0 },
    { name: "targetDate", label: "Fecha objetivo", type: "date", value: goal.targetDate || defaultMovementDate() },
    { name: "categoryId", label: "Categoria", type: "select", value: goal.categoryId || "ahorro", options: state.categories.map((category) => [category.id, category.name]) },
    { name: "status", label: "Estado", type: "select", value: goal.status || "active", options: [["active", "Activa"], ["paused", "Pausada"], ["done", "Completada"]] },
    { name: "notes", label: "Notas", type: "textarea", value: goal.notes || "" },
  ], (data) => {
    goal.name = String(data.name || goal.name).trim();
    goal.targetAmount = Number(data.targetAmount || 0);
    goal.currentAmount = Number(data.currentAmount || 0);
    goal.targetDate = data.targetDate || goal.targetDate;
    goal.categoryId = data.categoryId || "ahorro";
    goal.status = data.status || "active";
    goal.notes = data.notes || "";
  });
}

async function deleteGoal(id) {
  openConfirm("Eliminar meta", "Eliminar esta meta?", () => {
    state.savingGoals = state.savingGoals.filter((item) => item.id !== id);
  }, "Eliminar");
}

async function onDebtSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  state.debts.push({
    id: `debt-${crypto.randomUUID()}`,
    name: String(data.name || "").trim(),
    totalAmount: Number(data.totalAmount || 0),
    paidAmount: Number(data.paidAmount || 0),
    startDate: defaultMovementDate(),
    dueDate: data.dueDate || "",
    minimumPayment: Number(data.minimumPayment || 0),
    frequency: "monthly",
    status: "active",
    notes: "",
  });
  await saveAndRender();
}

async function payDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  openEditor("Registrar pago", [
    { name: "amount", label: "Monto del pago", type: "number", min: 0, step: "0.01", value: debt.minimumPayment || 500, required: true },
    { name: "date", label: "Fecha", type: "date", value: defaultMovementDate() },
    { name: "notes", label: "Notas", type: "textarea", value: "" },
  ], (data) => {
    const amount = Number(data.amount || 0);
    if (!amount) return;
    state.debtPayments.push({ id: `dp-${crypto.randomUUID()}`, debtId: id, date: data.date || defaultMovementDate(), amount, notes: data.notes || "" });
    state.transactions.push(tx(`Pago deuda: ${debt.name}`, amount, "expense", data.date || defaultMovementDate(), "carro", state.selected.period, "paid", "debt"));
    debt.paidAmount = Number(debt.paidAmount || 0) + amount;
    if (debtBalance(debt).pending <= 0) debt.status = "paid";
  }, "Registrar pago");
}

async function editDebt(id) {
  const debt = state.debts.find((item) => item.id === id);
  if (!debt) return;
  openEditor("Editar deuda", [
    { name: "name", label: "Nombre", value: debt.name, required: true },
    { name: "totalAmount", label: "Monto total", type: "number", min: 0, step: "0.01", value: debt.totalAmount || 0 },
    { name: "paidAmount", label: "Monto pagado", type: "number", min: 0, step: "0.01", value: debt.paidAmount || 0 },
    { name: "startDate", label: "Fecha inicio", type: "date", value: debt.startDate || defaultMovementDate() },
    { name: "dueDate", label: "Fecha limite", type: "date", value: debt.dueDate || "" },
    { name: "minimumPayment", label: "Pago minimo", type: "number", min: 0, step: "0.01", value: debt.minimumPayment || 0 },
    { name: "frequency", label: "Frecuencia", type: "select", value: debt.frequency || "monthly", options: [["weekly", "Semanal"], ["biweekly", "Quincenal"], ["monthly", "Mensual"], ["single", "Unico"]] },
    { name: "status", label: "Estado", type: "select", value: debt.status || "active", options: [["active", "Activa"], ["paused", "Pausada"], ["paid", "Liquidada"]] },
    { name: "notes", label: "Notas", type: "textarea", value: debt.notes || "" },
  ], (data) => {
    debt.name = String(data.name || debt.name).trim();
    debt.totalAmount = Number(data.totalAmount || 0);
    debt.paidAmount = Number(data.paidAmount || 0);
    debt.startDate = data.startDate || debt.startDate || defaultMovementDate();
    debt.dueDate = data.dueDate || "";
    debt.minimumPayment = Number(data.minimumPayment || 0);
    debt.frequency = data.frequency || "monthly";
    debt.status = data.status || "active";
    debt.notes = data.notes || "";
  });
}

async function deleteDebt(id) {
  openConfirm("Eliminar deuda", "Eliminar esta deuda y sus pagos?", () => {
    state.debts = state.debts.filter((item) => item.id !== id);
    state.debtPayments = state.debtPayments.filter((item) => item.debtId !== id);
  }, "Eliminar");
}

async function editPayProfile(id) {
  const profile = state.payProfiles.find((item) => item.id === id);
  if (!profile) return;
  openEditor("Editar sueldo historico", [
    { name: "effectiveFrom", label: "Aplica desde", type: "date", value: profile.effectiveFrom || selectedMonthDate(), required: true },
    { name: "baseSalary", label: "Ingreso por periodo", type: "number", min: 0, step: "0.01", value: profile.baseSalary || 0 },
    { name: "paymentFrequency", label: "Periodo de pago", type: "select", value: profile.paymentFrequency || "biweekly", options: [["biweekly", "Quincenal"], ["weekly", "Semanal"], ["monthly", "Mensual"]] },
  ], (data) => {
    profile.effectiveFrom = data.effectiveFrom || profile.effectiveFrom || selectedMonthDate();
    profile.baseSalary = Number(data.baseSalary || 0);
    profile.paymentFrequency = data.paymentFrequency || "biweekly";
    state.payProfiles.sort((a, b) => String(a.effectiveFrom).localeCompare(String(b.effectiveFrom)));
    syncCurrentPayProfile();
    if (!getPeriods().some((period) => period.id === state.selected.period)) state.selected.period = getPeriods()[0].id;
  });
}

async function deletePayProfile(id) {
  if (state.payProfiles.length <= 1) {
    openNotice("Perfil requerido", "Necesitas al menos un perfil de sueldo para calcular tus periodos.");
    return;
  }
  openConfirm("Eliminar sueldo historico", "Eliminar este perfil de sueldo? Los periodos que dependan de el usaran el perfil anterior disponible.", () => {
    state.payProfiles = state.payProfiles.filter((item) => item.id !== id);
    syncCurrentPayProfile();
    if (!getPeriods().some((period) => period.id === state.selected.period)) state.selected.period = getPeriods()[0].id;
  }, "Eliminar");
}

function onCanBuySubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const amount = Number(data.amount || 0);
  const t = totals();
  const row = budgetRows().find((budget) => budget.id === data.categoryId);
  const after = t.available - amount;
  const fixedPending = state.fixedExpenses.filter((item) => item.active && !item.paid).reduce((sum, item) => sum + Number(item.amount), 0);
  const exceedsBudget = row?.assigned ? row.spent + amount > row.assigned : false;
  const status = after < fixedPending || exceedsBudget ? "No recomendable" : after < fixedPending + 500 ? "Compra con cuidado" : "Compra segura";
  $("#canBuyResult").innerHTML = `<strong>${status}</strong><br><span class="subtle">Disponible despues: ${money(after)}. Pagos fijos pendientes: ${money(fixedPending)}. ${exceedsBudget ? "Excede presupuesto de categoria." : "No excede presupuesto registrado."}</span>`;
}

function onSimulatorSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const amount = Number(data.amount || 0);
  const base = totals().monthAvailable;
  const multiplier = data.type === "extraSaving" || data.type === "extraExpense" || data.type === "debtPayment" ? -1 : 1;
  const projected = base + amount * multiplier;
  $("#simulatorResult").innerHTML = `<strong>Cierre simulado: ${money(projected)}</strong><br><span class="subtle">Este escenario no modifica tus datos reales hasta que registres el movimiento.</span>`;
}

function showInfo(kind) {
  const t = totals();
  const messages = {
    balance: `Disponible = ingresos menos gastos del periodo seleccionado. Ahora usaste ${t.usedPct}% de tus ingresos de este periodo.`,
    health: `Semaforo configurable: verde debajo de ${state.settings.warningLimit}%, amarillo desde ${state.settings.warningLimit}% y rojo desde ${state.settings.dangerLimit}% del ingreso usado.`,
    categories: "Las categorias alimentan la grafica del dashboard. Si agregas un gasto con una categoria, la dona se recalcula automaticamente.",
    fixed: "Los pagos fijos sirven para recordar compromisos recurrentes. Puedes marcarlos como pagados, editarlos o eliminarlos.",
    goals: "Las metas calculan avance, monto faltante y aportacion sugerida mensual.",
    debts: "Las deudas registran saldo pendiente, pagos parciales y estado liquidado.",
    reports: "Los reportes usan tus movimientos del mes para top gastos, promedio diario y proyeccion de cierre.",
    calendar: "El calendario mezcla ingresos, movimientos, pagos fijos y vencimientos de deuda.",
    tools: "Las herramientas simulan escenarios sin cambiar datos reales y evalúan si una compra afecta tu disponible.",
    ant: `Gasto hormiga = gastos menores o iguales a ${money(state.settings.antExpenseLimit)} en el mes seleccionado.`,
  };
  openNotice("Informacion", messages[kind] || "Informacion no disponible.");
}

async function saveAndRender() {
  await saveState();
  render();
}

async function onExpenseSubmit(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  const direction = data.direction === "income" ? "income" : "expense";
  const categoryId = data.categoryId || (direction === "income" ? "ingresos" : "otros");
  state.transactions.push({
    ...tx(data.concept, Number(data.amount), direction, data.date || defaultMovementDate(), categoryId, data.period || state.selected.period, "paid", direction === "income" ? "income" : "variable"),
    notes: data.notes,
  });
  closeMovementModal();
  await saveAndRender();
}

function download(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportExcel() {
  state.settings.lastBackupAt = new Date().toISOString();
  saveState();
  const sheets = {
    Movimientos: [
      ["id", "date", "concept", "amount", "direction", "categoryId", "category", "period", "status", "type", "paymentMethod", "notes"],
      ...state.transactions.map((t) => [t.id, t.date, t.concept, t.amount, t.direction, t.categoryId, categoryById(t.categoryId).name, t.period, t.status, t.type, t.paymentMethod, t.notes]),
    ],
    Categorias: [
      ["id", "name", "type", "color", "icon", "active"],
      ...state.categories.map((c) => [c.id, c.name, c.type, c.color, c.icon, c.active]),
    ],
    PagosFijos: [
      ["id", "name", "amount", "day", "categoryId", "active", "paid"],
      ...state.fixedExpenses.map((fx) => [fx.id, fx.name, fx.amount, fx.day, fx.categoryId, fx.active, fx.paid]),
    ],
    Presupuestos: [
      ["id", "year", "month", "categoryId", "amount"],
      ...state.budgets.map((b) => [b.id, b.year, b.month, b.categoryId, b.amount]),
    ],
    Metas: [
      ["id", "name", "targetAmount", "currentAmount", "targetDate", "categoryId", "status", "notes"],
      ...state.savingGoals.map((g) => [g.id, g.name, g.targetAmount, g.currentAmount, g.targetDate, g.categoryId, g.status, g.notes]),
    ],
    Deudas: [
      ["id", "name", "totalAmount", "paidAmount", "startDate", "dueDate", "minimumPayment", "frequency", "status", "notes"],
      ...state.debts.map((d) => [d.id, d.name, d.totalAmount, d.paidAmount, d.startDate, d.dueDate, d.minimumPayment, d.frequency, d.status, d.notes]),
    ],
    PagosDeuda: [
      ["id", "debtId", "date", "amount", "notes"],
      ...state.debtPayments.map((p) => [p.id, p.debtId, p.date, p.amount, p.notes]),
    ],
    SueldoHistorico: [
      ["id", "effectiveFrom", "baseSalary", "paymentFrequency"],
      ...state.payProfiles.map((p) => [p.id, p.effectiveFrom, p.baseSalary, p.paymentFrequency]),
    ],
    Config: [
      ["key", "value"],
      ...Object.entries(state.settings).map(([key, value]) => [key, value]),
    ],
  };
  const xlsx = buildXlsxWorkbook(sheets);
  const url = URL.createObjectURL(xlsx);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pocket-ledger-respaldo-${Date.now()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
  render();
}

async function importExcel(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const sheets = await readXlsxWorkbook(file);
    if (!sheets.Movimientos && sheets.GASTOS) {
      const imported = importLegacyGastosSheet(sheets.GASTOS);
      if (!imported.length) throw new Error("Sin movimientos");
      openConfirm("Importar Excel anterior", `Detecte ${imported.length} movimientos de tu Excel anterior. Quieres agregarlos a Pocket Ledger?`, () => {
        state.transactions.push(...imported);
        ensureStateDefaults();
      }, "Importar");
      return;
    }
    if (!sheets.Movimientos && !sheets.Categorias) throw new Error("Formato no reconocido");
    state.transactions = rowsToObjects(sheets.Movimientos || []).map((row) => ({ ...row, amount: Number(row.amount || 0) }));
    state.categories = rowsToObjects(sheets.Categorias || []).map((row) => ({ ...row, active: parseBool(row.active) }));
    state.fixedExpenses = rowsToObjects(sheets.PagosFijos || []).map((row) => ({ ...row, amount: Number(row.amount || 0), day: Number(row.day || 1), active: parseBool(row.active), paid: parseBool(row.paid) }));
    state.budgets = rowsToObjects(sheets.Presupuestos || []).map((row) => ({ ...row, year: Number(row.year), month: Number(row.month), amount: Number(row.amount || 0) }));
    state.savingGoals = rowsToObjects(sheets.Metas || []).map((row) => ({ ...row, targetAmount: Number(row.targetAmount || 0), currentAmount: Number(row.currentAmount || 0) }));
    state.debts = rowsToObjects(sheets.Deudas || []).map((row) => ({ ...row, totalAmount: Number(row.totalAmount || 0), paidAmount: Number(row.paidAmount || 0), minimumPayment: Number(row.minimumPayment || 0) }));
    state.debtPayments = rowsToObjects(sheets.PagosDeuda || []).map((row) => ({ ...row, amount: Number(row.amount || 0) }));
    state.payProfiles = rowsToObjects(sheets.SueldoHistorico || []).map((row) => ({ ...row, baseSalary: Number(row.baseSalary || 0) }));
    const config = rowsToObjects(sheets.Config || []);
    for (const item of config) state.settings[item.key] = normalizeConfigValue(item.key, item.value);
    ensureStateDefaults();
    await saveAndRender();
  } catch {
    openNotice("Excel no importado", "No pude importar ese Excel. Usa un respaldo exportado desde Pocket Ledger o tu archivo GASTOS.xlsx.");
  }
}

function svgHome() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/></svg>`;
}

function svgPie() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v9h9"/><path d="M21 12a9 9 0 1 1-9-9"/></svg>`;
}

function svgWallet() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h15a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12"/><path d="M17 13h.01"/></svg>`;
}

function svgPig() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 7 0 0 1 7-5h4a5 5 0 0 1 5 5v1h-2v3h-3l-1.5 3h-6L7 15H4v-4z"/><path d="M9 8V5h4"/><path d="M17 10h.01"/></svg>`;
}

function svgMore() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>`;
}

function svgCloudOff() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M10 5a7 7 0 0 1 9 6 4 4 0 0 1 1 7h-3"/><path d="M8 18H7a5 5 0 0 1-.5-10"/></svg>`;
}

function svgSettings() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.9.3 1.7 1.7 0 0 0-.8 1.7V22H9v-.3a1.7 1.7 0 0 0-.8-1.7 1.7 1.7 0 0 0-1.9-.3l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 13.9H2v-3.8h1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.9-.3A1.7 1.7 0 0 0 9 1.7V1h6v.7a1.7 1.7 0 0 0 .8 1.7 1.7 1.7 0 0 0 1.9.3l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1.1h1v3.8h-1a1.7 1.7 0 0 0-1.6 1.1z"/></svg>`;
}

function svgCalendar() {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4M16 2v4M3 10h18"/><rect x="3" y="4" width="18" height="18" rx="2"/></svg>`;
}

function buildXlsxWorkbook(sheets) {
  const sheetNames = Object.keys(sheets);
  const contentTypes = sheetNames.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("");
  const workbookSheets = sheetNames.map((name, index) => `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const workbookRels = sheetNames.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const files = {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${contentTypes}</Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${workbookRels}</Relationships>`,
  };
  sheetNames.forEach((name, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = sheetXml(sheets[name]);
  });
  return new Blob([zipStore(files)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function sheetXml(rows) {
  const sheetData = rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => {
      const ref = `${columnName(colIndex + 1)}${rowIndex + 1}`;
      if (typeof value === "number") return `<c r="${ref}"><v>${value}</v></c>`;
      if (typeof value === "boolean") return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetData}</sheetData></worksheet>`;
}

async function readXlsxWorkbook(file) {
  const files = await unzipFiles(await file.arrayBuffer());
  const workbook = decodeText(files["xl/workbook.xml"]);
  const relsXml = files["xl/_rels/workbook.xml.rels"] ? decodeText(files["xl/_rels/workbook.xml.rels"]) : "";
  const rels = Object.fromEntries([...relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].map((match) => {
    const cleanTarget = match[2].replace(/^\//, "").replace(/^\.\.\//, "");
    const target = cleanTarget.startsWith("xl/") ? cleanTarget : `xl/${cleanTarget}`;
    return [match[1], target];
  }));
  const sharedStrings = parseSharedStrings(files["xl/sharedStrings.xml"]);
  const names = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((match, index) => {
    const attrs = match[1];
    const name = unescapeXml(attrs.match(/name="([^"]+)"/)?.[1] || `Hoja ${index + 1}`);
    const id = Number(attrs.match(/sheetId="(\d+)"/)?.[1] || index + 1);
    const relId = attrs.match(/r:id="([^"]+)"/)?.[1];
    return { name, id, path: rels[relId] || `xl/worksheets/sheet${id}.xml` };
  });
  const result = {};
  for (const sheet of names) {
    const xml = decodeText(files[sheet.path]);
    result[sheet.name] = parseSheetRows(xml, sharedStrings);
  }
  return result;
}

function parseSharedStrings(data) {
  if (!data) return [];
  const xml = decodeText(data);
  return [...xml.matchAll(/<si[^>]*>([\s\S]*?)<\/si>/g)].map((match) => {
    return [...match[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((part) => unescapeXml(part[1])).join("");
  });
}

async function unzipFiles(buffer) {
  const bytes = new Uint8Array(buffer);
  const files = {};
  let offset = 0;
  while (offset < bytes.length - 4) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const signature = view.getUint32(0, true);
    if (signature !== 0x04034b50) break;
    const method = view.getUint16(8, true);
    const compressedSize = view.getUint32(18, true);
    const fileNameLength = view.getUint16(26, true);
    const extraLength = view.getUint16(28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = decodeText(bytes.slice(nameStart, nameStart + fileNameLength));
    const data = bytes.slice(dataStart, dataStart + compressedSize);
    files[name] = method === 0 ? data : await inflateZipData(data);
    offset = dataStart + compressedSize;
  }
  return files;
}

async function inflateZipData(data) {
  if (!("DecompressionStream" in window)) throw new Error("No decompressor");
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function parseSheetRows(xml, sharedStrings = []) {
  const rows = [];
  for (const rowMatch of xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/r="([A-Z]+)(\d+)"/)?.[1] || "A";
      const index = columnIndex(ref) - 1;
      let value = "";
      if (attrs.includes('t="inlineStr"')) value = unescapeXml(body.match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1] || "");
      else if (attrs.includes('t="s"')) value = sharedStrings[Number(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || 0)] || "";
      else if (attrs.includes('t="str"')) value = unescapeXml(body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "");
      else value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1] || "";
      cells[index] = value;
    }
    rows.push(cells.map((cell) => cell ?? ""));
  }
  return rows;
}

function importLegacyGastosSheet(rows) {
  const year = Number(state.selected.year) || new Date().getFullYear();
  const monthByName = Object.fromEntries(months.map((name, index) => [normalizeText(name), index]));
  const imported = [];
  const seen = new Set();
  rows.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const month = monthByName[normalizeText(cell)];
      if (month === undefined) return;
      const key = `${month}-${colIndex}`;
      if (seen.has(key)) return;
      seen.add(key);
      for (let r = rowIndex + 1; r < Math.min(rows.length, rowIndex + 24); r += 1) {
        const concept = String(rows[r]?.[colIndex] || "").trim();
        const amount = parseAmount(rows[r]?.[colIndex + 1]);
        if (!concept || !amount || isLegacySummary(concept)) continue;
        const period = inferLegacyPeriod(r - rowIndex);
        const day = period === "first" ? "05" : "20";
        imported.push(tx(concept, amount, "expense", `${year}-${String(month + 1).padStart(2, "0")}-${day}`, inferCategoryId(concept), period, "paid", inferExpenseType(concept)));
      }
    });
  });
  return imported;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function parseAmount(value) {
  if (typeof value === "number") return value;
  const normalized = String(value || "").replace(/[$,\s]/g, "");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function isLegacySummary(concept) {
  const text = normalizeText(concept);
  return text.startsWith("sobrara") || text === "gastado" || text === "gastos";
}

function inferLegacyPeriod(rowOffset) {
  return rowOffset <= 8 ? "first" : "second";
}

function inferCategoryId(concept) {
  const text = normalizeText(concept);
  const rules = [
    ["gasolina", "gasolina"],
    ["casa", "casa"],
    ["mama", "casa"],
    ["celular", "otros"],
    ["saldo", "otros"],
    ["chat", "chat"],
    ["tablet", "laptop"],
    ["audifonos", "otros"],
    ["xbox", "otros"],
    ["creatina", "otros"],
    ["laptop", "laptop"],
    ["carro", "carro"],
    ["kody", "otros"],
    ["ahorro", "ahorro"],
    ["viaje", "ahorro"],
    ["presto", "carro"],
  ];
  return rules.find(([term]) => text.includes(term))?.[1] || "otros";
}

function inferExpenseType(concept) {
  const text = normalizeText(concept);
  if (text.includes("ahorro") || text.includes("viaje")) return "saving";
  if (text.includes("carro") || text.includes("laptop") || text.includes("presto")) return "debt";
  if (["celular", "saldo", "gasolina", "casa", "chat", "tablet", "seguro"].some((term) => text.includes(term))) return "fixed";
  return "variable";
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((row) => row.some((cell) => cell !== "")).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

function parseBool(value) {
  return value === true || value === "true" || value === "1" || value === 1;
}

function normalizeConfigValue(key, value) {
  if (["baseSalary", "warningLimit", "dangerLimit", "antExpenseLimit", "monthlySavingsTarget"].includes(key)) return Number(value || 0);
  if (["appLocked", "showSavingsSummary"].includes(key)) return parseBool(value);
  return value;
}

function columnName(index) {
  let name = "";
  while (index > 0) {
    const rem = (index - 1) % 26;
    name = String.fromCharCode(65 + rem) + name;
    index = Math.floor((index - 1) / 26);
  }
  return name;
}

function columnIndex(name) {
  return name.split("").reduce((sum, char) => sum * 26 + char.charCodeAt(0) - 64, 0);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function unescapeXml(value) {
  return String(value ?? "")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(content);
    const crc = crc32(data);
    const local = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, data.length, true);
    view.setUint32(22, data.length, true);
    view.setUint16(26, nameBytes.length, true);
    local.set(nameBytes, 30);
    chunks.push(local, data);

    const centralFile = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralFile.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);
    centralFile.set(nameBytes, 46);
    central.push(centralFile);
    offset += local.length + data.length;
  }
  const centralOffset = offset;
  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length, true);
  ev.setUint16(10, central.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, centralOffset, true);
  return new Blob([...chunks, ...central, end]);
}

function crc32(data) {
  let crc = -1;
  for (let i = 0; i < data.length; i += 1) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let c = index;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

init();

async function init() {
  await loadState();
  ensureStateDefaults();
  render();
  setInterval(() => {
    const activeTag = document.activeElement?.tagName;
    const isEditing = ["INPUT", "SELECT", "TEXTAREA"].includes(activeTag);
    if (!document.hidden && !isEditing && !document.querySelector(".modal-backdrop.open")) render();
  }, 60000);
  setupServiceWorker();
}

async function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    if (isDevelopmentHost()) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith("pocket-ledger")).map((key) => caches.delete(key)));
      }
      return;
    }

    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}service-worker.js`, {
      scope: import.meta.env.BASE_URL,
      updateViaCache: "none",
    });

    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }

    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          worker.postMessage({ type: "SKIP_WAITING" });
        }
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  } catch {
    // The app still works online/local if the browser blocks PWA registration.
  }
}

function isDevelopmentHost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

