import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { setQuiet } from './notify'
import { useAccount } from './account'

// Who is around right now, like Discord: online, idle, do not disturb, or offline.
// Everyone on orbit joins one Realtime presence channel; members announce their
// status under their @handle, guests only listen. "Invisible" announces nothing,
// so you look offline. Online turns into idle after 10 quiet minutes.

export const STATUSES = [
  ['online', 'Online', ''],
  ['idle', 'Idle', 'Shown as away'],
  ['dnd', 'Do not disturb', 'No sounds or pop-up notifications'],
  ['invisible', 'Invisible', 'You appear offline'],
]
export const STATUS_LABEL = { online: 'Online', idle: 'Idle', dnd: 'Do not disturb', invisible: 'Invisible', offline: 'Offline' }
const IDLE_AFTER = 10 * 60 * 1000

const Ctx = createContext({ statusOf: () => 'offline', mine: 'online', setMine: () => {} })

export function PresenceProvider({ children }) {
  const { profile } = useAccount()
  const handle = profile?.handle ?? null
  const [here, setHere] = useState({}) // handle -> status
  const [mine, setMineState] = useState('online')
  const [away, setAway] = useState(false)
  const [channel, setChannel] = useState(null)

  useEffect(() => {
    if (profile?.status) setMineState(profile.status)
  }, [profile?.status])

  // quiet for 10 minutes (or the tab hidden that long) counts as idle
  useEffect(() => {
    let t
    let last = 0
    const active = () => {
      const now = Date.now()
      if (now - last < 5000) return // pointer moves come fast; check at most every 5 s
      last = now
      setAway(false)
      clearTimeout(t)
      t = setTimeout(() => setAway(true), IDLE_AFTER)
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'focus']
    events.forEach((e) => window.addEventListener(e, active, { passive: true }))
    active()
    return () => {
      clearTimeout(t)
      events.forEach((e) => window.removeEventListener(e, active))
    }
  }, [])

  // one channel for everyone; members are keyed by handle so a second tab doesn't count twice
  useEffect(() => {
    const key = handle ?? `guest-${Math.random().toString(36).slice(2, 10)}`
    const ch = supabase.channel('orbit-online', { config: { presence: { key } } })
    ch.on('presence', { event: 'sync' }, () => {
      const next = {}
      for (const [k, metas] of Object.entries(ch.presenceState())) {
        // several tabs: the most present one wins (online beats idle beats dnd)
        const order = ['online', 'idle', 'dnd']
        const best = metas.map((m) => m.status).filter(Boolean).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0]
        if (best) next[k] = best
      }
      setHere(next)
    }).subscribe((status) => status === 'SUBSCRIBED' && setChannel(ch))
    return () => {
      setChannel(null)
      supabase.removeChannel(ch)
    }
  }, [handle])

  const effective = mine === 'invisible' ? null : mine === 'online' && away ? 'idle' : mine
  useEffect(() => {
    if (!channel || !handle) return
    if (effective) channel.track({ status: effective })
    else channel.untrack()
  }, [channel, handle, effective])

  useEffect(() => {
    setQuiet(mine === 'dnd')
  }, [mine])

  const setMine = useCallback(async (s) => {
    setMineState(s)
    await supabase.rpc('set_my_status', { s })
  }, [])

  const statusOf = useCallback(
    (h) => {
      if (!h) return 'offline'
      if (h === handle) return mine === 'invisible' ? 'invisible' : effective ?? 'offline'
      return here[h] ?? 'offline'
    },
    [here, handle, mine, effective],
  )

  return <Ctx.Provider value={{ statusOf, mine, setMine, effective }}>{children}</Ctx.Provider>
}

export const usePresence = () => useContext(Ctx)
export const useStatusOf = (handle) => useContext(Ctx).statusOf(handle)

// the little dot on an avatar
export function StatusDot({ handle, large = false }) {
  const s = useStatusOf(handle)
  return <span className={`sdot is-${s} ${large ? 'sdot-lg' : ''}`} title={STATUS_LABEL[s]} aria-label={STATUS_LABEL[s]} role="img" />
}
