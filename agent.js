(() => {
  const STORAGE_KEY = "sumon-persistent-agent-v1";

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

  const defaultState = () => ({
    userName: null,
    messages: [
      {
        role: "agent",
        text: "Hey — I'm Agent Sumon, your persistent assistant. I stick around even after you refresh. Ask me to ring the alarm, spring the trap, or just chat.",
      },
    ],
  });

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.messages)) return defaultState();
      return {
        userName: parsed.userName || null,
        messages: parsed.messages.slice(-40),
      };
    } catch {
      return defaultState();
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          userName: state.userName,
          messages: state.messages.slice(-40),
        })
      );
    } catch {
      /* ignore quota errors */
    }
  }

  function setOpen(open) {
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    launcher.classList.toggle("hidden", open);
    launcher.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      input.focus();
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Online — listening";
    } else {
      agentFigure.classList.remove("listening", "thinking");
      agentStatus.textContent = "Persistent agent on standby";
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

  function replyFor(userText) {
    const text = userText.trim();
    const lower = text.toLowerCase();
    const api = pageApi();
    const name = state.userName;

    const nameMatch = lower.match(
      /(?:my name is|i'?m|call me|i am)\s+([a-z][a-z0-9_-]{1,24})/i
    );
    if (nameMatch) {
      state.userName = nameMatch[1].replace(/^./, (c) => c.toUpperCase());
      saveState();
      return `Got it — I'll remember you as ${state.userName}. Refresh anytime; I'll still know.`;
    }

    if (/\b(who am i|what'?s my name|do you remember me)\b/.test(lower)) {
      return name
        ? `You're ${name}. Persistent memory is working.`
        : "I don't have your name yet. Tell me: “My name is …”";
    }

    if (/\b(help|what can you do|commands)\b/.test(lower)) {
      return [
        "I replace hunting for buttons. Try:",
        "• ring / wake up — start Alarm Man",
        "• snooze / quiet — stop the alarm",
        "• snap / trap — spring the screen trap",
        "• reset / release — open the trap",
        "• status — what's ringing or trapped",
        "• my name is … — I'll remember across reloads",
        "• clear memory — wipe chat + name",
      ].join("\n");
    }

    if (/\b(clear memory|forget me|reset memory|wipe)\b/.test(lower)) {
      state = defaultState();
      saveState();
      renderMessages();
      pushMessage(
        "agent",
        "Memory cleared. Fresh start — I'm still your persistent assistant."
      );
      return null;
    }

    if (/\b(status|what'?s happening|state)\b/.test(lower)) {
      const ringing = api.isRinging ? api.isRinging() : false;
      const trapped = api.isTrapped ? api.isTrapped() : false;
      return `Alarm: ${ringing ? "RINGING" : "sleeping"}. Trap: ${
        trapped ? "CLOSED" : "set and waiting"
      }.${name ? ` Hello again, ${name}.` : ""}`;
    }

    if (/\b(ring|alarm|wake|brring|wake up)\b/.test(lower)) {
      if (api.startRing) api.startRing();
      return name
        ? `On it, ${name} — Alarm Man is ringing!`
        : "Alarm Man is ringing. BRRRING!";
    }

    if (/\b(snooze|stop|quiet|silence|shut up)\b/.test(lower)) {
      if (api.stopRing) api.stopRing();
      return "Snoozed. Back to zzz…";
    }

    if (/\b(snap|trap|catch|gotcha|spring)\b/.test(lower)) {
      if (api.springTrap) api.springTrap();
      return "SNAP! Screen trap sprung. Say “reset” when you want out.";
    }

    if (/\b(reset|release|open|untrap|free)\b/.test(lower)) {
      if (api.resetTrap) api.resetTrap();
      return "Trap reset. Jaws open again.";
    }

    if (/\b(hello|hi|hey|yo)\b/.test(lower)) {
      return name
        ? `Hey ${name}! I'm still here — persistent and ready.`
        : "Hey! I'm Agent Sumon, your always-on assistant. What should we do?";
    }

    if (/\b(thank|thanks|ty)\b/.test(lower)) {
      return "Anytime. That's what a persistent agent is for.";
    }

    if (/\b(who are you|what are you)\b/.test(lower)) {
      return "I'm Agent Sumon — a persistent page assistant. I replace hunting through UI; just tell me what you want. I keep chat + your name in local storage.";
    }

    return name
      ? `${name}, I'm not sure about that yet. Say “help” for commands, or ask me to ring / snap / reset.`
      : 'Not sure I caught that. Say “help”, or try “ring the alarm” / “snap the trap”.';
  }

  function handleSubmit(event) {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    pushMessage("user", text);
    thinkPulse(true);
    agentStatus.textContent = "Thinking…";

    window.setTimeout(() => {
      const reply = replyFor(text);
      thinkPulse(false);
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Online — listening";
      // If memory was cleared, welcome already rendered; still add reply
      if (
        state.messages.length === 1 &&
        state.messages[0].role === "agent" &&
        /\b(clear memory|forget me|reset memory|wipe)\b/i.test(text)
      ) {
        pushMessage("agent", reply);
      } else {
        pushMessage("agent", reply);
      }
    }, 280 + Math.min(420, text.length * 8));
  }

  launcher.addEventListener("click", () => setOpen(true));
  if (openChatBtn) openChatBtn.addEventListener("click", () => setOpen(true));
  closeBtn.addEventListener("click", () => setOpen(false));
  form.addEventListener("submit", handleSubmit);

  if (clearMemoryBtn) {
    clearMemoryBtn.addEventListener("click", () => {
      state = defaultState();
      saveState();
      renderMessages();
      agentStatus.textContent = "Memory cleared — still online";
      setOpen(true);
      pushMessage(
        "agent",
        "Wiped. I'm still your persistent assistant — just starting fresh."
      );
    });
  }

  agentFigure.addEventListener("click", () => setOpen(true));

  renderMessages();
  agentStatus.textContent = state.userName
    ? `Welcome back, ${state.userName}`
    : "Persistent agent on standby";
})();
