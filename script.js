(() => {
  const alarmMan = document.getElementById("alarmMan");
  const ringBtn = document.getElementById("ringBtn");
  const snoozeBtn = document.getElementById("snoozeBtn");
  const status = document.getElementById("status");

  let ringing = false;
  let audioCtx = null;
  let oscillator = null;
  let gainNode = null;
  let ringInterval = null;

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
    if (oscillator) {
      try {
        oscillator.stop();
      } catch (_) {
        /* already stopped */
      }
      oscillator = null;
      gainNode = null;
    }
  }

  alarmMan.addEventListener("click", () => {
    if (ringing) stopRing();
    else startRing();
  });

  ringBtn.addEventListener("click", startRing);
  snoozeBtn.addEventListener("click", stopRing);

  // Idle sleeping status after load
  status.textContent = "zzz… sleeping";
})();
