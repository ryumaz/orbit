import { useEffect, useRef, useState } from 'react'

const OUT = 480 // saved photo is OUT x OUT pixels
const MAX_ZOOM = 4

// Drag to move, slide or scroll to zoom, then save a square crop.
// The ring shows how the photo looks as a round avatar.
export default function PhotoCropper({ file, onCancel, onSave }) {
  const view = useRef(null)
  const drag = useRef(null)
  const [img, setImg] = useState(null)
  const [size, setSize] = useState(300)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [busy, setBusy] = useState(false)

  // load the picked file
  useEffect(() => {
    const url = URL.createObjectURL(file)
    const el = new Image()
    el.onload = () => setImg(el)
    el.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // the square viewport's real size
  useEffect(() => {
    const measure = () => view.current && setSize(view.current.clientWidth)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // Escape cancels
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const base = img ? size / Math.min(img.naturalWidth, img.naturalHeight) : 1
  const scale = base * zoom
  const w = img ? img.naturalWidth * scale : size
  const h = img ? img.naturalHeight * scale : size
  // keep the photo covering the square at all times
  const clamp = (p, ww = w, hh = h) => ({ x: Math.min(0, Math.max(size - ww, p.x)), y: Math.min(0, Math.max(size - hh, p.y)) })

  // centre the photo when it first loads
  useEffect(() => {
    if (img) setPos({ x: (size - img.naturalWidth * base) / 2, y: (size - img.naturalHeight * base) / 2 })
  }, [img, size]) // eslint-disable-line react-hooks/exhaustive-deps

  // zoom around the middle of the square
  const zoomTo = (z) => {
    const next = Math.min(MAX_ZOOM, Math.max(1, z))
    const ratio = next / zoom
    const c = size / 2
    const nw = img.naturalWidth * base * next
    const nh = img.naturalHeight * base * next
    setPos((p) => clamp({ x: c - (c - p.x) * ratio, y: c - (c - p.y) * ratio }, nw, nh))
    setZoom(next)
  }

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }
  const onPointerMove = (e) => {
    if (drag.current) setPos(clamp({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }))
  }
  const onPointerUp = () => {
    drag.current = null
  }
  const onKeyDown = (e) => {
    const step = 12
    const moves = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (moves[e.key]) {
      e.preventDefault()
      setPos((p) => clamp({ x: p.x + moves[e.key][0], y: p.y + moves[e.key][1] }))
    } else if (e.key === '+' || e.key === '=') zoomTo(zoom + 0.2)
    else if (e.key === '-') zoomTo(zoom - 0.2)
  }

  const save = async () => {
    setBusy(true)
    const canvas = Object.assign(document.createElement('canvas'), { width: OUT, height: OUT })
    const ctx = canvas.getContext('2d')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, size / scale, size / scale, 0, 0, OUT, OUT)
    const webp = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.88))
    const blob = webp?.type === 'image/webp' ? webp : await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.88))
    await onSave(blob)
    setBusy(false)
  }

  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="crop-dialog" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div className="grid gap-1">
          <h2 id="crop-title" className="m-0 text-[16px] font-medium">Fit your photo</h2>
          <p className="m-0 text-[12px] dim">Drag to move it. Zoom with the slider or your scroll wheel.</p>
        </div>

        <div
          ref={view}
          className="crop-view"
          tabIndex={0}
          aria-label="Photo position. Use arrow keys to move, plus and minus to zoom."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={(e) => img && zoomTo(zoom * Math.exp(-e.deltaY * 0.0015))}
          onKeyDown={onKeyDown}
        >
          {img ? (
            <img src={img.src} alt="" draggable={false} style={{ width: w, height: h, transform: `translate(${pos.x}px, ${pos.y}px)` }} />
          ) : (
            <span className="dim text-[12px]">Loading…</span>
          )}
          <span className="crop-ring" aria-hidden="true" />
        </div>

        <label className="crop-zoom">
          <span className="label">Zoom</span>
          <input type="range" min="1" max={MAX_ZOOM} step="0.01" value={zoom} disabled={!img} onChange={(e) => zoomTo(Number(e.target.value))} />
        </label>

        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-line btn-sm" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="btn btn-light btn-sm" onClick={save} disabled={!img || busy}>{busy ? 'Saving…' : 'Save photo'}</button>
        </div>
      </div>
    </div>
  )
}
