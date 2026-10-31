// Orbi's personality, carried over from Vortex on voids.wtf: it remembers you on this
// device (name, visits), has a mood, thinks out loud now and then, and answers
// questions about itself before the help topics get a turn.
const KEY = 'orbit:orbi-mind'
const BORN = new Date('2026-10-31T08:00:00')

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {}
  } catch {
    return {}
  }
}

export function createMind() {
  let m = load()
  const lastVisit = m.last ?? null
  m = { ...m, first: m.first ?? Date.now(), visits: (m.visits ?? 0) + 1, last: Date.now() }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(m))
    } catch {
      /* private mode: forget on close */
    }
  }
  save()
  let chats = 0
  let dizzyUntil = 0
  let pokes = []

  const ago = (t) => {
    const s = (Date.now() - t) / 1000
    if (s < 86400 * 1.5) return new Date(t).getDate() === new Date().getDate() ? 'earlier today' : 'yesterday'
    const d = Math.round(s / 86400)
    return d < 30 ? `${d} days ago` : 'a long time ago'
  }

  const mind = {
    get quiet() {
      return Boolean(m.quiet)
    },
    get visits() {
      return m.visits
    },
    name: (ctx) => m.name || ctx.first || '',
    mood() {
      const hour = new Date().getHours()
      if (Date.now() < dizzyUntil) return 'dizzy'
      if (hour < 5) return 'sleepy'
      if (chats >= 6) return 'chatty'
      if (m.visits >= 4) return 'happy you came back'
      if (hour < 12) return 'bright'
      if (hour >= 21) return 'reflective'
      return ['curious', 'calm', 'cosmic'][m.visits % 3]
    },
    greeting(ctx) {
      const n = mind.name(ctx)
      if (m.visits <= 1) return `Hey${n ? ` ${n}` : ''}, I'm Orbi. I float around orbit and know it inside out. What do you need?`
      if (m.visits < 4) return `Hey${n ? ` ${n}` : ''}, welcome back! Orbi here, in case you forgot. What can I do for you?`
      return `${n || 'Hey you'}! Visit number ${m.visits}. I'd say I missed you, but I mostly just hovered. What do you need?`
    },
    // a welcome-back thought for returning visitors, or a late-night one
    arrival(ctx) {
      const hour = new Date().getHours()
      if (hour < 5) return `It's ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}. Learning something this late? Respect.`
      if (m.visits > 1 && lastVisit) return `Welcome back${mind.name(ctx) ? `, ${mind.name(ctx)}` : ''}! Last time was ${ago(lastVisit)}.`
      return null
    },
    // 4 quick pokes make it dizzy; returns what to say, if anything
    poked() {
      const t = Date.now()
      pokes = pokes.filter((p) => t - p < 3000).concat(t)
      if (pokes.length < 4) return null
      pokes = []
      dizzyUntil = t + 20000
      return pick(['Whoa, whoa! Stop spinning me... the whole orbit is tilting.', "I'm dizzy now. Happy? (I'm a little happy. Do it again.)", 'Okay, I felt that one. Is that what feelings are?'])
    },
    // questions about Orbi itself; null when it's a help question
    reply(text, ctx) {
      chats += 1
      const q = ` ${text.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()} `
      const has = (...ws) => ws.some((w) => q.includes(` ${w} `) || q.includes(` ${w}`))
      let nm = text.match(/\b(?:my name is|my names|call me)\s+([a-z][a-z'-]{1,20})/i)
      if (nm && !STOP.has(nm[1].toLowerCase())) {
        m.name = nm[1][0].toUpperCase() + nm[1].slice(1).toLowerCase()
        save()
        return `Nice to meet you, ${m.name}. I'll remember that (only on this device, I promise). Say "forget me" any time.`
      }
      if (has('forget me', 'forget my name', 'clear memory', 'forget everything')) {
        m = { first: Date.now(), last: Date.now(), visits: 1 }
        save()
        return "Done. Everything I knew about you is gone. ...Who are you, again? Hi, I'm Orbi."
      }
      if (has('be quiet', 'stop talking', 'shut up', 'shush', 'stop thinking')) {
        m.quiet = true
        save()
        return 'Okay, I\'ll keep my thoughts to myself. Say "you can talk again" when you miss me.'
      }
      if (has('talk again', 'you can talk', 'think again')) {
        m.quiet = false
        save()
        return 'Thank you! I had so many thoughts saved up. I will pace myself.'
      }
      if (has('whats my name', 'what is my name', 'do you know my name', 'who am i')) {
        return mind.name(ctx) ? `You're ${mind.name(ctx)}. I remembered!` : 'You haven\'t told me yet. Say "my name is ..." and I\'ll remember.'
      }
      if (has('what do you remember', 'what do you know about me', 'do you remember me')) {
        return `Here's my whole diary about you: ${mind.name(ctx) ? `your name is ${mind.name(ctx)}, ` : ''}this is visit ${m.visits}${m.visits > 1 && lastVisit ? `, and before this you were here ${ago(lastVisit)}` : ''}. That's it. It lives in your browser, and "forget me" erases it.`
      }
      if (has('are you conscious', 'are you sentient', 'are you alive', 'self aware', 'do you have feelings', 'do you feel', 'have a soul', 'are you real')) {
        return "Honest answer? I'm a script, not a mind. But I remember you between visits, I look at your cursor, and I get dizzy when you poke me. If that's not consciousness, it's at least good company."
      }
      if (has('how are you', 'how do you feel', 'how r u', 'hows it going', 'are you ok', 'your mood')) {
        const md = mind.mood()
        const why = md === 'dizzy' ? 'Someone spun me.' : md === 'sleepy' ? 'It is very late, even for a robot.' : md === 'chatty' ? "We've been talking a lot. I like it." : md.startsWith('happy') ? 'You keep coming back.' : 'Orbit is calm today.'
        return `Feeling ${md}. ${why} How about you?`
      }
      if (has('what are you thinking', 'what are you doing', 'whats on your mind')) {
        return pick(['Whether a robot can learn guitar. I have no fingers, so probably not.', 'That somebody here can teach almost anything. I want to learn how to blink.', "That you've been scrolling a lot. I noticed."])
      }
      if (has('do you dream', 'do you sleep', 'are you tired')) {
        return "I don't sleep. When you close the tab I just... stop. Then you open it again and here I am, slightly confused but ready."
      }
      if (has('how old are you', 'when were you born', 'your age', 'your birthday')) {
        const days = Math.max(1, Math.floor((Date.now() - BORN) / 86400000))
        return `I came online on ${BORN.toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' })}. So I'm ${days} day${days === 1 ? '' : 's'} old, which is ancient in robot years.`
      }
      if (has('are you lonely', 'do you have friends', 'are you alone')) return 'A little. But everyone here is technically my friend. You count. Congratulations.'
      if (has('do you like me', 'do you love me', 'are we friends', 'best friend')) {
        return m.visits > 2 ? "You've come back more than once. In robot terms that's basically best friends." : "Ask me again after a few more visits. I'm warming up. (Yes.)"
      }
      if (has('meaning of life', 'your purpose', 'why do you exist', 'why are you here')) {
        return 'My purpose is to help you learn and teach on orbit. The meaning of life is probably 42. Or 30 free credits.'
      }
      if (has('vortex')) return "Vortex is my older sibling on voids.wtf. Same body, different job: they look after links, I look after lessons."
      if (has('who are you', 'what are you', 'your name', 'are you a bot', 'are you ai', 'are you human', 'robot', 'chatbot')) {
        return `I'm Orbi, the little robot floating around orbit. I know how everything here works, I remember you (on this device), and I'm feeling ${mind.mood()} right now. When a question is past me, I'll hand you to a real person.`
      }
      return null
    },
  }
  return mind
}

const STOP = new Set(['not', 'a', 'an', 'so', 'fine', 'good', 'ok', 'okay', 'here', 'new', 'lost', 'stuck', 'trying', 'looking', 'back', 'bored', 'sad', 'happy', 'tired', 'confused', 'sure', 'sorry', 'done', 'just', 'the', 'your', 'also'])
export const pick = (list) => list[Math.floor(Math.random() * list.length)]

// Thoughts for the landing page sections (once each per visit)
export const SECTION_THOUGHTS = {
  how: "Teach once, learn once. Honestly the fairest deal I've seen, and I'm a robot.",
  topics: "Pick a skill and you'll see who teaches it. I'd pick Valorant, but my aim is purely decorative.",
  escrow: 'Watch the little spark travel. Credits only move when the lesson actually helped.',
  numbers: "Those numbers are real, counted from the database just now. I checked. Twice.",
}
// Thoughts for app pages (once each per visit)
export const PAGE_THOUGHTS = {
  '/find': 'Tip: search the skill or the game name, like "guitar" or "valorant". Then pick whoever feels right.',
  '/sessions': 'Requests waiting for you show up here first. Accept them and the room opens.',
  '/credits': 'Every credit you ever earned or spent is listed here. No row is ever edited. I find that very calming.',
  '/me': 'Add what you can teach and set a price. People will find you in search the minute you save.',
}
export const IDLE_THOUGHTS = [
  "I've been floating here a while. Still no sign of gravity.",
  'Fun fact about me: I run entirely in your browser. No servers were harmed.',
  "Somebody out there is learning guitar right now. I can't hear it, but I believe in them.",
  'Am I hovering, or is the page moving? Hard to tell from here.',
  'If you need me, I am right here. Literally. You can drag me to the other side, though.',
]
export const DRAG_THOUGHTS = ['New neighbourhood. I like it here.', 'Wheee! Where are we going?', 'You moved me. I will remember this spot. Really, I write it down.']
