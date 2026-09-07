(() => {
  const STORAGE_KEY = "sumon-persistent-agent-v2";

  const launcher = document.getElementById("agentLauncher");
  const panel = document.getElementById("agentPanel");
  const closeBtn = document.getElementById("agentClose");
  const form = document.getElementById("agentForm");
  const input = document.getElementById("agentInput");
  const messagesEl = document.getElementById("agentMessages");
  const agentFigure = document.getElementById("agentFigure");
  const agentStatus = document.getElementById("agentStatus");
  const openChatBtn = document.getElementById("openAgentBtn");
  const clearMemoryBtn = document.getElementById("clearAgentMemoryBtn");
  const missionBoard = document.getElementById("missionBoard");
  const focusHud = document.getElementById("focusHud");

  const IDEAS = [
    "Ship one tiny win before lunch.",
    "Text someone you appreciate — 20 seconds.",
    "Clear one tab pile; keep only what you need.",
    "Drink water, stretch for 60 seconds.",
    "Write tomorrow's top 3 before you sleep.",
    "Turn a vague goal into a 15-minute next step.",
    "Archive one old photo dump into a named album.",
    "Practice a skill for 10 focused minutes.",
  ];

  const BREATH_STEPS = [
    "Inhale 4…",
    "Hold 4…",
    "Exhale 6…",
    "Again — inhale 4…",
    "Hold 4…",
    "Exhale 6… You're steadier.",
  ];

  const defaultState = () => ({
    userName: null,
    todos: [],
    notes: [],
    moods: [],
    focusUntil: null,
    messages: [
      {
        role: "agent",
        text: "Agent Sumon online — your creative persistent assistant. I do more than alarms: todos, notes, reminders, focus timers, decisions, daily brief. Say brief or tap a chip.",
      },
    ],
  });

  function migrateOld() {
    try {
      const old = localStorage.getItem("sumon-persistent-agent-v1");
      if (!old) return null;
      const parsed = JSON.parse(old);
      const next = defaultState();
      if (parsed.userName) next.userName = parsed.userName;
      if (Array.isArray(parsed.messages)) next.messages = parsed.messages.slice(-40);
      localStorage.removeItem("sumon-persistent-agent-v1");
      return next;
    } catch {
      return null;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrateOld() || defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.messages)) return defaultState();
      return {
        userName: parsed.userName || null,
        todos: Array.isArray(parsed.todos) ? parsed.todos.slice(0, 40) : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 30) : [],
        moods: Array.isArray(parsed.moods) ? parsed.moods.slice(-20) : [],
        focusUntil: parsed.focusUntil || null,
        messages: parsed.messages.slice(-50),
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();
  const reminderTimers = new Map();
  let focusTick = null;

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userName: state.userName,
          todos: state.todos,
          notes: state.notes,
          moods: state.moods,
          focusUntil: state.focusUntil,
          messages: state.messages.slice(-50),
        })
      );
    } catch {
      /* ignore */
    }
    renderMissionBoard();
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    launcher.classList.toggle("hidden", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      input.focus();
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Online — multi-task mode";
    } else {
      agentFigure.classList.remove("listening", "thinking");
      agentStatus.textContent = state.userName
        ? `${state.userName}'s agent on standby`
        : "Multi-task agent on standby";
    }
  }

  function renderMessages() {
    messagesEl.innerHTML = "";
    state.messages.forEach((msg) => {
      const bubble = document.createElement("div");
      bubble.className = `agent-bubble ${msg.role}`;
      bubble.textContent = msg.text;
      messagesEl.appendChild(bubble);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function pushMessage(role, text) {
    state.messages.push({ role, text });
    saveState();
    renderMessages();
  }

  function thinkPulse(on) {
    agentFigure.classList.toggle("thinking", on);
  }

  function pageApi() {
    return window.SumonPage || {};
  }

  function openTodos() {
    return state.todos.filter((t) => !t.done);
  }

  function renderMissionBoard() {
    if (!missionBoard) return;
    const open = openTodos();
    const noteCount = state.notes.length;
    const focusLeft = focusRemaining();
    const bits = [];
    bits.push(`<li><strong>${open.length}</strong> open task${open.length === 1 ? "" : "s"}</li>`);
    bits.push(`<li><strong>${noteCount}</strong> note${noteCount === 1 ? "" : "s"}</li>`);
    if (focusLeft) bits.push(`<li class="focus-live"><strong>Focus</strong> ${focusLeft}</li>`);
    else bits.push(`<li>Focus idle</li>`);
    if (state.moods.length) {
      bits.push(`<li>Mood: ${state.moods[state.moods.length - 1].emoji}</li>`);
    }
    missionBoard.innerHTML = bits.join("");
  }

  function focusRemaining() {
    if (!state.focusUntil) return null;
    const ms = state.focusUntil - Date.now();
    if (ms <= 0) return null;
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function updateFocusHud() {
    if (!focusHud) return;
    const left = focusRemaining();
    if (!left) {
      focusHud.classList.remove("active");
      focusHud.textContent = "";
      if (state.focusUntil && state.focusUntil <= Date.now()) {
        state.focusUntil = null;
        saveState();
        pushMessage("agent", "Focus block done. Stretch, then pick the next tiny win.");
        beepSoft();
      }
      return;
    }
    focusHud.classList.add("active");
    focusHud.textContent = `Focus ${left}`;
    renderMissionBoard();
  }

  function startFocusWatch() {
    if (focusTick) clearInterval(focusTick);
    focusTick = setInterval(updateFocusHud, 1000);
    updateFocusHud();
  }

  function beepSoft() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 660;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      osc.stop(ctx.currentTime + 0.22);
    } catch {
      /* ignore */
    }
  }

  function scheduleReminder(label, minutes) {
    const ms = Math.max(0.1, minutes) * 60000;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const handle = setTimeout(() => {
      reminderTimers.delete(id);
      setOpen(true);
      pushMessage("agent", `Reminder: ${label}`);
      beepSoft();
      agentStatus.textContent = "Reminder fired";
    }, ms);
    reminderTimers.set(id, handle);
    return id;
  }

  function formatTodoList() {
    if (!state.todos.length) return "No tasks yet. Try: todo buy milk";
    return state.todos
      .map((t, i) => `${t.done ? "✓" : "○"} ${i + 1}. ${t.text}`)
      .join("\n");
  }

  function timeBrief() {
    const now = new Date();
    const hour = now.getHours();
    let greet = "Hey";
    if (hour < 12) greet = "Good morning";
    else if (hour < 17) greet = "Good afternoon";
    else greet = "Good evening";
    const name = state.userName ? `, ${state.userName}` : "";
    const open = openTodos();
    const top = open.slice(0, 3).map((t) => `• ${t.text}`).join("\n");
    const mood = state.moods.length
      ? `\nLast mood: ${state.moods[state.moods.length - 1].emoji} ${state.moods[state.moods.length - 1].note || ""}`.trim()
      : "";
    const focus = focusRemaining() ? `\nFocus left: ${focusRemaining()}` : "";
    return [
      `${greet}${name}.`,
      now.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
      open.length ? `Open tasks (${open.length}):\n${top}` : "No open tasks — add one with todo …",
      state.notes.length ? `${state.notes.length} note(s) saved.` : null,
      mood || null,
      focus || null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function safeMath(expr) {
    const cleaned = expr.replace(/[^0-9+\-*/().%\s]/g, "");
    if (!cleaned.trim()) return null;
    try {
      // eslint-disable-next-line no-new-func
      const val = Function(`"use strict"; return (${cleaned})`)();
      if (typeof val !== "number" || !Number.isFinite(val)) return null;
      return Number(Math.round(val * 1000) / 1000);
    } catch {
      return null;
    }
  }

  function parseMinutes(chunk) {
    const m = String(chunk).match(/(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?/i);
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = (m[2] || "m").toLowerCase();
    if (unit.startsWith("s")) return n / 60;
    if (unit.startsWith("h")) return n * 60;
    return n;
  }

  function replyFor(userText) {
    const text = userText.trim();
    const lower = text.toLowerCase();
    const api = pageApi();
    const name = state.userName;

    const nameMatch = lower.match(
      /(?:my name is|call me|i am|i'm)\s+([a-z][a-z0-9_-]{1,24})/i
    );
    if (nameMatch && !/^i am (happy|sad|ok|fine|tired|good|great)/i.test(lower)) {
      state.userName = nameMatch[1].replace(/^./, (c) => c.toUpperCase());
      saveState();
      return `Saved — hi ${state.userName}. Ask brief anytime.`;
    }

    if (/\b(who am i|what'?s my name|do you remember me)\b/.test(lower)) {
      return name ? `You're ${name}.` : "No name yet. Say “my name is …”";
    }

    if (/\b(help|what can you do|commands)\b/.test(lower)) {
      return [
        "I can:",
        "• brief — day snapshot",
        "• todo … / todos / done 1 / clear todos",
        "• note … / notes",
        "• remind … in 5m",
        "• focus 25 / focus stop",
        "• decide a or b · coin",
        "• calc 12*8 · mood happy",
        "• idea · breathe · ring/snap (play)",
      ].join("\n");
    }

    if (/\b(clear memory|forget me|reset memory|wipe all)\b/.test(lower)) {
      reminderTimers.forEach((t) => clearTimeout(t));
      reminderTimers.clear();
      state = defaultState();
      saveState();
      renderMessages();
      pushMessage("agent", "Memory wiped. Still your multi-task agent.");
      return null;
    }

    if (/\b(brief|daily|dashboard|summary|what should i do)\b/.test(lower)) {
      return timeBrief();
    }

    // Todos
    const todoAdd = lower.match(/^(?:todo|task|add task|add todo)\s+(.+)$/i) ||
      lower.match(/^add\s+(.+)\s+to\s+(?:my\s+)?(?:list|todos|tasks)$/i);
    if (todoAdd) {
      const item = todoAdd[1].trim();
      state.todos.push({ text: item, done: false, at: Date.now() });
      saveState();
      return `Added: ${item}\n${formatTodoList()}`;
    }

    if (/^(todos|tasks|list|my list|show todos|show tasks)$/i.test(lower)) {
      return formatTodoList();
    }

    const doneMatch = lower.match(/^(?:done|finish|complete|check off)\s+#?(\d+)$/i);
    if (doneMatch) {
      const idx = parseInt(doneMatch[1], 10) - 1;
      if (!state.todos[idx]) return "No task at that number.";
      state.todos[idx].done = true;
      saveState();
      return `Done: ${state.todos[idx].text}`;
    }

    if (/^(clear todos|clear tasks|wipe todos)$/i.test(lower)) {
      state.todos = [];
      saveState();
      return "Todo list cleared.";
    }

    // Notes
    const noteAdd = lower.match(/^(?:note|remember|save note)\s+(.+)$/i);
    if (noteAdd) {
      const body = noteAdd[1].trim();
      state.notes.unshift({ text: body, at: Date.now() });
      state.notes = state.notes.slice(0, 30);
      saveState();
      return `Noted: ${body}`;
    }

    if (/^(notes|show notes|my notes)$/i.test(lower)) {
      if (!state.notes.length) return "No notes. Try: note call mom Sunday";
      return state.notes
        .slice(0, 8)
        .map((n, i) => `${i + 1}. ${n.text}`)
        .join("\n");
    }

    // Reminders
    const remindMatch =
      lower.match(/^remind(?:\s+me)?\s+(?:to\s+)?(.+?)\s+in\s+(\d+(?:\.\d+)?\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)?)$/i) ||
      lower.match(/^remind(?:\s+me)?\s+in\s+(\d+(?:\.\d+)?\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)?)\s+(?:to\s+)?(.+)$/i);
    if (remindMatch) {
      let label;
      let mins;
      if (/^remind(?:\s+me)?\s+in\s+/i.test(lower)) {
        mins = parseMinutes(remindMatch[1]);
        label = remindMatch[2].trim();
      } else {
        label = remindMatch[1].trim();
        mins = parseMinutes(remindMatch[2]);
      }
      if (mins == null) return "Try: remind stretch in 5m";
      scheduleReminder(label, mins);
      const pretty = mins < 1 ? `${Math.round(mins * 60)}s` : `${mins}m`;
      return `Got it — I'll nudge you about “${label}” in ${pretty}.`;
    }

    // Focus / pomodoro
    const focusMatch = lower.match(/^(?:focus|pomodoro|timer)\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)?$/i);
    if (focusMatch || /^(focus|pomodoro|start focus)$/i.test(lower)) {
      const mins = focusMatch ? parseFloat(focusMatch[1]) : 25;
      state.focusUntil = Date.now() + mins * 60000;
      saveState();
      startFocusWatch();
      return `Focus started — ${mins} min. I've got the clock; you do the work.`;
    }

    if (/^(focus stop|stop focus|cancel focus|end focus)$/i.test(lower)) {
      state.focusUntil = null;
      saveState();
      updateFocusHud();
      return "Focus cancelled.";
    }

    // Decide / coin
    if (/^(coin|flip|coin flip)$/i.test(lower)) {
      return Math.random() < 0.5 ? "Heads." : "Tails.";
    }

    const decideMatch =
      lower.match(/^(?:decide|choose|pick)\s+(.+)$/i) ||
      lower.match(/^(.+)\s+or\s+(.+)$/i);
    if (decideMatch) {
      let options;
      if (/^(?:decide|choose|pick)\s+/i.test(lower)) {
        options = decideMatch[1]
          .split(/\s+or\s+|\s*[,/|]\s*/i)
          .map((s) => s.trim())
          .filter(Boolean);
      } else {
        options = [decideMatch[1].trim(), decideMatch[2].trim()].filter(Boolean);
      }
      if (options.length >= 2) {
        const pick = options[Math.floor(Math.random() * options.length)];
        return `I pick: ${pick}`;
      }
    }

    // Mood
    const moodMatch = lower.match(/^(?:mood|i feel|feeling)\s+(.+)$/i);
    if (moodMatch) {
      const raw = moodMatch[1].trim();
      const map = {
        happy: "😊",
        good: "😊",
        great: "🌟",
        sad: "😢",
        tired: "😴",
        angry: "😤",
        anxious: "😰",
        calm: "😌",
        ok: "😐",
        meh: "😐",
        excited: "⚡",
      };
      const key = raw.toLowerCase().split(/\s+/)[0];
      const emoji = map[key] || "✨";
      state.moods.push({ emoji, note: raw, at: Date.now() });
      state.moods = state.moods.slice(-20);
      saveState();
      return `Logged ${emoji} ${raw}. Want an idea or a 30s breathe?`;
    }

    // Calc
    const calcMatch = lower.match(/^(?:calc|calculate|math)\s+(.+)$/i);
    if (calcMatch || /^[\d(].*[\d)]$/.test(lower.replace(/\s/g, "")) && /[+\-*/%]/.test(lower)) {
      const expr = calcMatch ? calcMatch[1] : text;
      const val = safeMath(expr);
      return val == null ? "Couldn't compute that." : `= ${val}`;
    }

    // Idea / motivate
    if (/^(idea|inspire|motivate|spark|bored)$/i.test(lower)) {
      return IDEAS[Math.floor(Math.random() * IDEAS.length)];
    }

    // Breathe
    if (/^(breathe|breath|calm|relax)$/i.test(lower)) {
      BREATH_STEPS.forEach((step, i) => {
        setTimeout(() => {
          pushMessage("agent", step);
        }, 1600 * (i + 1));
      });
      return "Box-ish breath — follow along:";
    }

    // Playful page controls
    if (/\b(status|what'?s happening|state)\b/.test(lower)) {
      const ringing = api.isRinging ? api.isRinging() : false;
      const trapped = api.isTrapped ? api.isTrapped() : false;
      return [
        timeBrief(),
        `Play: alarm ${ringing ? "ON" : "off"} · trap ${trapped ? "CLOSED" : "set"}`,
      ].join("\n\n");
    }

    if (/\b(ring|wake|brring|wake up)\b/.test(lower) && !/\b(earring|bring)\b/.test(lower)) {
      if (api.startRing) api.startRing();
      return name ? `Alarm Man ringing for ${name}.` : "Alarm Man ringing.";
    }

    if (/\b(snooze|quiet|silence)\b/.test(lower)) {
      if (api.stopRing) api.stopRing();
      return "Snoozed.";
    }

    if (/\b(snap|gotcha)\b/.test(lower) || /^(trap|spring trap)$/i.test(lower)) {
      if (api.springTrap) api.springTrap();
      return "SNAP! (play mode)";
    }

    if (/^(reset|release|untrap)$/i.test(lower) || /\breset trap\b/.test(lower)) {
      if (api.resetTrap) api.resetTrap();
      return "Trap open.";
    }

    if (/\b(hello|hi|hey|yo)\b/.test(lower)) {
      return timeBrief();
    }

    if (/\b(thank|thanks|ty)\b/.test(lower)) {
      return "Always. That's what I'm for.";
    }

    if (/\b(who are you|what are you)\b/.test(lower)) {
      return "Agent Sumon — creative persistent assistant for tasks, notes, focus, decisions, and the occasional screen trap.";
    }

    return "Try brief, todo …, note …, remind … in 5m, focus 25, decide a or b, or help.";
  }

  function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushMessage("user", trimmed);
    thinkPulse(true);
    agentStatus.textContent = "Working…";

    window.setTimeout(() => {
      const reply = replyFor(trimmed);
      thinkPulse(false);
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Online — multi-task mode";
      if (reply != null) pushMessage("agent", reply);
    }, 160);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.value;
    input.value = "";
    sendText(text);
  }

  launcher.addEventListener("click", () => setOpen(true));
  if (openChatBtn) openChatBtn.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", handleSubmit);

  document.querySelectorAll(".agent-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const prompt = chip.getAttribute("data-prompt");
      if (prompt) sendText(prompt);
    });
  });

  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener("click", () => {
      reminderTimers.forEach((t) => clearTimeout(t));
      reminderTimers.clear();
      state = defaultState();
      saveState();
      renderMessages();
      updateFocusHud();
      agentStatus.textContent = "Memory cleared";
      setOpen(true);
      pushMessage("agent", "Fresh start — multi-task mode ready.");
    });
  }

  agentFigure.addEventListener("click", () => setOpen(true));

  renderMessages();
  renderMissionBoard();
  startFocusWatch();
  agentStatus.textContent = state.userName
    ? `Welcome back, ${state.userName}`
    : "Multi-task agent on standby";
})();
