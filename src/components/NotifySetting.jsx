import { useState } from 'react'
import { notifyState, enableNotify, disableNotify } from '../lib/notify'

const TEXT = {
  on: 'On. You get a notification when orbit is open in another tab.',
  off: 'Off. You still see notifications inside orbit.',
  ask: 'Get a notification on your computer or phone when someone books you, even while you use another tab.',
  blocked: 'Your browser is blocking notifications for orbit. Allow them from the lock icon next to the address, then come back.',
  unsupported: "This browser can't show notifications. You still see them inside orbit.",
}

// Turn desktop notifications on or off. Compact = the nudge card on Home.
export default function NotifySetting({ compact = false }) {
  const [state, setState] = useState(notifyState)
  if (compact && state !== 'ask') return null
  return (
    <section className={`card grid gap-3 ${compact ? 'card-hot' : ''}`} aria-label="Notifications">
      <p className="label m-0">{compact ? "Don't miss a booking" : 'Notifications'}</p>
      <p className="m-0 text-[12.5px] leading-relaxed">{TEXT[state]}</p>
      {(state === 'ask' || state === 'off') && (
        <button type="button" className="btn btn-light btn-sm self-start" onClick={async () => setState(await enableNotify())}>
          Turn on notifications
        </button>
      )}
      {state === 'on' && !compact && (
        <button type="button" className="btn btn-line btn-sm self-start" onClick={() => setState(disableNotify())}>Turn off</button>
      )}
    </section>
  )
}
