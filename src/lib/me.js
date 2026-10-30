// Who this tab is. sessionStorage is per tab, so two tabs can be two students:
// that is how the live room is demoed before real sign-in exists.
import { useSyncExternalStore } from 'react'

const KEY = 'unstuck:me'
const listeners = new Set()

export function getMe() {
  try {
    return sessionStorage.getItem(KEY) || 'meera'
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
