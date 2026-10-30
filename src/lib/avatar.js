import { supabase } from './supabase'

const MARKER = '/storage/v1/object/public/avatars/'

// Square-crop and shrink a picked photo to 320px, so uploads stay small and fast.
async function squash(file) {
  const bmp = await createImageBitmap(file)
  const size = 320
  const side = Math.min(bmp.width, bmp.height)
  const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size })
  canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size)
  const webp = await new Promise((r) => canvas.toBlob(r, 'image/webp', 0.85))
  return webp?.type === 'image/webp' ? webp : new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85))
}

function removeOld(url) {
  if (url?.includes(MARKER)) supabase.storage.from('avatars').remove([url.split(MARKER)[1]])
}

// Upload into the member's own folder, point the profile at it, drop the old file.
export async function uploadAvatar(uid, file, oldUrl) {
  if (!file.type.startsWith('image/')) throw new Error('Pick an image file (JPG, PNG or WebP).')
  const blob = await squash(file)
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
