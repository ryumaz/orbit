import { useState } from 'react'

const LABELS = ['', 'Not great', 'Could be better', 'Good', 'Really good', 'Brilliant']

function SparkGlyph({ on, size }) {
  return (
    <svg width={size} height={size} aria-hidden="true" className={`spark-star ${on ? 'on' : ''}`}>
      <use href="#spark" />
    </svg>
  )
}

// Ratings use orbit's spark instead of a star: violet→amber when lit.
export function SparkRating({ value, size = 16 }) {
  const full = Math.round(value ?? 0)
  return (
    <span className="spark-rating" role="img" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => <SparkGlyph key={n} on={n <= full} size={size} />)}
    </span>
  )
}

// Pick 1 to 5 sparks. Arrow keys work too.
export default function SparkStars({ value, onChange, size = 40 }) {
  const [hover, setHover] = useState(0)
  const shown = hover || value
  return (
    <div className="grid gap-2">
      <div
        className="spark-input"
        role="radiogroup"
        aria-label="Rating"
        onMouseLeave={() => setHover(0)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(5, (value || 0) + 1))
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(1, (value || 2) - 1))
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5: ${LABELS[n]}`}
            tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
            className="spark-star-btn"
            onMouseEnter={() => setHover(n)}
            onFocus={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            <SparkGlyph on={n <= shown} size={size} />
          </button>
        ))}
      </div>
      <span className="text-[12px] dim" aria-live="polite">{shown ? LABELS[shown] : 'Tap a spark'}</span>
    </div>
  )
}
