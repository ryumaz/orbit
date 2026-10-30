// Who this tab is. sessionStorage is per tab, so two tabs can be two students:
// that is how the live room is demoed before real sign-in exists.
import { useSyncExternalStore } from 'react'
import { PEOPLE } from './seed.js'

const KEY = 'unstuck:me'
const listeners = new Set()

export function getMe() {
  try {
    const id = sessionStorage.getItem(KEY)
    // an id from older sample data falls back to the default student
    return PEOPLE.some((p) => p.id === id) ? id : 'meera'
  } catch {
    return 'meera'
  }
}

export function setMe(id) {
  try {
    sessionStorage.setItem(KEY, id)
  } catch {
    /* private mode */
  }
  listeners.forEach((l) => l())
}

export function useMe() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    getMe,
  )
}
