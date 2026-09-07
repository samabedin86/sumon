# Alarm Man, Screen Trap & Agent Sumon

Interactive characters on one page:

1. **Alarm Man** — anthropomorphic alarm clock that rings
2. **Screen Trap** — bear trap that snaps and closes metal jaws over the whole display
3. **Agent Sumon** — persistent AI assistant that replaces hunting for buttons; chat + memory survive page reloads

## Run

```bash
python3 -m http.server 8000
```

Visit http://localhost:8000

## Controls

### Alarm Man
- Click the character to toggle ringing
- **Ring!** / **Snooze**

### Screen Trap
- Click the trap or **SNAP!** — jaws slam shut over the screen with a **GOTCHA!**
- Click the overlay or **Reset** to open the trap again

### Agent Sumon (persistent assistant)
- Open via the floating **Agent** button, the character, or **Chat**
- Try: `ring the alarm`, `snap the trap`, `reset`, `status`, `my name is …`, `help`
- Conversation and your name are stored in `localStorage` so the assistant stays persistent across reloads
- **Clear memory** wipes chat history and remembered name
