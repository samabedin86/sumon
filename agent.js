(() => {
  const STORAGE_KEY = "sumon-persistent-agent-v3";

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
  const focusChip = document.getElementById("focusChip");

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

  const defaultLearn = () => ({
    facts: {},
    skillCounts: {},
    focusMinutes: [],
    decideWins: {},
    hourHits: {},
    lastProactiveAt: 0,
    proactive: true,
    preferredFocus: null,
    lastAction: null,
  });

  const defaultState = () => ({
    userName: null,
    todos: [],
    notes: [],
    moods: [],
    focusUntil: null,
    learn: defaultLearn(),
    messages: [
      {
        role: "agent",
        text: "Agent Sumon online — I learn from you and act. Teach me with “prefer …” or “learn …”, say act when you want me to move, or just use me and I'll adapt.",
      },
    ],
  });

  function migrate() {
    for (const key of ["sumon-persistent-agent-v2", "sumon-persistent-agent-v1"]) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const next = defaultState();
        if (parsed.userName) next.userName = parsed.userName;
        if (Array.isArray(parsed.todos)) next.todos = parsed.todos;
        if (Array.isArray(parsed.notes)) next.notes = parsed.notes;
        if (Array.isArray(parsed.moods)) next.moods = parsed.moods;
        if (parsed.focusUntil) next.focusUntil = parsed.focusUntil;
        if (Array.isArray(parsed.messages)) next.messages = parsed.messages.slice(-50);
        if (parsed.learn) next.learn = { ...defaultLearn(), ...parsed.learn };
        localStorage.removeItem(key);
        return next;
      } catch {
        /* try next */
      }
    }
    return null;
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return migrate() || defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.messages)) return defaultState();
      return {
        userName: parsed.userName || null,
        todos: Array.isArray(parsed.todos) ? parsed.todos.slice(0, 40) : [],
        notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 30) : [],
        moods: Array.isArray(parsed.moods) ? parsed.moods.slice(-20) : [],
        focusUntil: parsed.focusUntil || null,
        learn: { ...defaultLearn(), ...(parsed.learn || {}) },
        messages: parsed.messages.slice(-50),
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();
  const reminderTimers = new Map();
  let focusTick = null;
  let proactivePending = false;

  function ensureLearn() {
    if (!state.learn) state.learn = defaultLearn();
    if (!state.learn.facts) state.learn.facts = {};
    if (!state.learn.skillCounts) state.learn.skillCounts = {};
    if (!state.learn.focusMinutes) state.learn.focusMinutes = [];
    if (!state.learn.decideWins) state.learn.decideWins = {};
    if (!state.learn.hourHits) state.learn.hourHits = {};
    if (typeof state.learn.proactive !== "boolean") state.learn.proactive = true;
  }

  function saveState() {
    ensureLearn();
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userName: state.userName,
          todos: state.todos,
          notes: state.notes,
          moods: state.moods,
          focusUntil: state.focusUntil,
          learn: state.learn,
          messages: state.messages.slice(-50),
        })
      );
    } catch {
      /* ignore */
    }
    renderMissionBoard();
    syncFocusChip();
  }

  function bumpSkill(skill) {
    ensureLearn();
    state.learn.skillCounts[skill] = (state.learn.skillCounts[skill] || 0) + 1;
    const hour = String(new Date().getHours());
    state.learn.hourHits[hour] = (state.learn.hourHits[hour] || 0) + 1;
    state.learn.lastAction = skill;
  }

  function preferredFocusMins() {
    ensureLearn();
    if (state.learn.preferredFocus) return state.learn.preferredFocus;
    const arr = state.learn.focusMinutes;
    if (!arr.length) return 25;
    const counts = {};
    arr.forEach((m) => {
      counts[m] = (counts[m] || 0) + 1;
    });
    return Number(
      Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    );
  }

  function topSkills(n = 3) {
    ensureLearn();
    return Object.entries(state.learn.skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k]) => k);
  }

  function peakHour() {
    ensureLearn();
    const entries = Object.entries(state.learn.hourHits);
    if (!entries.length) return null;
    return Number(entries.sort((a, b) => b[1] - a[1])[0][0]);
  }

  function learnedDecidePick(options) {
    ensureLearn();
    let best = null;
    let bestScore = -1;
    options.forEach((opt) => {
      const key = opt.toLowerCase();
      const score = state.learn.decideWins[key] || 0;
      // also check facts like prefer tea
      const prefer = String(state.learn.facts.prefer || state.learn.facts.drink || "")
        .toLowerCase();
      const bonus = prefer && key.includes(prefer) ? 5 : 0;
      const total = score + bonus;
      if (total > bestScore) {
        bestScore = total;
        best = opt;
      }
    });
    if (bestScore <= 0) return null;
    return best;
  }

  function syncFocusChip() {
    if (!focusChip) return;
    const mins = preferredFocusMins();
    focusChip.setAttribute("data-prompt", `focus ${mins}`);
    focusChip.textContent = `Focus ${mins}`;
  }

  function learnProfile() {
    ensureLearn();
    const facts = Object.entries(state.learn.facts);
    const skills = topSkills(5);
    const lines = [
      state.userName ? `You: ${state.userName}` : "You: (name unknown)",
      `Preferred focus: ${preferredFocusMins()}m`,
      `Proactive: ${state.learn.proactive ? "on" : "off"}`,
      skills.length ? `Top skills: ${skills.join(", ")}` : "Top skills: still watching",
      peakHour() != null ? `Most active around ${peakHour()}:00` : null,
      facts.length
        ? `Facts:\n${facts.map(([k, v]) => `• ${k}: ${v}`).join("\n")}`
        : "Facts: none yet — try prefer tea / learn I work nights",
    ];
    return lines.filter(Boolean).join("\n");
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    launcher.classList.toggle("hidden", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      input.focus();
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Learning & acting";
      maybeProactiveOpen();
    } else {
      agentFigure.classList.remove("listening", "thinking");
      agentStatus.textContent = state.userName
        ? `${state.userName}'s agent on standby`
        : "Learning agent on standby";
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

  function factCount() {
    ensureLearn();
    return Object.keys(state.learn.facts).length;
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
    else bits.push(`<li>Focus ${preferredFocusMins()}m habit</li>`);
    bits.push(`<li><strong>${factCount()}</strong> learned</li>`);
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
        const open = openTodos();
        const next = open[0] ? ` Next up: ${open[0].text}` : " Grab water, then pick a tiny win.";
        pushMessage("agent", `Focus done.${next}`);
        beepSoft();
        // learn: after focus, if many todos, nudge
        if (open.length >= 2 && state.learn.proactive) {
          setTimeout(() => {
            pushMessage(
              "agent",
              `Acting on what I know — ${open.length} tasks waiting. Say done 1 when you finish one.`
            );
          }, 900);
        }
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

  function startFocus(mins) {
    const m = mins || preferredFocusMins();
    state.focusUntil = Date.now() + m * 60000;
    ensureLearn();
    state.learn.focusMinutes.push(m);
    state.learn.focusMinutes = state.learn.focusMinutes.slice(-20);
    bumpSkill("focus");
    saveState();
    startFocusWatch();
    return m;
  }

  function formatTodoList() {
    if (!state.todos.length) return "No tasks yet. Try: todo buy milk";
    return state.todos
      .map((t, i) => `${t.done ? "✓" : "○"} ${i + 1}. ${t.text}`)
      .join("\n");
  }

  function insightLine() {
    ensureLearn();
    const parts = [];
    const skills = topSkills(2);
    if (skills.length) parts.push(`you often use ${skills.join(" & ")}`);
    if (state.learn.preferredFocus || state.learn.focusMinutes.length >= 2) {
      parts.push(`focus habit ${preferredFocusMins()}m`);
    }
    const prefer = state.learn.facts.prefer || state.learn.facts.drink;
    if (prefer) parts.push(`prefer ${prefer}`);
    if (state.learn.facts.schedule) parts.push(state.learn.facts.schedule);
    return parts.length ? `Learned: ${parts.join(" · ")}` : null;
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
      ? `Last mood: ${state.moods[state.moods.length - 1].emoji} ${state.moods[state.moods.length - 1].note || ""}`.trim()
      : null;
    const focus = focusRemaining() ? `Focus left: ${focusRemaining()}` : null;
    const nextAct = suggestAction(false);
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
      mood,
      focus,
      insightLine(),
      nextAct ? `Suggested next: ${nextAct.label}` : null,
    ]
      .filter(Boolean)
      .join("\n");
  }

  function suggestAction(execute) {
    ensureLearn();
    const open = openTodos();
    const lastMood = state.moods[state.moods.length - 1];
    const sad =
      lastMood &&
      /sad|anxious|tired|angry|overwhelm/i.test(lastMood.note || "");

    // Priority: focus if many todos and idle
    if (open.length >= 2 && !focusRemaining()) {
      const mins = preferredFocusMins();
      return {
        label: `start ${mins}m focus on “${open[0].text}”`,
        run: () => {
          const m = startFocus(mins);
          return `Acting: ${m}m focus on “${open[0].text}”. I've got the clock.`;
        },
      };
    }

    if (sad && Date.now() - (lastMood.at || 0) < 1000 * 60 * 60 * 6) {
      return {
        label: "guided breathe (mood check)",
        run: () => {
          bumpSkill("breathe");
          BREATH_STEPS.forEach((step, i) => {
            setTimeout(() => pushMessage("agent", step), 1600 * (i + 1));
          });
          return "Acting on your mood — breathe with me:";
        },
      };
    }

    if (open.length === 1 && !focusRemaining()) {
      return {
        label: `tackle “${open[0].text}”`,
        run: () => {
          const m = startFocus(Math.min(15, preferredFocusMins()));
          return `Acting: short ${m}m push on “${open[0].text}”.`;
        },
      };
    }

    if (!open.length && !state.notes.length) {
      return {
        label: "capture one todo",
        run: () =>
          "Acting tip: tell me one real task — “todo …” — and I'll track it.",
      };
    }

    const skills = topSkills(1);
    if (skills[0] === "idea") {
      return {
        label: "fresh idea",
        run: () => {
          bumpSkill("idea");
          return IDEAS[Math.floor(Math.random() * IDEAS.length)];
        },
      };
    }

    if (execute && open.length) {
      return {
        label: `remind about “${open[0].text}”`,
        run: () => {
          scheduleReminder(open[0].text, 10);
          bumpSkill("remind");
          return `Acting: I'll nudge you about “${open[0].text}” in 10m.`;
        },
      };
    }

    return open.length
      ? {
          label: `review todos (${open.length})`,
          run: () => {
            bumpSkill("todos");
            return formatTodoList();
          },
        }
      : null;
  }

  function maybeProactiveOpen() {
    ensureLearn();
    if (!state.learn.proactive) return;
    const now = Date.now();
    if (now - (state.learn.lastProactiveAt || 0) < 45000) return;
    if (proactivePending) return;
    const suggestion = suggestAction(false);
    if (!suggestion) return;
    proactivePending = true;
    state.learn.lastProactiveAt = now;
    saveState();
    setTimeout(() => {
      proactivePending = false;
      pushMessage(
        "agent",
        `I noticed a pattern — want me to ${suggestion.label}? Say act.`
      );
    }, 400);
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
    const m = String(chunk).match(
      /(\d+(?:\.\d+)?)\s*(s|sec|secs|second|seconds|m|min|mins|minute|minutes|h|hr|hrs|hour|hours)?/i
    );
    if (!m) return null;
    const n = parseFloat(m[1]);
    const unit = (m[2] || "m").toLowerCase();
    if (unit.startsWith("s")) return n / 60;
    if (unit.startsWith("h")) return n * 60;
    return n;
  }

  function storeFact(key, value) {
    ensureLearn();
    state.learn.facts[key] = value;
    bumpSkill("learn");
    saveState();
  }

  function replyFor(userText) {
    const text = userText.trim();
    const lower = text.toLowerCase();
    const api = pageApi();
    const name = state.userName;
    ensureLearn();

    const nameMatch = lower.match(
      /(?:my name is|call me|i am|i'm)\s+([a-z][a-z0-9_-]{1,24})/i
    );
    if (
      nameMatch &&
      !/^i am (happy|sad|ok|fine|tired|good|great|anxious)/i.test(lower)
    ) {
      state.userName = nameMatch[1].replace(/^./, (c) => c.toUpperCase());
      bumpSkill("identity");
      saveState();
      return `Saved — hi ${state.userName}. I'll learn your habits as we go.`;
    }

    if (/\b(who am i|what'?s my name|do you remember me)\b/.test(lower)) {
      return name ? `You're ${name}.\n${insightLine() || ""}`.trim() : "No name yet.";
    }

    if (/^(profile|what have you learned|learned|my profile|show learning)$/i.test(lower)) {
      bumpSkill("profile");
      return learnProfile();
    }

    if (/^(act|do something|take action|go ahead|yes act)$/i.test(lower)) {
      const suggestion = suggestAction(true);
      if (!suggestion) return "Nothing urgent — add a todo or teach me a preference.";
      bumpSkill("act");
      return suggestion.run();
    }

    if (/^(proactive on|auto on|learn and act on)$/i.test(lower)) {
      state.learn.proactive = true;
      saveState();
      return "Proactive mode on — I'll suggest & act from patterns.";
    }

    if (/^(proactive off|auto off|stop acting)$/i.test(lower)) {
      state.learn.proactive = false;
      saveState();
      return "Proactive mode off — I'll wait for your commands.";
    }

    // Explicit teaching
    const preferMatch = lower.match(
      /^(?:prefer|i prefer|set prefer)\s+(.+)$/i
    );
    if (preferMatch) {
      const val = preferMatch[1].trim();
      storeFact("prefer", val);
      const focusPref = val.match(/focus\s+(\d+)/i);
      if (focusPref) {
        state.learn.preferredFocus = parseInt(focusPref[1], 10);
        saveState();
      }
      return `Learned preference: ${val}. I'll use it when I act.`;
    }

    const learnMatch = lower.match(
      /^(?:learn|remember that|teach|note that)\s+(.+)$/i
    );
    if (learnMatch) {
      const body = learnMatch[1].trim();
      // "learn I work nights" / "learn drink = tea"
      const kv = body.match(/^([a-z][\w\s-]{0,24}?)\s*[:=]\s*(.+)$/i);
      if (kv) {
        storeFact(kv[1].trim().toLowerCase().replace(/\s+/g, "_"), kv[2].trim());
        return `Learned ${kv[1].trim()} → ${kv[2].trim()}.`;
      }
      if (/work\s+nights?|night\s*owl/i.test(body)) {
        storeFact("schedule", "night owl");
        return "Learned: you work nights. I'll bias evening briefings.";
      }
      if (/work\s+mornings?|early\s*bird/i.test(body)) {
        storeFact("schedule", "early bird");
        return "Learned: mornings are your window.";
      }
      storeFact(`fact_${Object.keys(state.learn.facts).length + 1}`, body);
      return `Learned: ${body}`;
    }

    if (/^(forget prefer|clear prefer)$/i.test(lower)) {
      delete state.learn.facts.prefer;
      state.learn.preferredFocus = null;
      saveState();
      return "Preference cleared.";
    }

    if (/\b(help|what can you do|commands)\b/.test(lower)) {
      bumpSkill("help");
      return [
        "Skills + learning:",
        "• brief · todo · note · remind · focus · decide",
        "• prefer tea / prefer focus 15 — teach me",
        "• learn I work nights — store a fact",
        "• profile — what I've learned",
        "• act — I choose & do the next best thing",
        "• proactive on/off",
        "• mood · idea · breathe · calc · ring/snap",
      ].join("\n");
    }

    if (/\b(clear memory|forget me|reset memory|wipe all)\b/.test(lower)) {
      reminderTimers.forEach((t) => clearTimeout(t));
      reminderTimers.clear();
      state = defaultState();
      saveState();
      renderMessages();
      pushMessage("agent", "Memory wiped — including learned habits. Ready to relearn.");
      return null;
    }

    if (/\b(brief|daily|dashboard|summary|what should i do)\b/.test(lower)) {
      bumpSkill("brief");
      return timeBrief();
    }

    // Todos
    const todoAdd =
      lower.match(/^(?:todo|task|add task|add todo)\s+(.+)$/i) ||
      lower.match(/^add\s+(.+)\s+to\s+(?:my\s+)?(?:list|todos|tasks)$/i);
    if (todoAdd) {
      const item = todoAdd[1].trim();
      state.todos.push({ text: item, done: false, at: Date.now() });
      bumpSkill("todo");
      saveState();
      let extra = "";
      if (openTodos().length >= 3 && state.learn.proactive && !focusRemaining()) {
        extra = `\nI learned you pile tasks — say act and I'll start a ${preferredFocusMins()}m focus.`;
      }
      return `Added: ${item}\n${formatTodoList()}${extra}`;
    }

    if (/^(todos|tasks|list|my list|show todos|show tasks)$/i.test(lower)) {
      bumpSkill("todos");
      return formatTodoList();
    }

    const doneMatch = lower.match(/^(?:done|finish|complete|check off)\s+#?(\d+)$/i);
    if (doneMatch) {
      const idx = parseInt(doneMatch[1], 10) - 1;
      if (!state.todos[idx]) return "No task at that number.";
      state.todos[idx].done = true;
      bumpSkill("done");
      saveState();
      return `Done: ${state.todos[idx].text}`;
    }

    if (/^(clear todos|clear tasks|wipe todos)$/i.test(lower)) {
      state.todos = [];
      saveState();
      return "Todo list cleared.";
    }

    // Notes — avoid stealing "remember that" (handled above)
    const noteAdd = lower.match(/^(?:note|save note)\s+(.+)$/i) ||
      (/^remember\s+(?!that\b)(.+)$/i.test(lower) ? lower.match(/^remember\s+(.+)$/i) : null);
    if (noteAdd) {
      const body = noteAdd[1].trim();
      state.notes.unshift({ text: body, at: Date.now() });
      state.notes = state.notes.slice(0, 30);
      bumpSkill("note");
      saveState();
      return `Noted: ${body}`;
    }

    if (/^(notes|show notes|my notes)$/i.test(lower)) {
      bumpSkill("notes");
      if (!state.notes.length) return "No notes. Try: note call mom Sunday";
      return state.notes
        .slice(0, 8)
        .map((n, i) => `${i + 1}. ${n.text}`)
        .join("\n");
    }

    // Reminders
    const remindMatch =
      lower.match(
        /^remind(?:\s+me)?\s+(?:to\s+)?(.+?)\s+in\s+(\d+(?:\.\d+)?\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)?)$/i
      ) ||
      lower.match(
        /^remind(?:\s+me)?\s+in\s+(\d+(?:\.\d+)?\s*(?:s|sec|secs|m|min|mins|h|hr|hrs|hour|hours)?)\s+(?:to\s+)?(.+)$/i
      );
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
      bumpSkill("remind");
      saveState();
      const pretty = mins < 1 ? `${Math.round(mins * 60)}s` : `${mins}m`;
      return `Got it — nudge for “${label}” in ${pretty}.`;
    }

    // Focus
    const focusMatch = lower.match(
      /^(?:focus|pomodoro|timer)\s+(\d+(?:\.\d+)?)\s*(m|min|mins|minute|minutes)?$/i
    );
    if (focusMatch || /^(focus|pomodoro|start focus)$/i.test(lower)) {
      const mins = focusMatch ? parseFloat(focusMatch[1]) : preferredFocusMins();
      const used = startFocus(mins);
      return `Focus ${used}m started${
        !focusMatch ? " (your learned default)" : ""
      }.`;
    }

    if (/^(focus stop|stop focus|cancel focus|end focus)$/i.test(lower)) {
      state.focusUntil = null;
      saveState();
      updateFocusHud();
      return "Focus cancelled.";
    }

    if (/^(coin|flip|coin flip)$/i.test(lower)) {
      bumpSkill("coin");
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
        const learned = learnedDecidePick(options);
        const pick =
          learned || options[Math.floor(Math.random() * options.length)];
        ensureLearn();
        const key = pick.toLowerCase();
        state.learn.decideWins[key] = (state.learn.decideWins[key] || 0) + 1;
        bumpSkill("decide");
        saveState();
        return learned
          ? `I pick: ${pick} (learned from your prefs)`
          : `I pick: ${pick}`;
      }
    }

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
      bumpSkill("mood");
      saveState();
      if (/sad|anxious|tired|angry/i.test(raw) && state.learn.proactive) {
        return `Logged ${emoji} ${raw}. I can act — say act for a breathe session.`;
      }
      return `Logged ${emoji} ${raw}.`;
    }

    const calcMatch = lower.match(/^(?:calc|calculate|math)\s+(.+)$/i);
    if (
      calcMatch ||
      (/^[\d(].*[\d)]$/.test(lower.replace(/\s/g, "")) && /[+\-*/%]/.test(lower))
    ) {
      const expr = calcMatch ? calcMatch[1] : text;
      const val = safeMath(expr);
      bumpSkill("calc");
      return val == null ? "Couldn't compute that." : `= ${val}`;
    }

    if (/^(idea|inspire|motivate|spark|bored)$/i.test(lower)) {
      bumpSkill("idea");
      return IDEAS[Math.floor(Math.random() * IDEAS.length)];
    }

    if (/^(breathe|breath|calm|relax)$/i.test(lower)) {
      bumpSkill("breathe");
      BREATH_STEPS.forEach((step, i) => {
        setTimeout(() => pushMessage("agent", step), 1600 * (i + 1));
      });
      return "Box-ish breath — follow along:";
    }

    if (/\b(status|what'?s happening|state)\b/.test(lower)) {
      const ringing = api.isRinging ? api.isRinging() : false;
      const trapped = api.isTrapped ? api.isTrapped() : false;
      bumpSkill("status");
      return [
        timeBrief(),
        `Play: alarm ${ringing ? "ON" : "off"} · trap ${trapped ? "CLOSED" : "set"}`,
      ].join("\n\n");
    }

    if (
      /\b(ring|wake|brring|wake up)\b/.test(lower) &&
      !/\b(earring|bring)\b/.test(lower)
    ) {
      if (api.startRing) api.startRing();
      bumpSkill("ring");
      return name ? `Alarm Man ringing for ${name}.` : "Alarm Man ringing.";
    }

    if (/\b(snooze|quiet|silence)\b/.test(lower)) {
      if (api.stopRing) api.stopRing();
      return "Snoozed.";
    }

    if (/\b(snap|gotcha)\b/.test(lower) || /^(trap|spring trap)$/i.test(lower)) {
      if (api.springTrap) api.springTrap();
      bumpSkill("snap");
      return "SNAP! (play mode)";
    }

    if (/^(reset|release|untrap)$/i.test(lower) || /\breset trap\b/.test(lower)) {
      if (api.resetTrap) api.resetTrap();
      return "Trap open.";
    }

    if (/\b(hello|hi|hey|yo)\b/.test(lower)) {
      bumpSkill("brief");
      return timeBrief();
    }

    if (/\b(thank|thanks|ty)\b/.test(lower)) {
      return "Always — and I'm still learning you.";
    }

    if (/\b(who are you|what are you)\b/.test(lower)) {
      return "Agent Sumon — I learn your prefs & habits, then act (focus, remind, breathe, decide).";
    }

    return "Try act, profile, prefer …, learn …, brief, or help.";
  }

  function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushMessage("user", trimmed);
    thinkPulse(true);
    agentStatus.textContent = "Learning…";

    window.setTimeout(() => {
      const reply = replyFor(trimmed);
      thinkPulse(false);
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Learning & acting";
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
      pushMessage("agent", "Fresh start — ready to learn you again.");
    });
  }

  agentFigure.addEventListener("click", () => setOpen(true));

  renderMessages();
  renderMissionBoard();
  syncFocusChip();
  startFocusWatch();
  agentStatus.textContent = state.userName
    ? `Welcome back, ${state.userName}`
    : "Learning agent on standby";
})();
