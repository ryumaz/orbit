// What Vortex knows. Each topic has a few patterns; the topic with the most matches
// answers (on a tie, the one listed first). Answers can use the signed-in member's
// own numbers, and offer buttons that go to the right page (or hand over to support).
//
// To put a real model behind Vortex later, replace answer() with a call to your own
// endpoint and keep these topics as its first try.

const T = (id, keys, reply, actions = []) => ({ id, keys, reply, actions })
const pick = (list) => list[Math.floor(Math.random() * list.length)]

const TOPICS = [
  // ---------- small talk ----------
  T('greet', [/\b(hi|hii+|hello|hey+|heya|hiya|howdy|yo|namaste|hola|good (morning|evening|afternoon))\b/],
    (c) => `Hi${c.first ? ` ${c.first}` : ''}! I'm Vortex. Ask me anything about orbit: credits, booking, calls, disputes, badges, your profile. If I don't know, I'll pass you to support.`),
  T('who', [/who are you|your name|are you (a |an )?(bot|ai|robot|human|real)/, /\bvortex\b/],
    () => "I'm Vortex, orbit's helper. I answer the common questions from what I know about orbit. For anything personal or tricky, press \"Talk to support\" and a real person reads it."),
  T('new', [/are you new|new here|first time|just joined|i'?m new|where do i start|getting started/],
    (c) => c.live
      ? "Welcome aboard! Three things to do first: add what you can teach (so people can book you), add what you want to learn, then try Learn something to book your first class. Your first class earns you a badge."
      : "New here? Make an account (it's free, with 30 credits to start), add what you can teach and what you want to learn, then book your first class from Learn something.",
    [['Make an account', '/join'], ['Learn something', '/find']]),
  T('made', [/who (made|built|created|designed) (you|this|orbit)|your (creator|maker|team)|void century/],
    () => 'orbit (and me) were built by team Void Century for the Innovista hackathon, problem statement 05: a skill exchange where people teach each other for credits.'),
  T('feel', [/how are you|how r u|\bsup\b|how'?s it going|what'?s up|wh?a?ss?up|\bwsp\b|\bwyd\b|\bhbu\b|you ok|how do you feel/],
    () => pick([
      "Not much, just orbiting at a respectable speed. What's up with you?",
      "Chilling in low orbit, fully charged. What can I do for you?",
      'All systems nominal! Want to learn something today, or teach?',
    ])),
  T('joke', [/\bjoke|make me laugh|something funny|\bfunny\b|pun\b/],
    () => pick([
      "Why don't robots ever panic? We have nerves of steel. And a reboot button.",
      "I tried to teach a black hole maths once. It absorbed everything and still asked for more credits.",
      "Why did the student bring a ladder to orbit? Someone said the classes were next level.",
      "My favourite subject is space. Mostly because there's a lot of it.",
    ])),
  T('laugh', [/^(lol|lmao|lmfao|haha+|hehe+|xd|rofl|😂|🤣)+[!. ]*$/],
    () => pick(['Glad I could orbit a smile your way.', 'My humour circuits are working, then!', 'I knew that one would land.'])),
  T('bruh', [/^(bruh+|bro+|ok+|okay|k|hmm+|mhm|yeah|yep|nah|nope|cool)[!. ]*$/],
    () => pick(['Fair enough. Anything I can help with?', "I'll take that as a vibe. Need anything?", 'Noted. I am, as always, at your service.'])),
  T('bye', [/\b(bye|goodbye|see ya|see you|cya|gn|good ?night|later|ttyl)\b/],
    (c) => pick([`Bye${c.first ? ` ${c.first}` : ''}! I'll keep the orbit warm.`, 'See you around the galaxy.', 'Later! Go teach someone something cool.'])),
  T('bored', [/\bbored|nothing to do|kill time/],
    () => "Bored? Perfect time to learn something new for 15 minutes. Pick a random skill on Learn something and surprise yourself.",
    [['Learn something', '/find']]),

  // ---------- the idea ----------
  T('what', [/what is (this|orbit|it)|how (does|do) (it|orbit|this|the site) work|explain|about orbit|what can i do/, /\bhow it works\b/],
    () => 'orbit is a skill swap. You teach what you know (guitar, coding, cooking, a game, a language) and earn credits, and you spend credits learning from other members. Classes are 15 to 60 minutes by video or voice, and the credits only move when the learner says it helped. Teaching also helps you revise your own skill.',
    [['See how it works', '/#how'], ['Find someone to learn from', '/find']]),

  // ---------- credits ----------
  T('balance', [/\b(my )?(balance|wallet)\b/, /how many credits (do )?i (have|got)/, /my credits/],
    (c) => c.live
      ? `You have ${c.balance} credits to spend${c.held ? `, and ${c.held} on hold for classes in progress` : ''}. Every change is listed on your Credits page.`
      : 'Log in and I can tell you your balance. New accounts start with 30 credits.',
    [['Open Credits', '/credits']]),
  T('credits', [/credit|points|coins|currency|\bpay(ment)?\b|money|free/],
    (c) => `Credits are orbit's money. Everyone starts with 30. You earn them by teaching and spend them by learning; each teacher sets a price per 30 minutes.${c.live ? ` You have ${c.balance} right now.` : ''} Real money is never involved.`,
    [['How credits work', '/#escrow'], ['Open Credits', '/credits']]),
  T('price', [/price|cost|how much|\brate\b|charge|expensive|cheap|per (hour|minute)/],
    () => 'Each teacher sets a price per 30 minutes, and can give each skill its own price (exam prep might cost more than game tips). A 15-minute class costs half, an hour costs double (rounded up). You see the exact total before you send a request.',
    [['Set my prices', '/me/skills']]),
  T('dispute', [/disput|ticket|complain|unfair|didn'?t (show|turn up|teach)|no.?show|scam|cheat|wrong (topic|thing)|refund/],
    () => "Something went wrong in a class? As the learner you have 24 hours after it to press \"Open a dispute\" (in the room or on Sessions). The credits stay on hold. orbit staff then open a ticket: you and the teacher each explain what happened in a private thread, staff check the class chat and timeline, and decide: all back to you, all to the teacher, or a split. You get a notification at every step.",
    [['Open Sessions', '/sessions']]),
  T('hold', [/\bhold|held|escrow|get (it|them|my credits) back|didn'?t help|not helpful|auto(matic)?(ally)? paid|24 ?h/],
    () => "When a teacher accepts, your credits go on hold: they leave your wallet but don't reach the teacher yet. They're sent when you press \"It worked\", or automatically 24 hours after the class if nobody opened a dispute. If you both agree to stop early, you split them the way you agreed.",
    [['How credits work', '/#escrow']]),
  T('cancel', [/cancel|end (it )?early|stop (the )?(session|class)|\bquit\b|withdraw|\bsplit\b|leave (the )?(session|class)/],
    () => 'Before a teacher accepts, you can withdraw a request for free (requests also expire after 5 hours with no answer). Once a class has started, either of you can press "End early" in the Session tab and suggest a split; the other person agrees, suggests a different split, or says no. Nothing moves until you both agree.',
    [['Open Sessions', '/sessions']]),
  T('timeup', [/time('?s| is)? up|timer|ran out|over time|when (does|do) (it|the class) end|how long/],
    () => "Every class has a countdown in the room's header. When it hits zero the call ends and the learner is asked how it went: \"It worked\" sends the credits (then you can rate each other), or \"Something went wrong\" opens a dispute."),

  // ---------- teaching and learning ----------
  T('teach', [/\bteach|earn|become (a )?(mentor|teacher)|offer|sell|my skills?|add (a )?skill|mentor/, /(earn|get|make) (more )?credits/],
    () => 'To teach: open Settings → Skills, add what you can teach and set your prices. You then show up when people search, and your public page (orbit.voids.wtf/u/your-handle) can be shared with anyone. When someone books you, you get a card and a chime to accept or decline.',
    [['Edit what I teach', '/me/skills']]),
  T('learn', [/\b(book|learn|find|search|request)\b|someone to teach|session with|class with|how (do|can) i (start|get help)/],
    () => "To learn: open Learn something, search a skill or game, pick someone (check their rating, price and the green online dot), choose a length and send a request with what you need. Nothing is charged until they accept.",
    [['Learn something', '/find']]),
  T('requests', [/incoming|accept|decline|(new|my|pending) requests?|someone (booked|requested)/],
    (c) => c.live
      ? (c.waiting ? `You have ${c.waiting} ${c.waiting === 1 ? 'request' : 'requests'} waiting. Accept or decline them on Sessions.` : 'No requests waiting right now. New ones pop up as a card with a chime on any page, and on Sessions.')
      : 'Requests show up on your Sessions page with a card and a chime. Log in to see yours.',
    [['Open Sessions', '/sessions']]),
  T('limits', [/limit|too (many|fast)|slow down|can'?t send|blocked from/],
    () => "To keep orbit spam-free there are a few gentle limits: 8 requests an hour (and 5 waiting at once), 20 chat messages a minute, and 15 files an hour. Normal use never hits them; if you do, just wait a moment."),

  // ---------- the room ----------
  T('hear', [/\bhear|audio|sound|\bmic|microphone|voice|\bmute|echo|volume|silent/],
    () => 'Can\'t hear each other? Try these in order:\n1. Both of you press Video call or Voice only (being in the room isn\'t enough).\n2. Allow the microphone when the browser asks; check the lock icon next to the address.\n3. If you see "Tap to hear", tap it; browsers sometimes block sound until you click.\n4. Make sure you aren\'t muted, then refresh both tabs and join again.'),
  T('camera', [/camera|webcam|\bvideo\b|screen ?share|share (my )?screen|full ?screen/],
    () => 'Turn your camera on or off during a call; joining with "Voice only" works too, and you can switch the camera on later. "Share screen" swaps your camera for your screen. Each video tile has a full screen button in its corner.'),
  T('connect', [/connect|connecting|reconnect|\blag|laggy|slow call|network|wi-?fi|firewall|\bvpn\b|freez|quality/],
    () => "Laggy or stuck call? Calls go straight between your two browsers, and some networks (college or office Wi-Fi, VPNs) get in the way. Try:\n1. A phone hotspot instead of college Wi-Fi.\n2. Switch quality to Data saver or Voice only in the call panel.\n3. Turn off VPNs and close heavy tabs or downloads.\n4. Use Chrome or Edge on both sides."),
  T('code', [/\bcode\b|coding|editor|python|javascript|\brun\b|program|input\(\)|compile|error|syntax/],
    () => "Coding classes get a shared code editor next to the whiteboard. Pick JavaScript or Python and press Run (or Ctrl+Enter): it runs in your browser, flags syntax errors as you type, and both of you see the output. If your program uses input(), the run pauses and asks you right under the output; type the answer and press Enter."),
  T('board', [/whiteboard|\bdraw|\bboard\b|sketch/],
    () => 'Every room has a shared whiteboard; you both see each stroke live. Pick a colour and size, use Eraser, Undo (it only takes back your own lines) and Clear (it clears for both of you).'),
  T('files', [/file|photo|image|pdf|ppt|slides|attach|upload|send (a )?(pic|picture|video)/],
    () => "In the room chat, press the paperclip (or paste, or drag a file in) to share photos, videos, PDFs, slides or documents, up to 25 MB each. Files wait in a preview tray so you can check them, then press Send. They stay saved with the class."),
  T('chat', [/\bchat|message|\btext\b/],
    () => "The room's Chat is saved with the class, so it's there after a refresh or on another device. It arrives instantly for the other person."),
  T('notes', [/\bnotes?\b|write down|private/],
    () => 'The Notes tab in the room is a private scratchpad: only you see it. Jot down steps, links or what clicked, and press "Save as a file" to keep it.'),

  // ---------- you ----------
  T('badge', [/badge|achievement|trophy|unlock|award|mentor badge|five stars/],
    () => "Badges are earned automatically from what you actually do: First booking, First class taught, Fair trader (teach one and learn one), Regular teacher (5 taught), Mentor (10 taught), Five stars, Polyglot, Early orbiter and more. You get a card when one unlocks, and they show on your public page and dashboard.",
    [['See my badges', '/home#badges']]),
  T('status', [/status|online|offline|idle|busy|do not disturb|\bdnd\b|invisible|green dot/],
    () => "Click your avatar (top right) and pick a status: Online, Idle, Do not disturb (no sounds or pop-ups) or Invisible (you look offline). Online turns to Idle after 10 quiet minutes. Everyone sees the dot on your avatar."),
  T('notify', [/notif|\bring|alert|\bmiss|chime|ping/],
    () => 'orbit shows a card with a chime when someone books you, accepts, joins the room, replies in a dispute or pays you. Turn on desktop notifications under Settings → Notifications to get them while you\'re on another tab. Do not disturb mutes them.',
    [['Notification settings', '/me/notifications']]),
  T('review', [/review|rating|stars?|feedback|rate (them|him|her)/],
    () => 'After a class is paid, you can rate the other person from 1 to 5 stars and leave a few words. Ratings show on public profiles and in search.',
    [['Open Sessions', '/sessions']]),
  T('profile', [/profile|photo|picture|avatar|handle|username|card colou?r|\bbio\b|country|share (my )?(profile|link|page)/],
    (c) => `Everything about your profile is in Settings: photo, username, card colour, bio, country, languages, what you teach and want to learn, and your prices.${c.handle ? ` Your public page is orbit.voids.wtf/u/${c.handle}; share it with anyone.` : ''}`,
    [['Edit my profile', '/me']]),
  T('login', [/log ?in|sign ?in|sign ?up|register|password|forgot|reset|google|github|discord|can'?t (get|log) in|email/],
    () => 'You can sign in with Google, GitHub or Discord in one click, or with email and password. Forgot your password? On the log in page press "Forgot password?" and open the email in the same browser. You can change your email or password in Settings → Account.',
    [['Log in', '/login'], ['Make an account', '/join']]),
  T('language', [/language|speak|translat|hindi|english|spanish|french|arabic|tamil|marathi/],
    () => 'orbit itself comes in 32 languages: use the flag button in the top bar or footer. Add the languages you speak to your profile too, and in Learn something you can filter teachers by language.',
    [['Learn something', '/find']]),
  T('activity', [/activity|history|audit|receipt|ledger|what happened|log\b/],
    () => 'The Audit log lists everything that happened on your classes and profile, written by the database itself. Credits shows every single credit movement.',
    [['Open the audit log', '/activity']]),
  T('report', [/report|abuse|harass|unsafe|\bblock\b|rude|spam|fake/],
    () => 'Sorry that happened. Use "Report" on their profile or in the class room: pick a reason and add details. orbit staff review every report privately; the person never learns who reported them.',
    [['Report to support', 'human']]),
  T('delete', [/delete|remove (my )?account|close (my )?account|privacy|my data/],
    () => 'You can delete your account yourself: Settings → Account → Delete account, then confirm with your password. Finish or cancel any open classes first, so held credits have somewhere to go. The privacy policy explains what we keep.',
    [['Account settings', '/me/account'], ['Privacy policy', '/docs/privacy']]),
  T('support', [/support|human|person|staff|admin|help me|contact/],
    () => 'Want a real person? Press "Talk to support" at the top of this panel, or open the Support page. Staff reply here in Vortex and on the Support page.',
    [['Talk to support', 'human'], ['Support page', '/support']]),
  T('thanks', [/\b(thanks|thank you|thx|ty|tysm|great|nice|cool|awesome|perfect)\b/],
    () => 'Anytime! Ask me whenever you need a hand.'),
]

export const STARTERS = ['How does orbit work?', 'Book a class', 'How do disputes work?', 'Badges', 'Laggy call', 'Talk to support']

export function answer(text, ctx) {
  const q = text.toLowerCase()
  let best = null
  let bestScore = 0
  for (const t of TOPICS) {
    const score = t.keys.reduce((n, re) => n + (re.test(q) ? 1 : 0), 0)
    if (score > bestScore) {
      best = t
      bestScore = score
    }
  }
  if (!best) {
    return {
      text: "I'm not sure about that one yet. Try one of these, or send it to support and a person will reply.",
      actions: [['Talk to support', 'human']],
      chips: STARTERS,
    }
  }
  return { text: best.reply(ctx), actions: best.actions, topic: best.id }
}
