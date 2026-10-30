// The spark is the credit. One gradient and one shape, defined once per page.
export function SparkDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="spark-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#9b82ff" />
          <stop offset="1" stopColor="#ff9455" />
        </linearGradient>
      </defs>
      <symbol id="spark" viewBox="-50 -50 100 100">
        <path d="M0,-50 C2,-2 2,-2 50,0 C2,2 2,2 0,50 C-2,2 -2,2 -50,0 C-2,-2 -2,-2 0,-50Z" />
      </symbol>
    </svg>
  )
}

export function Spark({ className = '', style }) {
  return (
    <svg className={`spark-svg ${className}`} style={style} aria-hidden="true">
      <use href="#spark" />
    </svg>
  )
}

// "8 ✦" — an amount of credits, readable to screen readers as "8 credits".
export function Credits({ n, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span>{n}</span>
      <Spark />
      <span className="sr-only">credits</span>
    </span>
  )
}

export const initials = (name) =>
  name.replace(/\./g, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
