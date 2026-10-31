import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Brand, Footer } from '../components/Shell'
import LanguagePicker from '../components/LanguagePicker'

const UPDATED = '31 October 2026'

// Plain-words policies. Each doc is a list of [id, heading, paragraphs].
const DOCS = {
  privacy: {
    title: 'Privacy policy',
    intro: 'What orbit keeps about you, who can see it, and how to make it go away. Written to be read.',
    sections: [
      ['who', 'Who we are', [
        'orbit is a skill-exchange site made by Void Century, a student team, for the Innovista hackathon (problem 05). People teach each other and pay with credits instead of money.',
        'Questions about your data go through the Support page; a person on the team answers.',
      ]],
      ['collect', 'What we keep', [
        'Your account: your email address and a password (stored scrambled by our login provider, never readable by us), or, if you sign in with GitHub, Discord or Google, the ID and email those services share with us.',
        'Your profile, which you write: name, username, photo, one line about you, country, languages, what you teach and want to learn, and your prices.',
        'What happens on orbit: sessions you book or teach, every credit movement, reviews, early-ending proposals, disputes, reports you file, support messages, and an audit log of these steps.',
        'Session chat: the messages and files you send in a session, so both of you can see them later and support can check them if there is a dispute.',
        'On your own device only: your login, chosen language, notification setting, saved translations, whiteboard and private notes, and what Vortex remembers about you. These stay in your browser.',
        'We use no advertising, no tracking pixels and no analytics cookies.',
      ]],
      ['public', 'What other people see', [
        'Anyone with your link sees your public profile: name, username, photo, bio, country, languages, skills, prices, rating and reviews.',
        'Only you see your email, credits, sessions list and audit log. Only the two people in a session (and, for a dispute, orbit admins) see its chat and files.',
        'Reports are seen only by orbit admins. The person you report never learns who reported them.',
      ]],
      ['calls', 'Calls, whiteboard and screen sharing', [
        'Video and voice go straight between the two browsers. orbit does not record or store calls.',
        'To connect, the browsers exchange short technical messages through our real-time service. If a network blocks direct calls, an encrypted relay run by Cloudflare may carry the call; it cannot see or hear it.',
      ]],
      ['services', 'Services we rely on', [
        'Supabase stores the database, logins and files (servers in Seoul, South Korea). Cloudflare hosts the site and, if you pick a language other than English, translates page text with an AI model; your chat, names and bios are never sent for translation.',
        'Some pieces load from public libraries: fonts from Google Fonts, the 3D robot code from jsDelivr, and flag pictures from flagcdn. They receive the basic information any website request carries, such as your IP address.',
      ]],
      ['keep', 'How long we keep it, and deleting', [
        'We keep your data while you have an account. You can change your profile, email and password any time in Settings.',
        'Deleting your account (Settings → Account and security) removes your email, sign-ins, profile details, photo, messages and support requests, and logs you out everywhere. Past sessions and credit records stay, under the name "Deleted member", so the people you taught or learned from keep an honest history.',
        'Open sessions must be finished, cancelled or settled first, so no one is left with credits on hold.',
      ]],
      ['age', 'Age', [
        'You need to be at least 13 to use orbit. If you are under 18, ask a parent or guardian first, and never meet anyone in person without one.',
      ]],
      ['changes', 'Changes', [
        `We will update this page if anything changes, with a new date at the top. Last updated ${UPDATED}.`,
      ]],
    ],
  },
  terms: {
    title: 'Terms of use',
    intro: 'The rules of orbit: how credits, sessions and disputes work, and how we expect people to treat each other.',
    sections: [
      ['using', 'Using orbit', [
        'One person, one account. Use your real name or a name people know you by, keep your login to yourself, and tell us if someone else gets into your account.',
        'orbit connects members who teach and learn. Teachers are members like you, not orbit staff, and orbit cannot promise any particular result from a session.',
      ]],
      ['credits', 'Credits, holds and disputes', [
        'Credits are orbit\'s way of keeping teaching fair. They have no cash value and cannot be bought, sold or exchanged for money. Everyone starts with 30.',
        'Teachers set a default price per 30 minutes and may set a different price for each skill. The price is fixed when the session is requested.',
        'A request waits up to 5 hours. Before it is accepted, the learner can cancel it; after 5 hours with no answer it expires. Nothing is charged for either.',
        'When the teacher accepts, the learner\'s credits are held. They go to the teacher when the learner presses "It worked", or automatically 24 hours after the booked time is over.',
        'If a session did not happen or did not help, the learner can open a dispute before that automatic payment. The credits stay on hold; orbit support reads both sides and the session chat, and decides how they split. That decision is final.',
        'Both people can also agree to end early and split the credits between themselves at any time.',
      ]],
      ['conduct', 'How to treat each other', [
        'Be respectful and turn up on time. No harassment, hate, threats, sexual content, scams, spam, or sharing anyone\'s private information.',
        'Do not try to move credits in ways the site does not allow, run fake sessions, or create extra accounts to boost ratings.',
        'If you meet in person, pick a public place and tell someone where you are going.',
        'Use "Report" on a profile or in a session room if something is wrong. Admins review every report.',
      ]],
      ['content', 'What you share', [
        'What you write and upload stays yours. You let orbit store it and show it to the people it is meant for: your profile to everyone, a session\'s chat and files to the other person in it (and admins in a dispute).',
        'Only share files you have the right to share. Files can be up to 25 MB: photos, videos, audio, PDFs, slides, documents and spreadsheets.',
      ]],
      ['enforce', 'When rules are broken', [
        'Admins may remove content, settle credits after a dispute, or suspend or close accounts that break these rules.',
      ]],
      ['service', 'The service', [
        'orbit is a student project. It can change, have bugs, or go offline. We do our best to keep your data safe and your credits correct, but we provide the site as it is, without guarantees, as far as the law allows.',
        `We may update these terms; the date at the top will change. Last updated ${UPDATED}.`,
      ]],
    ],
  },
}

export default function Docs() {
  const { doc = 'terms' } = useParams()
  const { hash } = useLocation()
  const d = DOCS[doc] ?? DOCS.terms

  // #section in the link scrolls there
  useEffect(() => {
    const id = hash.replace('#', '')
    if (id) setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
    else window.scrollTo(0, 0)
  }, [doc, hash])

  return (
    <div className="docs-page">
      <header className="docs-top">
        <Brand />
        <span className="flex items-center gap-4">
          <LanguagePicker />
          <Link to="/support" className="link text-[12px]">Support</Link>
        </span>
      </header>
      <div className="docs">
        <nav className="docs-nav" aria-label="Documents">
          <p className="docs-nav-title">orbit docs</p>
          {Object.entries(DOCS).map(([k, x]) => (
            <div key={k} className="docs-nav-group">
              <Link to={`/docs/${k}`} className={k === doc ? 'is-active' : ''}>{x.title}</Link>
              {k === doc && (
                <ul>
                  {x.sections.map(([id, h]) => (
                    <li key={id}><button type="button" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{h}</button></li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="docs-nav-group"><Link to="/support">Support</Link></div>
        </nav>
        <article className="docs-body">
          <p className="label m-0">Last updated {UPDATED}</p>
          <h1>{d.title}</h1>
          <p className="docs-intro">{d.intro}</p>
          {d.sections.map(([id, h, ps]) => (
            <section key={id} id={id} className="docs-section">
              <h2>{h}</h2>
              {ps.map((p, i) => <p key={i}>{p}</p>)}
            </section>
          ))}
        </article>
      </div>
      <Footer full />
    </div>
  )
}
