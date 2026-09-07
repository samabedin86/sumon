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
| `brief` | Time, greeting, open tasks, mood |
| `todo buy milk` | Add a task (persists) |
| `todos` / `done 1` | List or complete tasks |
| `note call mom` | Save a note |
| `remind stretch in 5m` | Timed nudge |
| `focus 25` | Focus / pomodoro timer + HUD |
| `decide tea or coffee` / `coin` | Quick decisions |
| `calc 12*8` | Math |
| `mood happy` | Mood check-in |
| `idea` / `breathe` | Spark or calm |
| `ring` / `snap` | Still controls the play toys |

Chat, todos, notes, moods, and focus state survive reloads via `localStorage`.

## Toy controls

### Alarm Man
- Click to toggle ringing · **Ring!** / **Snooze**

### Screen Trap
- **SNAP!** closes jaws · click overlay or **Reset** to open
