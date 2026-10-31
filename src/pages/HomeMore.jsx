import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import LineIcon from '../components/LineIcons'
import { SOCIAL, openHelp } from '../components/Shell'

// Landing page sections in the style of a product docs page: grouped feature
// cards with a side index, quick answers, and a community card.

const GROUPS = [
  {
    id: 'f-find',
    title: 'Find someone',
    sub: 'Search people and skills, then book them in a minute.',
    items: [
      ['search', 'Search by skill', 'Type a skill, game or subject and see every member who teaches it, with their price and rating.', '/find'],
      ['user', 'Public profiles', 'Every member gets a page at orbit.voids.wtf/u/name, with a photo, skills and reviews, to share anywhere.', '/me'],
      ['clock', '15 to 60 minutes', 'Pick a length and see the exact price before you ask. Nothing is charged until they accept.', '/find'],
    ],
  },
  {
    id: 'f-room',
    title: 'In the room',
    sub: 'Everything you need to actually learn, in one tab.',
    items: [
      ['video', 'Video and voice', 'Calls go straight between your two browsers. Join with your camera, or with voice only.', '/sessions'],
      ['screen', 'Screen share, full screen', 'Show your screen in one click, and blow up the other person\'s video to full screen.', '/sessions'],
      ['pen', 'Shared whiteboard', 'Draw it out together. Both of you see every line as it happens, in five colours.', '/sessions'],
      ['code', 'Code editor', 'For code lessons: one editor, two cursors, highlighted as you type.', '/sessions'],
      ['chat', 'Chat and notes', 'Message each other in the room, and keep private notes of what you learned.', '/sessions'],
    ],
  },
  {
    id: 'f-credits',
    title: 'Credits you can trust',
    sub: 'Fair for both sides, down to the last credit.',
    items: [
      ['lock', 'Held until it helped', 'Credits wait on hold while you learn and only move when you say it worked.', '#escrow'],
      ['split', 'End early, split fairly', 'Want to stop sooner? Agree on a split together; nothing moves until you both say yes.', '#escrow'],
      ['receipt', 'Every credit has a receipt', 'Balances are added up from a ledger nobody can edit. See every row on your Credits page.', '/credits'],
      ['star', 'Ratings and reviews', 'After each paid session, rate each other from one to five sparks and say a few words.', '/sessions'],
    ],
  },
  {
    id: 'f-loop',
    title: 'Stay in the loop',
    sub: 'Never miss a booking, and never get stuck.',
    items: [
      ['bell', 'Booking notifications', 'A card and a chime when someone books you, accepts or pays, even from another tab.', '/me/notifications'],
      ['robot', 'Vortex, your helper', 'Ask the little robot in the corner anything about orbit, or pass a message to support.', 'help'],
      ['key', 'Sign in your way', 'Email and password, or GitHub and Discord in one click. Ready in under a minute.', '/join'],
    ],
  },
]

export function Features() {
  const navigate = useNavigate()
  const [active, setActive] = useState(GROUPS[0].id)

  // the side index follows the group you're reading
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-35% 0px -55% 0px' },
    )
    GROUPS.forEach((g) => {
      const el = document.getElementById(g.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  const go = (to) => {
    if (to === 'help') return openHelp()
    if (to.startsWith('#')) return document.getElementById(to.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    navigate(to)
  }
  const jumpTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="lsection" id="features">
      <div className="section-head">
        <h2>Everything in one place.</h2>
        <p>Find someone, learn together, settle up fairly. Here's what orbit does at every step.</p>
      </div>
      <div className="feat">
        <nav className="feat-index" aria-label="Features">
          <p className="feat-index-title">orbit features</p>
          {GROUPS.map((g) => (
            <div key={g.id} className="feat-index-group">
              <button type="button" className={`feat-index-head ${active === g.id ? 'is-active' : ''}`} onClick={() => jumpTo(g.id)}>{g.title}</button>
              <ul>
                {g.items.map(([icon, title]) => (
                  <li key={title}>
                    <button type="button" onClick={() => jumpTo(g.id)}><LineIcon name={icon} size={15} /> {title}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="feat-groups">
          {GROUPS.map((g) => (
            <div key={g.id} id={g.id} className="feat-group">
              <h3>{g.title}</h3>
              <p className="feat-sub">{g.sub}</p>
              <div className="feat-cards">
                {g.items.map(([icon, title, body, to]) => (
                  <button key={title} type="button" className="feat-card" onClick={() => go(to)}>
                    <span className="feat-card-head">
                      <LineIcon name={icon} />
                      <b>{title}</b>
                      <LineIcon name="arrow" size={16} className="feat-arrow" />
                    </span>
                    <span className="feat-card-body">{body}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const QUESTIONS = [
  ['What is orbit?', 'A place to swap skills. You teach what you know (a game, an instrument, a subject, a recipe) and earn credits, then spend those credits learning from someone else. Sessions run 15 to 60 minutes by video, voice or in person.'],
  ['Does it cost money?', 'No. orbit runs on credits, never money. Everyone starts with 30 credits, and you earn more by teaching.'],
  ['What can I learn or teach?', 'Anything someone else wants to know: study subjects, coding, gaming, music, cooking, languages, fitness, art. If you can explain it in half an hour, it belongs here.'],
  ['What if the lesson didn\'t help?', 'Then don\'t press "It worked". Your credits stay on hold, and you can agree an early end and a fair split with the teacher. If something went wrong, tell support through Vortex.'],
  ['Do I need to install anything?', 'No. Everything runs in your browser on a phone or a computer. Allow the microphone (and camera if you want video) when the browser asks.'],
  ['Can we meet in person?', 'Yes. Add your country to your profile and agree on a place in chat. Credits work exactly the same way.'],
  ['Who can see my details?', 'Only your public profile: name, handle, photo, bio, skills and reviews. Your email is never shown, and calls go straight between the two browsers and aren\'t recorded.'],
  ['How do I get more credits?', 'Teach. Add what you know on your profile and set a price; every session you teach adds that price to your balance once the learner says it worked.'],
]

export function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section className="lsection faq" id="faq">
      <div className="faq-head">
        <h2>Before you book.</h2>
        <p>Quick answers on credits, sessions and safety.</p>
        <button type="button" className="faq-more" onClick={() => openHelp()}>
          Ask Vortex anything else <LineIcon name="arrow" size={14} />
        </button>
      </div>
      <div className="faq-list">
        {QUESTIONS.map(([q, a], i) => {
          const on = open === i
          return (
            <div key={q} className={`faq-item ${on ? 'is-open' : ''}`}>
              <h3>
                <button type="button" aria-expanded={on} aria-controls={`faq-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(on ? -1 : i)}>
                  <span>{q}</span>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                </button>
              </h3>
              <div id={`faq-${i}`} role="region" aria-labelledby={`faq-q-${i}`} className="faq-a">
                <div><p>{a}</p></div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function Community() {
  return (
    <section className="lsection" id="community">
      <div className="community">
        <div className="grid gap-2">
          <p className="label m-0">community</p>
          <h2>Make orbit work for you.</h2>
          <p className="m-0 dim">Get help on Discord, share what you learned, or report a problem straight to support.</p>
        </div>
        <div className="community-actions">
          <a href={SOCIAL.discord} target="_blank" rel="noreferrer" className="btn btn-light community-discord">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M20.32 4.37a19.8 19.8 0 00-4.89-1.52.07.07 0 00-.08.04c-.21.38-.44.87-.61 1.25a18.27 18.27 0 00-5.49 0 12.64 12.64 0 00-.62-1.25.08.08 0 00-.08-.04 19.74 19.74 0 00-4.88 1.52.07.07 0 00-.03.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 00.03.06 19.9 19.9 0 005.99 3.03.08.08 0 00.08-.03c.46-.63.87-1.3 1.23-1.99a.08.08 0 00-.04-.11 13.1 13.1 0 01-1.87-.89.08.08 0 01-.01-.13c.13-.09.25-.19.37-.29a.07.07 0 01.08-.01c3.93 1.79 8.18 1.79 12.06 0a.07.07 0 01.08.01c.12.1.25.2.37.29a.08.08 0 01-.01.13c-.6.35-1.22.65-1.87.89a.08.08 0 00-.04.11c.36.7.77 1.36 1.23 1.99a.08.08 0 00.08.03 19.84 19.84 0 006-3.03.08.08 0 00.03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 00-.03-.03zM8.02 15.33c-1.18 0-2.16-1.09-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.96 2.42-2.16 2.42zm7.97 0c-1.18 0-2.15-1.09-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.33-.95 2.42-2.16 2.42z" /></svg>
            Join Discord
          </a>
          <a href={SOCIAL.github} target="_blank" rel="noreferrer" className="community-link">
            <svg viewBox="0 0 16 16" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
            GitHub
          </a>
          <button type="button" className="community-link" onClick={() => openHelp('human')}>
            <LineIcon name="bug" size={17} /> Report an issue
          </button>
        </div>
      </div>
      <p className="m-0 mt-3 text-[11px] dim">
        Prefer to read first? <Link to="/find" className="link">See who teaches what</Link>.
      </p>
    </section>
  )
}
