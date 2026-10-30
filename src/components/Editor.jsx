import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { javascript } from '@codemirror/lang-javascript'
import { Annotation } from '@codemirror/state'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags as t } from '@lezer/highlight'

const MONO = '"Martian Mono", ui-monospace, monospace'
const remote = Annotation.define()

const theme = EditorView.theme(
  {
    '&': { backgroundColor: '#000', color: '#f1f0ec', fontSize: '13px', height: '100%' },
    '.cm-scroller': { fontFamily: MONO, lineHeight: '1.85' },
    '.cm-content': { caretColor: '#ff9455', padding: '20px 0' },
    '.cm-gutters': { backgroundColor: '#000', color: '#4c4b48', border: 'none', paddingLeft: '12px' },
    '.cm-activeLine': { backgroundColor: 'rgba(241,240,236,0.035)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#8d8c87' },
    '&.cm-focused': { outline: 'none' },
    '&.cm-focused .cm-cursor': { borderLeftColor: '#ff9455', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgba(155,130,255,0.28)' },
    '.cm-matchingBracket': { backgroundColor: 'rgba(255,148,85,0.18)', outline: 'none' },
  },
  { dark: true },
)

// Code is the machine voice (chalk and ash); comments are a person talking (violet).
const ink = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: '#8d8c87' },
  { tag: [t.string, t.special(t.string), t.regexp], color: '#ff9455' },
  { tag: [t.number, t.bool, t.null], color: '#ff9455' },
  { tag: [t.lineComment, t.blockComment], color: '#9b82ff', fontStyle: 'italic' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: '#ffffff' },
  { tag: [t.definition(t.variableName), t.typeName, t.className], color: '#ffffff' },
  { tag: [t.punctuation, t.bracket, t.operator], color: '#8d8c87' },
  { tag: [t.tagName, t.angleBracket], color: '#f1f0ec' },
])

// Shared editor. Until the server exists, tabs in one browser share the
// document through localStorage. The backend phase swaps this for Yjs.
export default function Editor({ roomKey, initial, readOnly = false, label, sync }) {
  const host = useRef(null)
  const viewRef = useRef(null)
  const lastAt = useRef(0) // time of the newest edit this editor has
  const syncRef = useRef(sync)
  syncRef.current = sync

  useEffect(() => {
    const key = `unstuck:doc:${roomKey}`
    let saved = null
    try {
      const stored = JSON.parse(localStorage.getItem(key))
      saved = stored?.text ?? null
      lastAt.current = stored?.at ?? 0
    } catch {
      saved = null
    }
    const view = new EditorView({
      parent: host.current,
      doc: saved ?? initial,
      extensions: [
        basicSetup,
        javascript({ jsx: true }),
        theme,
        syntaxHighlighting(ink),
        EditorView.editable.of(!readOnly),
        EditorView.contentAttributes.of({ 'aria-label': label }),
        EditorView.updateListener.of((u) => {
          if (!u.docChanged || u.transactions.some((tr) => tr.annotation(remote))) return
          const at = Date.now()
          lastAt.current = at
          syncRef.current?.send(u.state.doc.toString(), at)
          try {
            localStorage.setItem(key, JSON.stringify({ text: u.state.doc.toString(), at }))
          } catch {
            /* storage full or blocked: keep editing locally */
          }
        }),
      ],
    })
    const onStorage = (e) => {
      if (e.key !== key || !e.newValue) return
      let text
      try {
        text = JSON.parse(e.newValue).text
      } catch {
        return
      }
      const now = view.state.doc.toString()
      if (text === now) return
      const head = Math.min(view.state.selection.main.head, text.length)
      view.dispatch({ changes: { from: 0, to: now.length, insert: text }, selection: { anchor: head }, annotations: remote.of(true) })
    }
    window.addEventListener('storage', onStorage)
    viewRef.current = view
    return () => {
      window.removeEventListener('storage', onStorage)
      viewRef.current = null
      view.destroy()
    }
  }, [roomKey, initial, readOnly, label])

  // the other person's newer edits replace ours
  const incoming = sync?.incoming
  useEffect(() => {
    const view = viewRef.current
    if (!view || !incoming || incoming.at <= lastAt.current) return
    lastAt.current = incoming.at
    const now = view.state.doc.toString()
    if (incoming.text === now) return
    const head = Math.min(view.state.selection.main.head, incoming.text.length)
    view.dispatch({ changes: { from: 0, to: now.length, insert: incoming.text }, selection: { anchor: head }, annotations: remote.of(true) })
    try {
      localStorage.setItem(`unstuck:doc:${roomKey}`, JSON.stringify({ text: incoming.text, at: incoming.at }))
    } catch {
      /* ignore */
    }
  }, [incoming, roomKey])

  // when the other person arrives, send them what we have (they keep whichever is newer)
  const peerHere = sync?.peerHere
  useEffect(() => {
    if (peerHere && viewRef.current) syncRef.current?.send(viewRef.current.state.doc.toString(), lastAt.current)
  }, [peerHere])

  return <div ref={host} className="h-full min-h-[420px]" />
}
