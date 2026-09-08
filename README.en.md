<div align="center">

<img src="docs/icon-presence-scheduled.svg?v=18" width="64" alt="scheduled"/>
<img src="docs/icon-presence-urgent.svg?v=18" width="64" alt="urgent"/>
<img src="docs/icon-presence-overdue.svg?v=18" width="64" alt="overdue"/>

# dsh-session-scheduler — In-Session Scheduled Message Plugin

[中文](./README.md) | **English**

</div>

> Set reminders for yourself inside DSH: when the time comes, a message lands in **this same conversation** — even if you have closed the browser.

Existing DSH scheduling options each miss a piece: the built-in scheduler is exposed only to the model (users cannot operate it directly); sleep-send lives in the browser and dies when the page closes; Host Automations always create *new* sessions. This plugin fills the gap: **set by you, delivered into the current conversation, driven server-side, available across devices**.

---

## Feature overview

- **Input-bar timer button**: one click opens the schedule panel — smart time slots / custom time / send preview / pending list / countdown chip.
- **Pending dock**: a list above the input box; each item can be **cancelled** individually or **edited inline** via its edit icon.
- **`/later` delayed send**: deliver *the text you are typing right now* later, as yourself (distinct from reminders — see the [mental model](#mental-model-reminder-vs-delayed-send)).
- **Sidebar presence indicator**: conversations with active reminders show a pixel clock in the sidebar (purple = scheduled · amber = fires within 5 min · red = overdue); hover shows count and next fire time.
- **Fires with the page closed**: reminders persist server-side and arrive on time across devices.
- **Anti-spoofing**: due reminders arrive as a `Reminder` notice — they never impersonate you.
- **Multilingual**: follows the DSH UI language (Chinese / English), live without reload.
- **Fork isolation**: child sessions never inherit a parent's reminders.

---

## Screenshots

**Schedule panel** — quick slots / custom time / pending list:

<img src="docs/screenshot-panel.png" width="340" alt="Schedule panel"/>

**Pending dock** — countdown rows above the input box (inline edit / cancel):

<img src="docs/screenshot-dock.png" width="700" alt="Pending dock and input box"/>

**A real due-time firing** — the reminder lands as a notice when the time comes (fires even with the page closed):

<img src="docs/screenshot-fired.png" width="560" alt="Due-time injection message"/>

**Animated demos**:

| Creating a reminder (type → panel → add → dock) | Firing when due (countdown → injection) |
|---|---|
| <img src="docs/docs-scheduler-create.gif" width="480" alt="Create reminder demo"/> | <img src="docs/docs-scheduler-fired.gif" width="480" alt="Due firing demo"/> |

---

## Mental model: reminder vs. delayed send

| Action | Timing | Who "speaks" | What you see |
|---|---|---|---|
| Enter in the input box | Now | You | Normal user bubble |
| Schedule panel / `/schedule <time> <content>` | When due | Reminder | `Reminder · HH:MM · content` notice row |
| `/later <time> <content>` | When due | As yourself | Normal user bubble |

> **`/schedule` is not "delayed send"**: pressing Enter on `/schedule …` sends it *immediately* as a user message; only the **newly generated reminder** is deferred. If you want "say this later as me", use **`/later`**.

---

## Quick start

### Install into DSH

Build in the plugin source directory, then add it to your DSH Web profile:

```sh
cd dsh-session-scheduler
npm install
npm run build

dsh plugin --profile web add "file:/path/to/dsh-session-scheduler"
# restart dsh web to activate
```

> Dev tip: `npm run watch` rebuilds on `src/` changes and runs shape regression tests.

### Your first reminder

1. Open any conversation — a "Schedule" button appears right of the input box;
2. Click it → pick a smart slot, or enter a custom time and content;
3. Confirm → a countdown chip appears next to the button and the dock shows the pending item;
4. When due, a `Reminder` message lands in the conversation — it fires even if you close the page.

---

## Usage guide

### Schedule panel

| Capability | Description |
|---|---|
| Quick chips | One-tap common slots (work hours / tomorrow morning, etc.) — configurable in settings |
| Custom time | Relative (`in 30 minutes`) or absolute (`today 18:00`) |
| Send preview | See the exact due-time form before confirming |
| Task list | All scheduled items, deletable one by one |
| Cancel all | Cancel action on the chip clears every reminder in this conversation |

### Commands

| Command | Effect |
|---|---|
| `/schedule <time> <content>` | Create a reminder (due-time notice injection) |
| `/later <time> <content>` | Delayed send: deliver the content later as yourself |
| `/schedule every <interval> <content>` | Recurring reminder (interval ≥ 5 min) |

The model can also call user tools on your behalf to create/inspect/delete/edit reminders (`user_schedule_create` / `user_schedule_list` / `user_schedule_delete` / `user_schedule_edit`).

### Sidebar presence indicator

Conversations with active reminders show a pixel clock in their sidebar row (alongside the "active" orb):

| Color | Meaning |
|---|---|
| Purple | Has scheduled reminders |
| Amber | Next fire within 5 minutes |
| Red | Overdue (waiting for the session to become idle) |

Hover shows "count · next fire time".

---

## Long-text reminders

Reminder content is limited to **1000 characters** by default. For longer content, enable `allowLongPrompts` in **DSH Settings → Plugins → Session Scheduler** and set `maxPromptChars`.

- **Good for**: code snippets, meeting notes, long quotes, cross-device notes/todos.
- **Not recommended**: text that could read as instructions (longer content = larger injection surface); a shared public profile (anyone could raise the limit).

---

## Configuration

Works out of the box. Adjust in **DSH Settings → Plugins → Session Scheduler** (applies live, no restart):

| Field | Description | Default |
|---|---|---|
| Show schedule button | Whether the timer button shows on the input bar (hiding it never affects existing reminders or the dock) | Shown |
| Max schedules per session | Max reminders allowed in one conversation | 100 |
| Allow long prompts | Lift the 1000-character default cap | Off |
| Custom cap | Character cap when `allowLongPrompts` is on | 1000 |
| Work hours / lunch / night quiet | Five HH:mm fields driving smart slots and auto-scheduling | See settings page |

> Advanced: defaults can also be overridden at startup via `cordis.patch.yml` (e.g. `maxSchedules`) — see `docs/` and the schema.

---

## Technical documentation

Developer- and maintainer-oriented content has moved out of this README:

- [Architecture & data flow](./docs/architecture.md) — host/client layering, event flow, layout, scheduler rationale
- [Key design decisions](./docs/design-decisions.md) — `source` field, slash channel, fork isolation, anti-spoofing tradeoffs
- [Verification & acceptance criteria](./docs/verification.md) — tests, live E2E, cross-kernel compatibility, AC table

## References

- PRD & design docs: `prd.md` and `docs/` in the project root (workspace-level, outside this package)
- dsh-schedule source analysis: `../references/dsh-schedule-analysis.md`
- dsh-sleep-send source analysis: `../references/dsh-sleep-send-analysis.md`

## License

MIT

---

<div align="center">

**Sidebar presence indicator** · scheduled · urgent (≤ 5 min) · overdue

<img src="docs/icon-presence-scheduled.svg?v=18" width="48" alt="scheduled"/>
<img src="docs/icon-presence-urgent.svg?v=18" width="48" alt="urgent"/>
<img src="docs/icon-presence-overdue.svg?v=18" width="48" alt="overdue"/>

</div>
