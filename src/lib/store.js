// Mock backend for the frontend phase. Every function here has the shape the real
// API will have, so the backend swap later only touches this file.
// State lives in localStorage, so two tabs in one browser share it and see each
// other's changes live through the `storage` event.
import { useSyncExternalStore } from 'react'
import { PEOPLE, WELCOME_CREDITS, HISTORY, OPEN } from './seed.js'

const KEY = 'unstuck:v1'
const DAY = 86400000
const MIN = 60000
const listeners = new Set()

export const getPerson = (id) => PEOPLE.find((p) => p.id === id)
export { PEOPLE }

function emptyState() {
  return { sessions: [], ledger: [], seq: { session: 0, row: 0 } }
}

function clone(s) {
  return { sessions: s.sessions.map((x) => ({ ...x })), ledger: s.ledger.slice(), seq: { ...s.seq } }
}

function addRow(s, userId, amount, type, note, sessionId, at) {
  s.seq.row += 1
  s.ledger.push({ id: s.seq.row, userId, amount, type, note, sessionId: sessionId ?? null, at })
}

// ---- reads ---------------------------------------------------------------

export function balanceOf(s, userId) {
  let total = 0
  for (const r of s.ledger) if (r.userId === userId) total += r.amount
  return total
}

export function heldOf(s, userId) {
  return s.sessions
    .filter((x) => x.learnerId === userId && (x.status === 'accepted' || x.status === 'live'))
    .reduce((a, x) => a + x.cost, 0)
}

export const ledgerOf = (s, userId) => s.ledger.filter((r) => r.userId === userId)

export function helpedCount(s, userId) {
  return s.sessions.filter((x) => x.mentorId === userId && x.status === 'completed').length
}

export function takenCount(s, userId) {
  return s.sessions.filter((x) => x.learnerId === userId && x.status === 'completed').length
}

const LEVELS = [1, 3, 6, 10]
export function levelOf(helped) {
  return 1 + LEVELS.filter((n) => helped >= n).length
}
export function nextLevelAt(helped) {
  return LEVELS.find((n) => helped < n) ?? null
}

export const sessionById = (s, id) => s.sessions.find((x) => x.id === Number(id))

// ---- writes (each returns { ok, error?, id? }) ---------------------------

function _request(s, { learnerId, mentorId, skill, problem }, at) {
  const mentor = getPerson(mentorId)
  if (!mentor || learnerId === mentorId) return { ok: false, error: 'You cannot book yourself.' }
  // balance already excludes held credits, so this is what they can really spend
  if (balanceOf(s, learnerId) < mentor.cost) {
    return { ok: false, error: `You need ${mentor.cost} credits and have ${balanceOf(s, learnerId)}. Help someone to earn more.` }
  }
  s.seq.session += 1
  s.sessions.push({
    id: s.seq.session, learnerId, mentorId, skill, problem: problem.trim(), cost: mentor.cost,
    status: 'requested', createdAt: at, acceptedAt: null, completedAt: null,
  })
  return { ok: true, id: s.seq.session }
}

function _accept(s, id, byUserId, at) {
  const x = sessionById(s, id)
  if (!x || x.mentorId !== byUserId) return { ok: false, error: 'Only the person asked can accept.' }
  if (x.status !== 'requested') return { ok: false, error: 'This request was already handled.' }
  // the check the problem statement asks for: credits must exist when the peer accepts
  if (balanceOf(s, x.learnerId) < x.cost) {
    return { ok: false, error: `${getPerson(x.learnerId).name} no longer has ${x.cost} credits.` }
  }
  addRow(s, x.learnerId, -x.cost, 'hold', `Held for ${getPerson(x.mentorId).name}`, x.id, at)
  x.status = 'accepted'
  x.acceptedAt = at
  return { ok: true, id: x.id }
}

function _complete(s, id, byUserId, at) {
  const x = sessionById(s, id)
  if (!x) return { ok: false, error: 'No such session.' }
  if (x.learnerId !== byUserId) return { ok: false, error: 'Only the person who asked can confirm it works.' }
  // one session moves credits once: the status check and the row check both guard it
  if (x.status === 'completed' || s.ledger.some((r) => r.sessionId === x.id && r.type === 'earn')) {
    return { ok: false, already: true, error: 'These credits already moved.' }
  }
  if (x.status !== 'accepted' && x.status !== 'live') return { ok: false, error: 'This session is not running.' }
  addRow(s, x.mentorId, x.cost, 'earn', `Helped ${getPerson(x.learnerId).name}, ${x.skill}`, x.id, at)
  x.status = 'completed'
  x.completedAt = at
  return { ok: true, id: x.id }
}

function _decline(s, id, byUserId, at) {
  const x = sessionById(s, id)
  if (!x || x.mentorId !== byUserId || x.status !== 'requested') return { ok: false, error: 'Nothing to decline.' }
  x.status = 'declined'
  x.completedAt = at
  return { ok: true, id: x.id }
}

function _cancel(s, id, byUserId, at) {
  const x = sessionById(s, id)
  if (!x || (x.learnerId !== byUserId && x.mentorId !== byUserId)) return { ok: false, error: 'Not your session.' }
  if (x.status === 'accepted' || x.status === 'live') {
    addRow(s, x.learnerId, x.cost, 'refund', `Refund, ${getPerson(x.mentorId).name} session cancelled`, x.id, at)
  } else if (x.status !== 'requested') {
    return { ok: false, error: 'This session already ended.' }
  }
  x.status = 'cancelled'
  x.completedAt = at
  return { ok: true, id: x.id }
}

function _start(s, id, byUserId) {
  const x = sessionById(s, id)
  if (!x || (x.learnerId !== byUserId && x.mentorId !== byUserId)) return { ok: false, error: 'Not your session.' }
  if (x.status === 'accepted') x.status = 'live'
  return { ok: x.status === 'live', id: x.id }
}

// ---- seed: replay history through the same rules ------------------------

function seed() {
  const s = emptyState()
  const t = Date.now()
  PEOPLE.forEach((p) => addRow(s, p.id, WELCOME_CREDITS, 'welcome', 'Welcome credits', null, t - 40 * DAY))
  // older sessions, so mentors start with some history
  const older = [['dev', 6], ['arjun', 6], ['kabir', 5], ['omar', 4], ['sahil', 3], ['riya', 2]]
  let k = 0
  older.forEach(([mentorId, n]) => {
    const mentor = getPerson(mentorId)
    for (let i = 0; i < n; i++) {
      const learner = PEOPLE[(k++ * 3 + 1) % PEOPLE.length]
      if (learner.id === mentorId || learner.id === 'meera') continue
      const at = t - (34 - (k % 14)) * DAY
      const r = _request(s, { learnerId: learner.id, mentorId, skill: mentor.skills[0][0], problem: 'older session' }, at)
      if (r.ok && _accept(s, r.id, mentorId, at + 20 * MIN).ok) _complete(s, r.id, learner.id, at + 45 * MIN)
    }
  })
  HISTORY.forEach(([learnerId, mentorId, skill, problem, daysAgo, outcome]) => {
    const at = t - daysAgo * DAY
    const r = _request(s, { learnerId, mentorId, skill, problem }, at)
    if (!r.ok) return
    if (outcome === 'declined') {
      _accept(s, r.id, mentorId, at + 5 * MIN)
      _cancel(s, r.id, mentorId, at + 9 * MIN)
      return
    }
    if (_accept(s, r.id, mentorId, at + 15 * MIN).ok) _complete(s, r.id, learnerId, at + 40 * MIN)
  })
  OPEN.forEach(([learnerId, mentorId, skill, problem, minsAgo, state]) => {
    const at = t - minsAgo * MIN
    const r = _request(s, { learnerId, mentorId, skill, problem }, at)
    if (r.ok && state === 'live' && _accept(s, r.id, mentorId, at + 2 * MIN).ok) _start(s, r.id, mentorId)
  })
  return s
}

// ---- store plumbing --------------------------------------------------------

function persist(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: keep it in memory */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through to a fresh seed */
  }
  const s = seed()
  persist(s)
  return s
}

let state = load()

function commit(next) {
  state = next
  persist(next)
  listeners.forEach((l) => l())
}

window.addEventListener('storage', (e) => {
  if (e.key !== KEY || !e.newValue) return
  try {
    state = JSON.parse(e.newValue)
    listeners.forEach((l) => l())
  } catch {
    /* ignore a half-written value */
  }
})

function subscribe(l) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore() {
  return useSyncExternalStore(subscribe, () => state)
}

function run(fn, ...args) {
  const next = clone(state)
  const res = fn(next, ...args, Date.now())
  if (res.ok) commit(next)
  return res
}

export const requestSession = (args) => run(_request, args)
export const acceptSession = (id, by) => run(_accept, id, by)
export const declineSession = (id, by) => run(_decline, id, by)
export const cancelSession = (id, by) => run(_cancel, id, by)
export const completeSession = (id, by) => run(_complete, id, by)
export const startSession = (id, by) => {
  const next = clone(state)
  const res = _start(next, id, by)
  if (res.ok) commit(next)
  return res
}

export function resetDemo() {
  commit(seed())
}
