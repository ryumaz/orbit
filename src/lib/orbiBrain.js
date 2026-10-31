// What Orbi knows. Each topic has a few patterns; the topic with the most matches
// answers. Answers can use the signed-in member's own numbers, and offer buttons
// that go to the right page (or hand over to the team).
//
// To put a real model behind Orbi later, replace answer() with a call to your own
// endpoint and keep these topics as its first try.

const T = (id, keys, reply, actions = []) => ({ id, keys, reply, actions })

const TOPICS = [
  T('greet', [/\b(hi|hii+|hello|hey|yo|namaste|hola|sup|good (morning|evening|afternoon))\b/],
    (c) => `Hi${c.first ? ` ${c.first}` : ''}! I'm Orbi. Ask me anything about orbit: credits, booking, calls, your profile. If I don't know, I'll pass you to the team.`),
  T('who', [/who are you|your name|are you (a |an )?(bot|ai|robot|human|real)/, /\borbi\b/],
    () => "I'm Orbi, orbit's helper. I answer the common questions from what I know about orbit. For anything personal or tricky, press \"Talk to the team\" and a real person reads it."),
  T('what', [/what is (this|orbit|it)|how (does|do) (it|orbit|this|the site) work|explain|about orbit|what can i do/, /\bhow it works\b/],
    () => 'orbit is a skill swap. You teach what you know (guitar, coding, cooking, a game, a language) and earn credits. You spend credits learning from other members. Sessions are 15 to 60 minutes by video, voice or in person, and credits only move when the learner says it helped.',
    [['See how it works', '/#how'], ['Find someone to learn from', '/find']]),
  T('balance', [/\b(my )?(balance|wallet)\b/, /how many credits (do )?i (have|got)/, /my credits/],
    (c) => c.live
      ? `You have ${c.balance} credits to spend${c.held ? `, and ${c.held} on hold for sessions in progress` : ''}. Every change is listed on your Credits page.`
      : 'Log in and I can tell you your balance. New accounts start with 30 credits.',
    [['Open Credits', '/credits']]),
  T('credits', [/credit|points|coins|currency|\bpay(ment)?\b|money|free/],
    (c) => `Credits are orbit's money. Everyone starts with 30. You earn them by teaching and spend them by learning; a teacher sets their price per 30 minutes.${c.live ? ` You have ${c.balance} right now.` : ''} Real money is never involved.`,
    [['How credits work', '/#escrow'], ['Open Credits', '/credits']]),
  T('teach', [/\bteach|earn|become (a )?(mentor|teacher)|offer|sell|my skills?|add (a )?skill|mentor/, /(earn|get|make) (more )?credits/],
    () => 'To teach: open You, add skills under "I can teach", and set your price per 30 minutes. You then show up when people search, and your public page at orbit.voids.wtf/u/your-handle can be shared with anyone. When someone books you, you get a notification to accept or decline.',
    [['Edit what I teach', '/me']]),
  T('learn', [/\b(book|learn|find|search|request)\b|someone to teach|session with|how (do|can) i (start|get help)/],
    () => 'To learn: go to Learn something, search a skill, open someone\'s page, pick a length and send a request. Nothing is charged until they accept; then the credits wait on hold until you say it helped.',
    [['Learn something', '/find']]),
  T('price', [/price|cost|how much|\brate\b|charge|expensive|cheap|per (hour|minute)/],
    () => 'Each teacher sets a price per 30 minutes. A 15-minute session costs half that, an hour costs double (rounded up). You can see the exact total before you send a request.',
    [['Set my price', '/me']]),
  T('hold', [/\bhold|held|escrow|refund|get (it|them|my credits) back|didn'?t help|not helpful|scam|cheat/],
    () => 'When a teacher accepts, your credits go on hold: they leave your wallet but don\'t reach the teacher yet. They\'re sent only when you press "It worked". If you both agree to stop early, you split them the way you agreed and the rest comes back to you.',
    [['How credits work', '/#escrow']]),
  T('cancel', [/cancel|end (it )?early|stop (the )?session|\bquit\b|withdraw|\bsplit\b|leave (the )?session/],
    () => 'Before a teacher accepts, you can withdraw a request for free. Once a session has started, either of you can press "End early" and suggest a split of the credits; the other person agrees, suggests a different split, or says no. Nothing moves until you both agree.',
    [['Open Sessions', '/sessions']]),
  T('requests', [/incoming|accept|decline|(new|my|pending) requests?|someone (booked|requested)/],
    (c) => c.live
      ? (c.waiting ? `You have ${c.waiting} ${c.waiting === 1 ? 'request' : 'requests'} waiting. Accept or decline them on Sessions.` : 'No requests waiting right now. New ones pop up as a card with a chime, and on Sessions.')
      : 'Requests show up on your Sessions page with a card and a chime. Log in to see yours.',
    [['Open Sessions', '/sessions']]),
  T('hear', [/\bhear|audio|sound|\bmic|microphone|voice|\bmute|echo|volume|silent/],
    () => 'Can\'t hear each other? Try these in order:\n1. Both of you press Video call or Voice only (being in the room isn\'t enough).\n2. Allow the microphone when the browser asks; check the lock icon next to the address.\n3. If you see "Tap to hear", tap it; browsers sometimes block sound until you click.\n4. Make sure you aren\'t muted, then refresh both tabs and join again.'),
  T('camera', [/camera|webcam|\bvideo\b|screen ?share|share (my )?screen|full ?screen/],
    () => 'Turn your camera on or off with "Camera on/off" during a call; joining with "Voice only" works too, and you can switch the camera on later. "Share screen" swaps your camera for your screen. Each video tile has a full screen button in its corner, or double-click the video.'),
  T('connect', [/connect|connecting|reconnect|\blag|laggy|network|wi-?fi|firewall|\bvpn\b|blocked|freez/],
    () => 'Stuck on "Connecting…"? Calls go straight between your two browsers, and some networks block that (college or office Wi-Fi, some VPNs). Turn off any VPN, or try a phone hotspot on one side. orbit retries by itself a few times before it says the call couldn\'t connect.'),
  T('board', [/whiteboard|\bdraw|\bboard\b|code editor|\beditor\b|\bcode\b/],
    () => 'Every room has a shared whiteboard and a code editor; you both see changes live. On the whiteboard, pick a colour and size, use Eraser, Undo (it only takes back your own lines) and Clear (it clears for both of you).'),
  T('chat', [/\bchat|message|\btext\b|notes/],
    () => 'Use Chat in the room to message each other; it arrives instantly. My notes is private and stays in your browser.'),
  T('notify', [/notif|\bring|alert|\bmiss|chime|ping/],
    () => 'orbit shows a card with a chime when someone books you, accepts, wants to end early or pays you. Turn on desktop notifications under You → Notifications to get them while you\'re on another tab.',
    [['Notification settings', '/me']]),
  T('review', [/review|rating|stars?|feedback/],
    () => 'After a session is paid, you can rate the other person from 1 to 5 sparks and leave a few words. Ratings show on public profiles and in search.',
    [['Open Sessions', '/sessions']]),
  T('profile', [/profile|photo|picture|avatar|handle|username|card colou?r|\bbio\b|share (my )?(profile|link|page)/],
    (c) => `Everything about your profile is on the You page: photo (with crop), handle, colour, bio, languages, what you teach and want to learn.${c.handle ? ` Your public page is orbit.voids.wtf/u/${c.handle}; share it with anyone.` : ''}`,
    [['Edit my profile', '/me']]),
  T('login', [/log ?in|sign ?in|sign ?up|register|password|forgot|reset|google|github|discord|can'?t (get|log) in/],
    () => 'You can sign in with email and password, or with GitHub or Discord in one click. Forgot your password? On the log in page press "Forgot password?" and open the email in the same browser.',
    [['Log in', '/login'], ['Make an account', '/join']]),
  T('language', [/language|speak|translat|hindi|english|spanish|french/],
    () => 'Add the languages you speak on your profile. In Learn something you can filter teachers by the language they speak.',
    [['Edit my languages', '/me'], ['Learn something', '/find']]),
  T('activity', [/activity|history|audit|receipt|ledger|what happened/],
    () => 'The Activity page lists everything that happened on your sessions and profile, written by the database itself. Credits has every single credit movement.',
    [['Open Activity', '/activity']]),
  T('report', [/report|abuse|harass|unsafe|\bblock\b|rude|spam|fake/],
    () => 'Sorry that happened. Please tell the team: press below, say who it was (their @handle) and what happened. A person reads every report.',
    [['Report to the team', 'human']]),
  T('delete', [/delete|remove (my )?account|close (my )?account|privacy|my data/],
    () => 'The team can delete your account and data. Send a request below from the email on your account.',
    [['Ask the team', 'human']]),
  T('thanks', [/\b(thanks|thank you|thx|ty|tysm|great|nice|cool|awesome|perfect)\b/],
    () => 'Anytime! Ask me whenever you need a hand.'),
]

export const STARTERS = ['How does orbit work?', 'How do I earn credits?', 'Book a session', "I can't hear them", 'Forgot password']

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
      text: "I'm not sure about that one yet. Try one of these, or send it to the team and a person will reply.",
      actions: [['Talk to the team', 'human']],
      chips: STARTERS,
    }
  }
  return { text: best.reply(ctx), actions: best.actions, topic: best.id }
}
