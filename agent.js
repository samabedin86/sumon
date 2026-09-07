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
        text: "Agent Sumon here. I stick around after refresh. Try Ring, Snap, or say your name.",
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
      agentStatus.textContent = "Online";
    } else {
      agentFigure.classList.remove("listening", "thinking");
      agentStatus.textContent = "On standby";
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
      return `Saved — hi ${state.userName}.`;
    }

    if (/\b(who am i|what'?s my name|do you remember me)\b/.test(lower)) {
      return name ? `You're ${name}.` : "No name yet. Say “my name is …”";
    }

    if (/\b(help|what can you do|commands)\b/.test(lower)) {
      return "ring · snooze · snap · reset · status · my name is … · clear memory";
    }

    if (/\b(clear memory|forget me|reset memory|wipe)\b/.test(lower)) {
      state = defaultState();
      saveState();
      renderMessages();
      pushMessage("agent", "Memory cleared.");
      return null;
    }

    if (/\b(status|what'?s happening|state)\b/.test(lower)) {
      const ringing = api.isRinging ? api.isRinging() : false;
      const trapped = api.isTrapped ? api.isTrapped() : false;
      const who = name ? ` · ${name}` : "";
      return `Alarm ${ringing ? "ON" : "off"} · Trap ${trapped ? "CLOSED" : "set"}${who}`;
    }

    if (/\b(ring|alarm|wake|brring|wake up)\b/.test(lower)) {
      if (api.startRing) api.startRing();
      return name ? `Ringing, ${name}.` : "Ringing.";
    }

    if (/\b(snooze|stop|quiet|silence|shut up)\b/.test(lower)) {
      if (api.stopRing) api.stopRing();
      return "Snoozed.";
    }

    if (/\b(snap|trap|catch|gotcha|spring)\b/.test(lower)) {
      if (api.springTrap) api.springTrap();
      return "SNAP!";
    }

    if (/\b(reset|release|open|untrap|free)\b/.test(lower)) {
      if (api.resetTrap) api.resetTrap();
      return "Trap open.";
    }

    if (/\b(hello|hi|hey|yo)\b/.test(lower)) {
      return name ? `Hey ${name}.` : "Hey — what's up?";
    }

    if (/\b(thank|thanks|ty)\b/.test(lower)) {
      return "Anytime.";
    }

    if (/\b(who are you|what are you)\b/.test(lower)) {
      return "Agent Sumon — persistent page assistant.";
    }

    return "Say help, or tap Ring / Snap.";
  }

  function sendText(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushMessage("user", trimmed);
    thinkPulse(true);
    agentStatus.textContent = "…";

    window.setTimeout(() => {
      const reply = replyFor(trimmed);
      thinkPulse(false);
      agentFigure.classList.add("listening");
      agentStatus.textContent = "Online";
      if (reply != null) pushMessage("agent", reply);
    }, 180);
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
      state = defaultState();
      saveState();
      renderMessages();
      agentStatus.textContent = "Memory cleared";
      setOpen(true);
      pushMessage("agent", "Fresh start.");
    });
  }

  agentFigure.addEventListener("click", () => setOpen(true));

  renderMessages();
  agentStatus.textContent = state.userName
    ? `Welcome back, ${state.userName}`
    : "On standby";
})();
