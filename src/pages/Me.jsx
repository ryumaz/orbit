import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProfileCard, { CARD_COLORS, ShareProfile } from '../components/ProfileCard'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { refreshMembers } from '../lib/members'
import { uploadAvatar, removeAvatar } from '../lib/avatar'

// Widely spoken languages, searchable. Anything else can be typed in.
const LANGS = [
  'English', 'Mandarin Chinese', 'Hindi', 'Spanish', 'French', 'Arabic', 'Bengali', 'Portuguese', 'Russian', 'Urdu',
  'Indonesian', 'German', 'Japanese', 'Nigerian Pidgin', 'Marathi', 'Telugu', 'Turkish', 'Tamil', 'Cantonese', 'Vietnamese',
  'Wu Chinese', 'Tagalog', 'Korean', 'Persian', 'Hausa', 'Swahili', 'Javanese', 'Italian', 'Punjabi', 'Gujarati',
  'Thai', 'Kannada', 'Amharic', 'Bhojpuri', 'Yoruba', 'Malayalam', 'Odia', 'Burmese', 'Ukrainian', 'Polish',
  'Igbo', 'Uzbek', 'Sindhi', 'Nepali', 'Romanian', 'Dutch', 'Pashto', 'Malay', 'Kurdish', 'Sinhala',
  'Assamese', 'Zulu', 'Hungarian', 'Greek', 'Czech', 'Swedish', 'Somali', 'Kazakh', 'Hebrew', 'Khmer',
  'Serbian', 'Croatian', 'Bulgarian', 'Azerbaijani', 'Haitian Creole', 'Danish', 'Finnish', 'Slovak', 'Norwegian', 'Tigrinya',
  'Xhosa', 'Afrikaans', 'Lao', 'Georgian', 'Armenian', 'Mongolian', 'Albanian', 'Lithuanian', 'Catalan', 'Konkani',
  'Maithili', 'Kashmiri', 'Tibetan', 'Maori', 'Hawaiian', 'Irish', 'Welsh', 'Icelandic', 'Estonian', 'Latvian',
  'Slovenian', 'Basque', 'Galician', 'Malagasy', 'Shona', 'Kinyarwanda', 'Quechua', 'Guarani', 'Esperanto', 'Sign language',
]

// The browser's own languages go first, so people mostly tap instead of type.
function browserLangs() {
  try {
    const names = new Intl.DisplayNames(['en'], { type: 'language' })
    return [...new Set((navigator.languages || []).map((code) => names.of(code.split('-')[0])))].filter(Boolean)
  } catch {
    return []
  }
}
const LANG_SUGGESTIONS = [...new Set([...browserLangs(), ...LANGS])]
const SKILLS = [
  'Maths', 'Physics', 'Python', 'Guitar', 'Cooking', 'Valorant', 'Chess', 'Yoga', 'Drawing', 'English speaking',
  'Calculus', 'Statistics', 'Chemistry', 'Biology', 'Economics', 'Accounting', 'History', 'Essay writing', 'Exam prep', 'Public speaking',
  'JavaScript', 'React', 'SQL', 'Java', 'C++', 'Git', 'Excel', 'Data analysis', 'Machine learning', 'Web design', 'Figma',
  'Free Fire', 'BGMI', 'Minecraft', 'Fortnite', 'League of Legends', 'Speedrunning',
  'Piano', 'Singing', 'Drums', 'Ukulele', 'Music production',
  'Baking', 'Indian cooking', 'Meal prep', 'Coffee',
  'Home workouts', 'Running', 'Calisthenics', 'Dance', 'Cricket', 'Football', 'Swimming',
  'Spanish', 'Japanese', 'French', 'German', 'Korean', 'Hindi',
  'Painting', 'Photography', 'Video editing', 'Animation', 'Calligraphy',
  'Budgeting', 'Investing basics', 'CV writing', 'Interview prep', 'Knitting',
]
const FIELDS = ['name', 'handle', 'bio', 'city', 'langs', 'teaches', 'learns', 'card_color']
const pick = (p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]]))
const tidy = (f) => ({ ...f, name: f.name.trim(), handle: f.handle.trim(), bio: f.bio.trim(), city: f.city.trim() })

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
    if (!/^[a-z0-9_]{3,20}$/.test(form.handle)) return setStatus({ ok: false, text: 'Usernames are 3 to 20 letters, numbers or _.' })
    setBusy(true)
    const { error } = await supabase.from('profiles').update(tidy(form)).eq('id', user.id)
    setBusy(false)
    if (error?.code === '23505') return setStatus({ ok: false, text: `@${form.handle} is taken. Try another.` })
    if (error) return setStatus({ ok: false, text: friendly(error) })
    refreshMembers()
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
          <ProfileCard
            name={form.name.trim()}
            bio={form.bio.trim()}
            city={form.city.trim()}
            teaches={form.teaches}
            avatarUrl={profile.avatar_url}
            color={form.card_color}
            stats={[['Taught', 0], ['Learned', 0], ['Credits', balance]]}
            label="Your card, preview"
          />

          <section className="card grid gap-5" aria-label="Photo and colour">
            <PhotoPicker uid={user.id} url={profile.avatar_url} onDone={async () => { refreshMembers(); await reload() }} />
            <div className="grid gap-2">
              <p className="label m-0">Card colour</p>
              <div role="radiogroup" aria-label="Card colour" className="swatches">
                {Object.entries(CARD_COLORS).map(([key, c]) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={form.card_color === key}
                    aria-label={c.label}
                    title={c.label}
                    className="swatch"
                    style={{ '--sw': c.bg }}
                    onClick={() => set('card_color')(key)}
                  />
                ))}
              </div>
            </div>
          </section>

          <ShareProfile handle={profile.handle} name={profile.name} />

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
              <label htmlFor="me-handle" className="label">Username <span className="dim">· your link is orbit.voids.wtf/u/{form.handle || '…'}</span></label>
              <div className="handle-input">
                <span aria-hidden="true">@</span>
                <input
                  id="me-handle"
                  className="input"
                  required
                  minLength={3}
                  maxLength={20}
                  autoComplete="off"
                  spellCheck={false}
                  value={form.handle}
                  onChange={(e) => set('handle')(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                />
              </div>
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
            <div className="block-head"><h2 id="h-langs">I speak</h2><span className="dim text-[11px]">{form.langs.length}/8</span></div>
            <TagField id="me-langs" value={form.langs} onChange={set('langs')} placeholder="search any language" suggestions={LANG_SUGGESTIONS} max={8} />
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

// Type and press Enter, or tap a suggestion (they filter as you type). Tap a tag to remove it.
function TagField({ id, value, onChange, placeholder, suggestions = SKILLS, max = 12 }) {
  const [text, setText] = useState('')
  const [all, setAll] = useState(false)
  const has = (t) => value.some((x) => x.toLowerCase() === t.toLowerCase())
  const q = text.trim().toLowerCase()
  const options = suggestions.filter((s) => !has(s) && (!q || s.toLowerCase().includes(q)))
  const shown = all ? options : options.slice(0, 10)
  const add = (raw) => {
    const t = raw.trim().replace(/\s+/g, ' ').slice(0, 30)
    if (!t || has(t) || value.length >= max) return
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
      <label htmlFor={id} className="sr-only">Add one</label>
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
        placeholder={value.length >= max ? `that’s the maximum of ${max}` : `${placeholder}, then Enter`}
        disabled={value.length >= max}
      />
      <div className="flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <button key={s} type="button" className="chip chip-sm" onClick={() => add(s)}>+ {s}</button>
        ))}
        {options.length > 10 && (
          <button type="button" className="chip chip-sm chip-more" aria-expanded={all} onClick={() => setAll(!all)}>
            {all ? 'Less' : `More · ${options.length - 10}`}
          </button>
        )}
      </div>
    </div>
  )
}

// Pick a photo; it is cropped, shrunk and saved straight away.
function PhotoPicker({ uid, url, onDone }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (job) => {
    setBusy(true)
    setError('')
    try {
      await job()
      await onDone()
    } catch (e) {
      setError(friendly(e))
    }
    setBusy(false)
  }
  return (
    <div className="grid gap-2">
      <p className="label m-0">Photo</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-light btn-sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? 'Saving…' : url ? 'Change photo' : 'Add a photo'}
        </button>
        {url && (
          <button type="button" className="btn btn-line btn-sm" disabled={busy} onClick={() => run(() => removeAvatar(uid, url))}>Remove</button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) run(() => uploadAvatar(uid, file, url))
        }}
      />
      {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
      <p className="m-0 text-[11px] dim">Cropped square and saved right away. Anyone with your link can see it.</p>
    </div>
  )
}
