(() => {
  const alarmMan = document.getElementById("alarmMan");
  const ringBtn = document.getElementById("ringBtn");
  const snoozeBtn = document.getElementById("snoozeBtn");
  const status = document.getElementById("status");

  const bearTrap = document.getElementById("bearTrap");
  const snapBtn = document.getElementById("snapBtn");
  const resetTrapBtn = document.getElementById("resetTrapBtn");
  const trapStatus = document.getElementById("trapStatus");
  const screenTrap = document.getElementById("screenTrap");

  let ringing = false;
  let trapped = false;
  let audioCtx = null;
  let ringInterval = null;
  let trapResetTimer = null;

  function ensureAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function beep() {
    const ctx = ensureAudio();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.value = 880;
    gain.gain.value = 0.05;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
    osc.stop(ctx.currentTime + 0.13);
  }

  function snapSound() {
    const ctx = ensureAudio();
    if (!ctx) return;

    // Metallic CLANG
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.25);
    gain.gain.value = 0.12;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.stop(ctx.currentTime + 0.32);

    // High click
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = "square";
    click.frequency.value = 1200;
    clickGain.gain.value = 0.08;
    click.connect(clickGain);
    clickGain.connect(ctx.destination);
    click.start();
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    click.stop(ctx.currentTime + 0.09);
  }

  function startRing() {
    if (ringing) return;
    ringing = true;
    alarmMan.classList.add("ringing");
    status.textContent = "BRRRING! WAKE UP!";
    status.classList.add("loud");

    beep();
    ringInterval = setInterval(beep, 220);
  }

  function stopRing() {
    if (!ringing) return;
    ringing = false;
    alarmMan.classList.remove("ringing");
    status.textContent = "zzz… snoozing";
    status.classList.remove("loud");

    if (ringInterval) {
      clearInterval(ringInterval);
      ringInterval = null;
    }
  }

  function springTrap() {
    if (trapped) return;
    trapped = true;

    bearTrap.classList.remove("set");
    bearTrap.classList.add("snapped");
    trapStatus.textContent = "SNAP! Screen trapped!";
    trapStatus.classList.add("caught");

    snapSound();

    screenTrap.classList.add("closing", "active");
    screenTrap.setAttribute("aria-hidden", "false");

    if (trapResetTimer) clearTimeout(trapResetTimer);
    trapResetTimer = setTimeout(() => {
      // Keep jaws closed a moment, then allow click to dismiss
    }, 400);
  }

  function resetTrap() {
    trapped = false;
    bearTrap.classList.remove("snapped");
    bearTrap.classList.add("set");
    trapStatus.textContent = "Trap is set… waiting…";
    trapStatus.classList.remove("caught");

    screenTrap.classList.remove("active", "closing");
    screenTrap.setAttribute("aria-hidden", "true");

    if (trapResetTimer) {
      clearTimeout(trapResetTimer);
      trapResetTimer = null;
    }
  }

  alarmMan.addEventListener("click", () => {
    if (ringing) stopRing();
    else startRing();
  });

  ringBtn.addEventListener("click", startRing);
  snoozeBtn.addEventListener("click", stopRing);

  bearTrap.addEventListener("click", springTrap);
  snapBtn.addEventListener("click", springTrap);
  resetTrapBtn.addEventListener("click", resetTrap);

  // Click overlay to release after snap
  screenTrap.addEventListener("click", resetTrap);

  // Initial states
  status.textContent = "zzz… sleeping";
  bearTrap.classList.add("set");
  trapStatus.textContent = "Trap is set… waiting…";
})();
