(() => {
  const roamer = document.getElementById("samRoamer");
  const bubble = document.getElementById("samBubble");
  const hint = document.getElementById("roamHint");
  const panel = document.getElementById("agentPanel");
  if (!roamer) return;

  const SIZE = 112;
  let x = Math.random() * Math.max(40, window.innerWidth - SIZE - 40) + 20;
  let y = Math.random() * Math.max(40, window.innerHeight - SIZE - 120) + 40;
  let vx = (Math.random() * 0.7 + 0.35) * (Math.random() < 0.5 ? -1 : 1);
  let vy = (Math.random() * 0.55 + 0.25) * (Math.random() < 0.5 ? -1 : 1);
  let paused = false;
  let dragging = false;
  let dragDx = 0;
  let dragDy = 0;
  let moved = false;
  let lastBubble = 0;
  let raf = 0;

  const lines = [
    "Hey — tap me!",
    "I wander & listen.",
    "Got a task?",
    "Say act…",
    "Drag me around!",
    "Mic works too.",
  ];

  function bounds() {
    return {
      maxX: Math.max(8, window.innerWidth - SIZE - 8),
      maxY: Math.max(8, window.innerHeight - SIZE - 72),
    };
  }

  function apply() {
    roamer.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    roamer.classList.toggle("face-left", vx < 0);
    roamer.classList.toggle("moving", !paused && !dragging && (Math.abs(vx) > 0.05 || Math.abs(vy) > 0.05));
  }

  function showBubble(text, ms = 2200) {
    if (!bubble) return;
    bubble.hidden = false;
    bubble.textContent = text;
    window.clearTimeout(showBubble._t);
    showBubble._t = window.setTimeout(() => {
      bubble.hidden = true;
    }, ms);
  }

  function tick() {
    if (!paused && !dragging) {
      const { maxX, maxY } = bounds();
      x += vx;
      y += vy;
      if (x <= 8) {
        x = 8;
        vx = Math.abs(vx);
      } else if (x >= maxX) {
        x = maxX;
        vx = -Math.abs(vx);
      }
      if (y <= 8) {
        y = 8;
        vy = Math.abs(vy);
      } else if (y >= maxY) {
        y = maxY;
        vy = -Math.abs(vy);
      }
      // gentle wander drift
      if (Math.random() < 0.008) {
        vx += (Math.random() - 0.5) * 0.35;
        vy += (Math.random() - 0.5) * 0.35;
        const sp = Math.hypot(vx, vy) || 1;
        const target = 0.55 + Math.random() * 0.45;
        vx = (vx / sp) * target;
        vy = (vy / sp) * target;
      }
      if (Date.now() - lastBubble > 12000 && Math.random() < 0.004) {
        lastBubble = Date.now();
        showBubble(lines[Math.floor(Math.random() * lines.length)]);
      }
    }
    apply();
    raf = requestAnimationFrame(tick);
  }

  function pauseWander(on) {
    paused = on;
    roamer.classList.toggle("paused", on);
  }

  // Sync pause when chat opens/closes
  const mo = new MutationObserver(() => {
    const open = panel && panel.classList.contains("open");
    pauseWander(open);
    if (open) showBubble("Listening…", 1600);
  });
  if (panel) mo.observe(panel, { attributes: true, attributeFilter: ["class"] });

  function pointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    dragging = true;
    moved = false;
    pauseWander(true);
    const pt = e.touches ? e.touches[0] : e;
    dragDx = pt.clientX - x;
    dragDy = pt.clientY - y;
    roamer.classList.add("dragging");
    e.preventDefault();
  }

  function pointerMove(e) {
    if (!dragging) return;
    const pt = e.touches ? e.touches[0] : e;
    const { maxX, maxY } = bounds();
    const nx = pt.clientX - dragDx;
    const ny = pt.clientY - dragDy;
    if (Math.hypot(nx - x, ny - y) > 4) moved = true;
    x = Math.min(maxX, Math.max(8, nx));
    y = Math.min(maxY, Math.max(8, ny));
    apply();
  }

  function pointerUp() {
    if (!dragging) return;
    dragging = false;
    roamer.classList.remove("dragging");
    const open = panel && panel.classList.contains("open");
    if (!moved) {
      // click → open chat via launcher/agent API
      const launch = document.getElementById("agentLauncher");
      if (launch) launch.click();
      showBubble("Hi!", 1200);
    } else if (!open) {
      pauseWander(false);
      // give a nudge in a random direction after drag
      vx = (Math.random() * 0.7 + 0.3) * (Math.random() < 0.5 ? -1 : 1);
      vy = (Math.random() * 0.55 + 0.25) * (Math.random() < 0.5 ? -1 : 1);
    }
  }

  roamer.addEventListener("mousedown", pointerDown);
  roamer.addEventListener("touchstart", pointerDown, { passive: false });
  window.addEventListener("mousemove", pointerMove);
  window.addEventListener("touchmove", pointerMove, { passive: false });
  window.addEventListener("mouseup", pointerUp);
  window.addEventListener("touchend", pointerUp);

  window.addEventListener("resize", () => {
    const { maxX, maxY } = bounds();
    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    apply();
  });

  if (hint) {
    window.setTimeout(() => hint.classList.add("fade"), 5000);
  }

  // Expose for agent / debugging
  window.SamRoam = {
    pause: pauseWander,
    say: showBubble,
    goTo(nx, ny) {
      const { maxX, maxY } = bounds();
      x = Math.min(maxX, Math.max(8, nx));
      y = Math.min(maxY, Math.max(8, ny));
      apply();
    },
  };

  apply();
  raf = requestAnimationFrame(tick);
})();
