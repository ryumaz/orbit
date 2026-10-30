import { useCallback, useEffect, useRef, useState } from 'react'

// orbit-styled replacement for window.confirm.
//   const [confirm, dialog] = useConfirm()
//   if (await confirm({ title, body, yes: 'Cancel session', danger: true })) …
//   …and render {dialog} somewhere in the component.
export function useConfirm() {
  const [ask, setAsk] = useState(null)
  const resolver = useRef(null)

  const confirm = useCallback(
    (opts) =>
      new Promise((resolve) => {
        resolver.current = resolve
        setAsk(opts)
      }),
    [],
  )
  const close = (answer) => {
    resolver.current?.(answer)
    resolver.current = null
    setAsk(null)
  }

  const dialog = ask ? <ConfirmDialog {...ask} onYes={() => close(true)} onNo={() => close(false)} /> : null
  return [confirm, dialog]
}

function ConfirmDialog({ title, body, yes = 'Yes', no = 'Keep it', danger = false, onYes, onNo }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onNo()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onNo])
  return (
    <div className="crop-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onNo()}>
      <div className="crop-dialog confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body">
        <h2 id="confirm-title" className="m-0 text-[17px] font-medium">{title}</h2>
        {body && <p id="confirm-body" className="m-0 text-[13px] leading-relaxed dim">{body}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" className="btn btn-line btn-sm" autoFocus onClick={onNo}>{no}</button>
          <button type="button" className={`btn btn-sm ${danger ? 'btn-danger' : 'btn-light'}`} onClick={onYes}>{yes}</button>
        </div>
      </div>
    </div>
  )
}
