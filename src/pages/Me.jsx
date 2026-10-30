import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Halftone from '../glyph/Halftone'
import { Spark } from '../components/Spark'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'

const LANGS = ['English', 'Hindi', 'Marathi', 'Gujarati', 'Tamil', 'Telugu', 'Bengali', 'Kannada']
const SKILLS = [
  'Maths', 'Physics', 'Python', 'React', 'SQL', 'Exam prep',
  'Guitar', 'Singing', 'Cooking', 'Baking', 'Valorant', 'Chess',
  'Yoga', 'Home workouts', 'Japanese', 'English speaking', 'Drawing', 'Video editing', 'Budgeting',
]
const FIELDS = ['name', 'bio', 'city', 'langs', 'teaches', 'learns']
const pick = (p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]]))
const tidy = (f) => ({ ...f, name: f.name.trim(), bio: f.bio.trim(), city: f.city.trim() })

// The member's own profile: a live preview of their card, and the form that edits it.
export default function Me() {
  const { profile, user, balance, reload, signOut } = useAccount()
  const navigate = useNavigate()
  const [form, setForm] = useState(() => pick(profile))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const dirty = JSON.stringify(tidy(form)) !== JSON.stringify(pick(profile))
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setStatus(null)
  }

  const save = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return setStatus({ ok: false, text: 'Your name can’t be empty.' })
    setBusy(true)
    const { error } = await supabase.from('profiles').update(tidy(form)).eq('id', user.id)
    setBusy(false)
    if (error) return setStatus({ ok: false, text: friendly(error) })
    await reload()
    setStatus({ ok: true, text: 'Saved. This is what members see now.' })
  }

  const logOut = async () => {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">You</h1>
        <p>This is what other members see before they book you. The card updates as you type.</p>
      </div>

      <div className="me-grid">
        <div className="stack">
          <article className="idcard" aria-label="Your card, preview">
            <div className="idcard-top"><span>{form.teaches[0] ?? 'New member'}{form.city.trim() && ` · ${form.city.trim()}`}</span><Spark /></div>
            <Halftone shape="bust" bg="#000" cells={34} className="idcard-portrait" />
            <h3>{form.name.trim() || 'Your name'}</h3>
            <p className="quote">{form.bio.trim() || 'one line about you'}</p>
            <dl className="idcard-stats">
              <div><dt>Taught</dt><dd>0</dd></div>
              <div><dt>Learned</dt><dd>0</dd></div>
              <div><dt>Credits</dt><dd>{balance}</dd></div>
            </dl>
          </article>

          <section className="card grid gap-3 text-[12.5px]" aria-labelledby="h-account">
            <h2 id="h-account" className="label m-0">Account</h2>
            <p className="m-0 break-all">{user.email}</p>
            <button type="button" className="btn btn-line btn-sm self-start" onClick={logOut}>Log out</button>
          </section>
        </div>

        <form className="stack" onSubmit={save}>
          <section className="block grid gap-4" aria-labelledby="h-basics">
            <div className="block-head"><h2 id="h-basics">Basics</h2></div>
            <div className="grid gap-1.5">
              <label htmlFor="me-name" className="label">Name</label>
              <input id="me-name" className="input" required maxLength={40} autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="me-bio" className="label">One line about you <span className="dim">· {form.bio.length}/160</span></label>
              <textarea id="me-bio" className="input resize-y" rows={2} maxLength={160} value={form.bio} onChange={(e) => set('bio')(e.target.value)} placeholder="I can make anyone's dal taste like home" />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="me-city" className="label">Area <span className="dim">· optional, for in-person sessions. Only this is shown.</span></label>
              <input id="me-city" className="input" maxLength={60} value={form.city} onChange={(e) => set('city')(e.target.value)} placeholder="Andheri, Mumbai" />
            </div>
          </section>

          <section className="block" aria-labelledby="h-teach">
            <div className="block-head"><h2 id="h-teach">I can teach</h2><span className="dim text-[11px]">{form.teaches.length}/12</span></div>
            <TagField id="me-teach" value={form.teaches} onChange={set('teaches')} placeholder="guitar chords, calculus, sourdough…" />
          </section>

          <section className="block" aria-labelledby="h-learn">
            <div className="block-head"><h2 id="h-learn">I want to learn</h2><span className="dim text-[11px]">{form.learns.length}/12</span></div>
            <TagField id="me-learn" value={form.learns} onChange={set('learns')} placeholder="what you're stuck on or curious about" />
          </section>

          <section className="block" aria-labelledby="h-langs">
            <div className="block-head"><h2 id="h-langs">I speak</h2></div>
            <div role="group" aria-labelledby="h-langs" className="flex flex-wrap gap-2">
              {LANGS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="chip"
                  aria-pressed={form.langs.includes(l)}
                  onClick={() => set('langs')(form.langs.includes(l) ? form.langs.filter((x) => x !== l) : [...form.langs, l])}
                >
                  {l}
                </button>
              ))}
            </div>
          </section>

          <div className="save-bar">
            <button type="submit" className="btn btn-light" disabled={!dirty || busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <span role="status" className={`text-[12px] ${status?.ok === false ? 'text-amber' : 'dim'}`}>
              {status?.text ?? (dirty ? 'Unsaved changes' : 'All saved')}
            </span>
          </div>
        </form>
      </div>
    </>
  )
}

// Type a skill and press Enter, or tap a suggestion. Tap a tag to remove it.
function TagField({ id, value, onChange, placeholder }) {
  const [text, setText] = useState('')
  const has = (t) => value.some((x) => x.toLowerCase() === t.toLowerCase())
  const add = (raw) => {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 30)
    if (!t || has(t) || value.length >= 12) return
    onChange([...value, t])
    setText('')
  }
  return (
    <div className="grid gap-3">
      {value.length > 0 && (
        <div className="tags">
          {value.map((t) => (
            <button key={t} type="button" className="tag tag-x" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}>
              {t} <span aria-hidden="true">×</span>
            </button>
          ))}
        </div>
      )}
      <label htmlFor={id} className="sr-only">Add a skill</label>
      <input
        id={id}
        className="input"
        value={text}
        maxLength={30}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(text)
          }
        }}
        onBlur={() => text.trim() && add(text)}
        placeholder={value.length >= 12 ? 'that’s the maximum of 12' : `${placeholder} then Enter`}
        disabled={value.length >= 12}
      />
      <div className="flex flex-wrap gap-1.5">
        {SKILLS.filter((s) => !has(s)).slice(0, 10).map((s) => (
          <button key={s} type="button" className="chip chip-sm" onClick={() => add(s)}>+ {s}</button>
        ))}
      </div>
    </div>
  )
}
