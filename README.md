# orbit

By team Void Century.


## Team

**Void Century**

- Niraj Singh Mehta:  design, full-stack development and deployment
- Udit saklani : Team leader ,  Testing And QA on mobile and desktop
- Urvashi Bhatt: pitch
- Naval Panda : Pitch

Peer micro-mentorship for students. Book twenty minutes in a shared editor with someone who has solved your exact problem, and pay with credits you earned by helping someone else.

Built for Innovista (36-hour hackathon), problem statement 05: Micro-Mentorship & Skill Exchange Hub.

## Run it

Needs Node 20.19 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5530.

To get a version you can open with a double-click, run `npm run build` once. It writes `orbit.html` (one self-contained file) next to this README. Opening `index.html` directly does not work: that is the source entry, and it only says which file to open instead.

## Demo in two tabs

Each browser tab is one student (stored per tab), and both tabs share the same data, so a whole session can run between two windows:

1. On the home page, pick **Meera** in "Try it as a sample student".
2. Open a second tab, go to the home page, and pick **Arjun**.
3. In either tab, open **Sessions** and join the live room. Type in one tab and watch the other.
4. As Meera, press **It works now**, then **Send 10 ¤**. Both tabs see the credits move, once.
5. Check **Credits**: the balance is the sum of the ledger rows, shown on the page.

To test booking: as Meera, find someone on **Find help**, send a request, then switch the other tab to that person and accept it in **Sessions**. Accepting puts the credits on hold; confirming the session moves them.

"Reset demo data" in the footer puts everything back to the starting sample data.

## How credits stay fair

- Every change is its own ledger row (who, how many, why, when). Balances are never stored; they are summed from the rows.
- When a request is accepted, the learner's credits go on hold (a negative row), so they cannot be spent twice.
- Only the learner can confirm a session works. That writes one `earn` row for the mentor. A second confirm is refused by the status check and by a check for an existing `earn` row for the same session.
- Cancelling a running session writes a refund row.
- The sample history is replayed through the same functions on first load, so every number on screen came from rows the system wrote.

## Where things are

```
src/
  lib/store.js     mock backend: sessions, ledger, rules (same shape the real API will have)
  lib/seed.js      sample students, past sessions, starter code
  lib/me.js        which student this tab is
  glyph/           everything drawn from characters: hero hands, portraits, balance mosaic
  components/      nav, footer, CodeMirror editor, hourglass
  pages/           Home, Find, Profile, Sessions, Room, Credits
```

## Not built yet (backend phase)

- Real accounts and a database. Today the data lives in the browser's localStorage, which is why two tabs in one browser share it.
- Real-time over the network. The editor syncs between tabs of one browser; the plan is Yjs over WebSockets so two laptops can share a room.
- Remote cursors, helpfulness ratings and bonus credits, session notes saved to the profile.

## Design

One-bit dither on true black, like an old print. The home page is a Three.js shader: two hands built from 3D shapes in GLSL, rendered once into a normal buffer, then lit every frame (the light follows the cursor), dithered with an 8x8 Bayer matrix, with film grain and a little chromatic aberration. Moving the cursor near the gap pulls the fingertips together; scrolling fades them out. It renders one texel per dither dot and pauses when the tab is hidden or the hero is off screen. Student portraits and the credit balance use the same dither. Amber appears only for credits and at the point where the hands meet. Type is Archivo (variable width) and Victor Mono. All sample people are made up.

## Backend (Supabase)

Accounts and credits run on Supabase (project `orbit`, org Void Century).

- `supabase/migrations/` holds the schema: profiles, the credit ledger, row level security, and a signup trigger that gives every new member 30 welcome credits, once.
- `supabase/tests/` holds a SQL check you can paste into the SQL editor. It rolls itself back.
- Email sign-up logs you straight in (email confirmation is off).
- The app only ships the publishable key. Members can read their own ledger but never write it.

Offers, booking and live rooms still use the sample data in `src/lib/store.js` until their tables are added.
