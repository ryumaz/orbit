import { supabase } from './supabase'

const MARKER = '/storage/v1/object/public/avatars/'

function removeOld(url) {
  if (url?.includes(MARKER)) supabase.storage.from('avatars').remove([url.split(MARKER)[1]])
}

// Upload the cropped photo into the member's own folder, point the profile at it, drop the old file.
export async function uploadAvatar(uid, blob, oldUrl) {
  if (!blob?.type.startsWith('image/')) throw new Error('That photo could not be prepared. Try another one.')
  const path = `${uid}/${Date.now()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`
  const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (up.error) throw up.error
  const url = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
  const res = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid)
  if (res.error) throw res.error
  removeOld(oldUrl)
  return url
}

export async function removeAvatar(uid, oldUrl) {
  const res = await supabase.from('profiles').update({ avatar_url: '' }).eq('id', uid)
  if (res.error) throw res.error
  removeOld(oldUrl)
}
