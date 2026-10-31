import { useRef, useState } from 'react'
import { Link, NavLink, useParams } from 'react-router-dom'
import ProfileCard, { CARD_COLORS, ShareProfile } from '../components/ProfileCard'
import { useAccount } from '../lib/account'
import { supabase, friendly } from '../lib/supabase'
import { refreshMembers } from '../lib/members'
import { uploadAvatar, removeAvatar } from '../lib/avatar'
import PhotoCropper from '../components/PhotoCropper'
import LogOut from '../components/LogOut'
import NotifySetting from '../components/NotifySetting'
import AccountSecurity from '../components/AccountSecurity'
import LanguagePicker from '../components/LanguagePicker'
import LineIcon from '../components/LineIcons'
import { countries } from '../lib/countries'

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
const FIELDS = ['name', 'handle', 'bio', 'city', 'langs', 'teaches', 'learns', 'card_color', 'rate']
const pick = (p) => Object.fromEntries(FIELDS.map((k) => [k, p[k]]))
const tidy = (f) => ({ ...f, name: f.name.trim(), handle: f.handle.trim(), bio: f.bio.trim(), city: f.city.trim() })

const SECTIONS = [
  ['profile', 'Profile', 'Photo, name, username and your card'],
  ['skills', 'Teaching and learning', 'What you teach, your price, what you want to learn'],
  ['notifications', 'Notifications', 'Booking alerts on this device'],
  ['language', 'Language', 'The language orbit shows you'],
  ['account', 'Account and security', 'Email, password and sign-in'],
]

// Settings, sorted into sections with a side menu (tabs on phones). Profile and
// teaching share one form and one Save bar; the other sections save on their own.
export default function Me() {
  const { section = 'profile' } = useParams()
  const current = SECTIONS.find(([k]) => k === section) ?? SECTIONS[0]
  const { profile, user, balance, reload } = useAccount()
  const [form, setForm] = useState(() => pick(profile))
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const dirty = JSON.stringify(tidy(form)) !== JSON.stringify(pick(profile))
  const set = (key) => (value) => {
    setForm((f) => ({ ...f, [key]: value }))
    setStatus(null)
  }

  const save = async (e) => {
    e?.preventDefault()
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

  const editing = current[0] === 'profile' || current[0] === 'skills'

  return (
    <>
      <div className="view-head">
        <h1 className="page-title">Settings</h1>
        <p>Everything about your profile and account, sorted.</p>
      </div>

      <div className="settings">
        <nav className="settings-nav" aria-label="Settings sections">
          {SECTIONS.map(([k, label, hint]) => (
            <NavLink key={k} to={k === 'profile' ? '/me' : `/me/${k}`} end className={({ isActive }) => (isActive || (k === 'profile' && section === 'profile') ? 'is-active' : '')}>
              <LineIcon name={SECTION_ICON[k]} size={17} />
              <span className="grid">
                <b>{label}</b>
                <small>{hint}</small>
              </span>
            </NavLink>
          ))}
          <Link to={`/u/${profile.handle}`} className="settings-nav-out">
            <LineIcon name="arrow" size={15} /> See your public page
          </Link>
        </nav>

        <div className="settings-body">
          <header className="settings-head">
            <h2>{current[1]}</h2>
            <p>{current[2]}</p>
          </header>

          {current[0] === 'profile' && (
            <div className="settings-split">
              <form className="stack" onSubmit={save}>
                <section className="block grid gap-5" aria-label="Photo and colour">
                  <PhotoPicker uid={user.id} url={profile.avatar_url} onDone={async () => { refreshMembers(); await reload() }} />
                  <div className="grid gap-2">
                    <p className="label m-0">Card colour</p>
                    <div role="radiogroup" aria-label="Card colour" className="swatches">
                      {Object.entries(CARD_COLORS).map(([key, c]) => (
                        <button key={key} type="button" role="radio" aria-checked={form.card_color === key} aria-label={c.label} title={c.label} className="swatch" style={{ '--sw': c.bg }} onClick={() => set('card_color')(key)} />
                      ))}
                    </div>
                  </div>
                </section>
                <section className="block grid gap-4" aria-label="Basics">
                  <div className="grid gap-1.5">
                    <label htmlFor="me-name" className="label">Name</label>
                    <input id="me-name" className="input" required maxLength={40} autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="me-handle" className="label">Username <span className="dim">· your link is orbit.voids.wtf/u/{form.handle || '…'}</span></label>
                    <div className="handle-input">
                      <span aria-hidden="true">@</span>
                      <input id="me-handle" className="input" required minLength={3} maxLength={20} autoComplete="off" spellCheck={false} value={form.handle} onChange={(e) => set('handle')(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="me-bio" className="label">One line about you <span className="dim">· {form.bio.length}/160</span></label>
                    <textarea id="me-bio" className="input resize-y" rows={2} maxLength={160} value={form.bio} onChange={(e) => set('bio')(e.target.value)} placeholder="I can make anyone's dal taste like home" />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="me-city" className="label">Country <span className="dim">· optional, shown on your profile</span></label>
                    <select id="me-city" className="input select" value={form.city} onChange={(e) => set('city')(e.target.value)}>
                      <option value="">Don't show a country</option>
                      {/* an older free-text place stays selectable until it's changed */}
                      {form.city && !countries().includes(form.city) && <option value={form.city}>{form.city}</option>}
                      {countries().map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </section>
              </form>
              <aside className="stack settings-aside">
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
                <ShareProfile handle={profile.handle} name={profile.name} />
              </aside>
            </div>
          )}

          {current[0] === 'skills' && (
            <form className="stack" onSubmit={save}>
              <section className="block" aria-labelledby="h-teach">
                <div className="block-head"><h3 id="h-teach">I can teach</h3><span className="dim text-[11px]">{form.teaches.length}/12</span></div>
                <TagField id="me-teach" value={form.teaches} onChange={set('teaches')} placeholder="guitar chords, calculus, sourdough…" />
              </section>
              <section className="block grid gap-3" aria-labelledby="h-rate">
                <div className="block-head"><h3 id="h-rate">Your price</h3><span className="flex items-center gap-1 text-[22px]"><span className="dot-num spark-text">{form.rate}</span></span></div>
                <label htmlFor="me-rate" className="label">Credits for 30 minutes of your time <span className="dim">· 15 min costs {Math.ceil(form.rate / 2)}, 60 min costs {form.rate * 2}</span></label>
                <input id="me-rate" type="range" min="2" max="40" step="1" value={form.rate} onChange={(e) => set('rate')(Number(e.target.value))} className="rate-range" />
                <p className="m-0 text-[11.5px] dim">New here? Around 8 to 12 is typical. You can change it any time; booked sessions keep their price.</p>
              </section>
              <section className="block" aria-labelledby="h-learn">
                <div className="block-head"><h3 id="h-learn">I want to learn</h3><span className="dim text-[11px]">{form.learns.length}/12</span></div>
                <TagField id="me-learn" value={form.learns} onChange={set('learns')} placeholder="what you're stuck on or curious about" />
              </section>
              <section className="block" aria-labelledby="h-langs">
                <div className="block-head"><h3 id="h-langs">I speak</h3><span className="dim text-[11px]">{form.langs.length}/8</span></div>
                <TagField id="me-langs" value={form.langs} onChange={set('langs')} placeholder="search any language" suggestions={LANG_SUGGESTIONS} max={8} />
              </section>
            </form>
          )}

          {current[0] === 'notifications' && <NotifySetting />}

          {current[0] === 'language' && (
            <section className="block grid gap-3" aria-label="Language">
              <p className="m-0 text-[12.5px] dim">orbit translates every page into the language you pick. Names, bios and chat stay as people wrote them.</p>
              <LanguagePicker full />
            </section>
          )}

          {current[0] === 'account' && (
            <div className="stack">
              <AccountSecurity user={user} />
              <section className="block grid gap-3 text-[12.5px]" aria-label="More">
                <Link to="/activity" className="link self-start text-[12px]">See your activity log</Link>
                <div><LogOut className="btn btn-line btn-sm" confirmClass="btn btn-light btn-sm" /></div>
              </section>
            </div>
          )}

          {editing && (
            <div className="save-bar settings-save">
              <button type="button" className="btn btn-light" disabled={!dirty || busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
              <span role="status" className={`text-[12px] ${status?.ok === false ? 'text-amber' : 'dim'}`}>
                {status?.text ?? (dirty ? 'Unsaved changes' : 'All saved')}
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const SECTION_ICON = { profile: 'user', skills: 'star', notifications: 'bell', language: 'globe', account: 'lock' }

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
        <div className="tags" translate="no">
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

// Pick a photo, fit it in the cropper, and it is saved straight away.
function PhotoPicker({ uid, url, onDone }) {
  const input = useRef(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [picked, setPicked] = useState(null)
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
          if (!file) return
          if (!file.type.startsWith('image/')) return setError('Pick an image file (JPG, PNG or WebP).')
          setError('')
          setPicked(file)
        }}
      />
      {picked && (
        <PhotoCropper
          file={picked}
          onCancel={() => setPicked(null)}
          onSave={async (blob) => {
            setPicked(null)
            await run(() => uploadAvatar(uid, blob, url))
          }}
        />
      )}
      {error && <p role="alert" className="m-0 text-[12px] text-amber">{error}</p>}
      <p className="m-0 text-[11px] dim">You choose the crop. Anyone with your link can see it.</p>
    </div>
  )
}
