import { useState } from 'react'
import { Link } from 'react-router-dom'
import Halftone from '../glyph/Halftone'
import { Spark } from './Spark'
import { StatusDot } from '../lib/presence'

// Card colours a member can pick. Keys are stored in profiles.card_color.
export const CARD_COLORS = {
  chalk: { bg: '#f1f0ec', ink: '#000', label: 'Chalk' },
  violet: { bg: '#cbbdff', ink: '#000', label: 'Violet' },
  amber: { bg: '#ffc7a3', ink: '#000', label: 'Amber' },
  mint: { bg: '#c4f0d6', ink: '#000', label: 'Mint' },
  sky: { bg: '#c3e2ff', ink: '#000', label: 'Sky' },
  rose: { bg: '#ffc6d6', ink: '#000', label: 'Rose' },
  ink: { bg: '#1b1b1a', ink: '#f1f0ec', label: 'Ink' },
}

// The member's ID card: photo (or a halftone bust), name, one line, stats.
// `placeholder` shows while someone is writing their own card; other people's cards leave it out
export default function ProfileCard({ name, bio, city, teaches = [], avatarUrl, color = 'chalk', stats = [], label = 'Profile card', placeholder = 'one line about you' }) {
  const c = CARD_COLORS[color] ?? CARD_COLORS.chalk
  return (
    <article className="idcard" aria-label={label} style={{ '--card-bg': c.bg, '--card-ink': c.ink }}>
      <div className="idcard-top">
        <span>{teaches[0] ?? 'New member'}{city && ` · ${city}`}</span>
        <Spark />
      </div>
      {avatarUrl ? (
        <img src={avatarUrl} alt={`${name}'s photo`} className="idcard-portrait idcard-photo" />
      ) : (
        <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />
      )}
      <h3 translate="no">{name || 'Your name'}</h3>
      {(bio || placeholder) && <p className="quote" translate={bio ? 'no' : undefined}>{bio || placeholder}</p>}
      {stats.length > 0 && (
        <dl className="idcard-stats">
          {stats.map(([k, v]) => (
            <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
          ))}
        </dl>
      )}
    </article>
  )
}

// A round photo or initials, for lists and the top bar.
// With a `handle`, the avatar carries that member's status dot (online, idle, busy, offline).
export function MemberAvatar({ name, url, large = false, handle }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
  const pic = url ? (
    <img src={url} alt="" className={`avatar avatar-photo ${large ? 'avatar-lg' : ''}`} />
  ) : (
    <span className={`avatar ${large ? 'avatar-lg' : ''}`} translate="no">{initials}</span>
  )
  if (!handle) return pic
  return (
    <span className="av-wrap">
      {pic}
      <StatusDot handle={handle} large={large} />
    </span>
  )
}

// The public link for a member. On the live site it is a clean /u/<handle> path.
export function profileUrl(handle) {
  return /^https?:$/.test(location.protocol) ? `${location.origin}/u/${handle}` : `${location.href.split('#')[0]}#/u/${handle}`
}

export function ShareProfile({ handle, name, title = 'Share your profile' }) {
  const url = profileUrl(handle)
  const [copied, setCopied] = useState(false)
  const text = `Learn something from ${name} on orbit`
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy your link', url)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }
  return (
    <section className="card share" aria-label={title}>
      <p className="label m-0">{title}</p>
      <div className="share-link">
        <span>{url.replace(/^https?:\/\//, '')}</span>
        <button type="button" className="btn btn-light btn-sm" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {navigator.share && (
          <button type="button" className="btn btn-line btn-sm" onClick={() => navigator.share({ title: `${name} on orbit`, text, url }).catch(() => {})}>
            Share…
          </button>
        )}
        <Link to={`/u/${handle}`} className="link text-[12px]">See it as a visitor</Link>
      </div>
    </section>
  )
}
