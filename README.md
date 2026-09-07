# Agent Sumon — creative persistent assistant

Interactive page with toys **and** a real multi-task agent:

1. **Alarm Man** — anthropomorphic alarm clock (play)
2. **Screen Trap** — jaws snap over the display (play)
3. **Agent Sumon** — persistent assistant for everyday work

## Run

```bash
python3 -m http.server 8000
```

Visit http://localhost:8000

## Agent skills

| Say / tap | What it does |
|-----------|----------------|
| `brief` | Day snapshot + learned insights |
| `todo buy milk` | Add a task (persists) |
| `note call mom` | Save a note |
| `remind stretch in 5m` | Timed nudge |
| `focus` / `focus 25` | Focus timer (learns your usual length) |
| `prefer tea` / `prefer focus 15` | Teach a preference |
| `learn I work nights` | Store a habit/fact |
| `profile` | Show what it has learned |
| `act` | Agent picks & runs the next best action |
| `proactive on/off` | Toggle auto-suggestions |
| `decide tea or coffee` | Chooses — biased by learned prefs |
| `mood happy` / `idea` / `breathe` | Check-in, spark, calm |

The agent tracks skill usage, focus habits, decision wins, and facts in `localStorage`, then **acts** (start focus, remind, breathe) from those patterns.

## Toy controls

### Alarm Man
- Click to toggle ringing · **Ring!** / **Snooze**

### Screen Trap
- **SNAP!** closes jaws · click overlay or **Reset** to open
