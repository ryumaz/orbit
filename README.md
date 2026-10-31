# orbit

**Teach one. Learn one.** A skill exchange where people teach each other for half an hour and pay with credits instead of money.

**Live:** [orbit.voids.wtf](https://orbit.voids.wtf) · Admin portal: [orbit.voids.wtf/admin](https://orbit.voids.wtf/admin/) (admins only)

Built in 36 hours for **Innovista**, problem statement 05: *Micro-Mentorship & Skill Exchange Hub*.

## Team: Void Century

| Name | Role |
|---|---|
| **Niraj Singh Mehta** | Design, full-stack development and deployment |
| **Udit Saklani** | Team leader; testing and QA on mobile and desktop |
| **Urvashi Bhatt** | Pitch |
| **Naval Panda** | Pitch |
| **Mitali Loshali** | Pitch |

## The idea

Everyone is good at something: guitar, Valorant aim, calculus, cooking. orbit finds the person who already knows what you want to learn. You book them for 15 to 60 minutes and pay with credits you earned by teaching someone else what you know, and revising your own skill while you explain it. No money changes hands, and the credits only move when the class actually helped.

## What it does

**Joining**
- Sign up with Google, GitHub, Discord or email; every new member gets 30 credits.
- Pick a username, a photo, a country and the languages you speak.
- List what you teach and what you want to learn, with a price per skill (harder skills can cost more).

**Finding someone**
- Search any skill, game or subject. Sort by best rated, lowest price or newest, filter by language.
- Every teacher shows a rating, price, badges and a live online / idle / busy / offline dot.
- Send a request with one line about what you need. The teacher gets a card and a chime on any page, and can accept right there.

**The class room**
- Video or voice calls straight between the two browsers (WebRTC), with screen share, fullscreen, and automatic quality for weak connections.
- A shared whiteboard both people draw on live.
- For coding skills, a shared code editor that runs JavaScript and Python in the browser and flags errors as you type.
- A saved chat with photos, videos, PDFs and slides; files wait in a preview tray until you press Send.
- A countdown in the header. When time is up the call ends and the learner is asked to release the credits or open a dispute.
- Private notes you can save as a file, and a notice when the other person joins the room.

**Credits you can trust**
- Credits are held when the teacher accepts and only move when the learner says it worked.
- 24 hours to open a dispute; with no dispute, the teacher is paid automatically.
- Both people can agree to end early and split the credits.
- Requests expire after 5 hours if nobody answers, and can be withdrawn before they're accepted.
- Balances are never stored: they are summed from a ledger of every credit movement.
- After a class, both sides rate each other with 1 to 5 stars.

**Extras**
- 14 badges (first class taught, Mentor, Five stars, Polyglot, Early orbiter…) with an "unlocked" card.
- Status like Discord: online, idle, do not disturb (really mutes sounds and pop-ups) or invisible.
- The whole site in 32 languages, translated by AI, including right-to-left Arabic, Urdu and Hebrew.
- Vortex, a 3D robot helper that answers questions and passes messages to support.
- Audit log of every step, support page, privacy policy and terms, account deletion with password check.
- Works on phones.

**orbit control (admin portal)**, a separate app with its own login
- Overview of members, classes and credits; classes attended, completed and failed; ratings by skill.
- Settle disputes (after reading the class chat), review reports, answer support messages.
- Member panel: add or remove credits, suspend, make admin, clear a bio or photo.
- Delete fake or abusive reviews; full searchable log of everything, downloadable as CSV.
- A site-wide notice banner, and Discord alerts (with a role ping) for disputes and reports.

## Tech stack

| Part | What we used |
|---|---|
| Frontend | React 19, Vite 7, Tailwind CSS 4, React Router |
| Code editor | CodeMirror 6; code runs in Web Workers, Python through Pyodide (WebAssembly) |
| 3D and drawing | three.js for Vortex, HTML Canvas for the whiteboard |
| Backend | Supabase: PostgreSQL, row level security, SQL functions and triggers, pg_cron, pg_net |
| Accounts | Supabase Auth: email and password, Google, GitHub and Discord sign-in |
| Live features | Supabase Realtime: notifications, chat, presence, whiteboard sync, call signalling |
| Files | Supabase Storage, private bucket with short-lived links |
| Calls | WebRTC, peer to peer, with an optional TURN relay |
| Hosting | Cloudflare Pages, with Pages Functions for translation and the call relay |
| AI | Cloudflare Workers AI (Llama 3.3 70B) for translation, cached at the edge |

There is no server of our own to run: the rules that matter (moving credits, disputes, who can see what) live inside the database, so the website can't be used to cheat.

## Run it locally

Needs Node 20.19 or newer.

```bash
npm install
npm run dev
```

- orbit: http://localhost:5530
- orbit control: http://localhost:5530/admin/

`npm run build` builds both apps into `dist/` (orbit at `dist/index.html`, the admin portal at `dist/admin/index.html`) and also writes `orbit.html`, a single file you can open with a double-click.

## Deploying

Cloudflare Pages builds the repo with `npm run build` and serves `dist/`. The project needs:

- A **Workers AI binding** named `AI` (for translation). Without it, orbit stays in English.
- Optional **call relay** secrets: `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (any TURN provider), or `TURN_KEY_ID` and `TURN_KEY_API_TOKEN` (Cloudflare Realtime). Without them, calls stay peer to peer only.

In Supabase, the site URL and redirect URLs point at the live domain, and the Google, GitHub and Discord providers are switched on.

## Database

`supabase/migrations/` holds the whole schema in order: profiles and the credit ledger, skills and prices, sessions and escrow, reviews and the audit log, disputes, reports, chat and files, the admin tools, status and badges. Apply them in filename order in the Supabase SQL editor.

`supabase/tests/` holds SQL checks you can paste into the SQL editor; each one rolls itself back, so nothing is saved.

The website only ships the publishable key. Every table has row level security; admin data comes from functions that answer only for accounts in the `admins` table, and they show names and handles, never emails.

## Where things are

```
src/
  pages/        the screens: landing, find, profile, sessions, room, credits, settings, docs, support
  components/   shell, chat, whiteboard, code editor, calls, badges, Vortex, dialogs
  lib/          account, calls, presence, translation, code runner, Supabase client
  admin/        orbit control, the admin portal
functions/api/  Cloudflare functions: translate, turn
supabase/       migrations and tests
public/         the 3D robot model
```

## Credits

The 3D robot, fonts and libraries orbit uses are listed in [CREDITS.md](CREDITS.md).
