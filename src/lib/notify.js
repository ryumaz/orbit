// Notifications: an in-app card always, plus a system notification when orbit is
// open but not the tab you're looking at (only if you turned that on).

const KEY = 'orbit:notify'

export const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

// 'on' | 'off' | 'blocked' | 'unsupported' | 'ask'
export function notifyState() {
  if (!canNotify()) return 'unsupported'
  if (Notification.permission === 'denied') return 'blocked'
  let pref = null
  try {
    pref = localStorage.getItem(KEY)
  } catch {
    /* storage blocked */
  }
  if (Notification.permission === 'granted') return pref === 'off' ? 'off' : 'on'
  return 'ask'
}

export async function enableNotify() {
  if (!canNotify()) return 'unsupported'
  const result = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  try {
    localStorage.setItem(KEY, result === 'granted' ? 'on' : 'off')
  } catch {
    /* ignore */
  }
  return notifyState()
}

export function disableNotify() {
  try {
    localStorage.setItem(KEY, 'off')
  } catch {
    /* ignore */
  }
  return notifyState()
}

// A system notification, only when the page is in the background.
export function systemNotify({ title, body, icon, onClick }) {
  if (!document.hidden || notifyState() !== 'on') return
  try {
    const n = new Notification(title, { body, icon: icon || undefined, tag: `orbit-${title}` })
    n.onclick = () => {
      window.focus()
      onClick?.()
      n.close()
    }
  } catch {
    /* some browsers only allow notifications from a service worker */
  }
}

// A short, soft two-note chime.
export function chime() {
  let ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    return
  }
  const note = (freq, at) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = 'sine'
    o.frequency.value = freq
    g.gain.setValueAtTime(0, ctx.currentTime + at)
    g.gain.linearRampToValueAtTime(0.09, ctx.currentTime + at + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + at + 0.5)
    o.connect(g).connect(ctx.destination)
    o.start(ctx.currentTime + at)
    o.stop(ctx.currentTime + at + 0.55)
  }
  note(880, 0)
  note(1320, 0.12)
  setTimeout(() => ctx.close(), 900)
}
