// Orbi's 3D body: "Futuristic flying animated Robot - Low Poly" by Shayan
// (https://sketchfab.com/mshayan02, CC BY 4.0), the same robot as Vortex on voids.wtf.
// three.js comes from a CDN only when Orbi first draws, so it never weighs on the
// page itself. If anything fails (offline, no WebGL) the flat robot icon stays.
const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js'
const GLTF_URL = 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/loaders/GLTFLoader.js'
const MODEL_URL = './orbi-robot.glb'

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.async = true
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

let ready = null
function loadRobot() {
  ready ??= (async () => {
    if (!window.THREE) await loadScript(THREE_URL)
    if (!window.THREE.GLTFLoader) await loadScript(GLTF_URL)
    const bin = await fetch(MODEL_URL).then((r) => {
      if (!r.ok) throw new Error('model')
      return r.arrayBuffer()
    })
    return bin
  })()
  return ready
}

// "HELP" badge on the robot's head, in orbit's colours
function labelSprite(THREE) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 104
  const x = c.getContext('2d')
  const r = 44
  const g = x.createLinearGradient(0, 0, 256, 104)
  g.addColorStop(0, '#9b82ff')
  g.addColorStop(1, '#ff9455')
  x.fillStyle = 'rgba(8,8,8,0.9)'
  x.strokeStyle = g
  x.lineWidth = 6
  x.beginPath()
  x.moveTo(r + 4, 4)
  x.arcTo(252, 4, 252, 100, r)
  x.arcTo(252, 100, 4, 100, r)
  x.arcTo(4, 100, 4, 4, r)
  x.arcTo(4, 4, 252, 4, r)
  x.closePath()
  x.fill()
  x.stroke()
  x.fillStyle = '#f1f0ec'
  x.font = '700 50px "Martian Mono", ui-monospace, monospace'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.fillText('HELP', 128, 56)
  const tex = new THREE.CanvasTexture(c)
  tex.encoding = THREE.sRGBEncoding
  tex.anisotropy = 4
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }))
  sprite.renderOrder = 10
  return sprite
}

// Draws the robot into `canvas`. `state` is read every frame:
//   state.open  – the chat is open (the robot turns to face it)
//   state.spin  – set > 0 to spin it (pokes and drags); it winds down by itself
// Returns a stop function.
export function mountRobot(canvas, state, onReady) {
  let stopped = false
  let cleanup = () => {}
  loadRobot()
    .then((bin) => {
      if (stopped) return
      const THREE = window.THREE
      new THREE.GLTFLoader().parse(bin, '', (gltf) => {
        if (stopped) return
        cleanup = setup(THREE, gltf, canvas, state)
        onReady?.()
      }, () => {})
    })
    .catch(() => {})
  return () => {
    stopped = true
    cleanup()
  }
}

function setup(THREE, gltf, canvas, state) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' })
  } catch {
    return () => {}
  }
  const fit = () => {
    const s = canvas.clientWidth || 112
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(s, s, false)
  }
  fit()
  renderer.outputEncoding = THREE.sRGBEncoding

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100)
  camera.position.set(0, 0.15, 4.6)
  camera.lookAt(0, 0.1, 0)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x221a3a, 1.25))
  const key = new THREE.DirectionalLight(0xffffff, 1.5)
  key.position.set(2, 3, 4)
  scene.add(key)
  // violet and amber rims, orbit's two colours
  const rimA = new THREE.DirectionalLight(0x9b82ff, 0.9)
  rimA.position.set(-3, 1, -2)
  scene.add(rimA)
  const rimB = new THREE.DirectionalLight(0xff9455, 0.5)
  rimB.position.set(3, -1, -2)
  scene.add(rimB)

  const model = gltf.scene
  const mixer = new THREE.AnimationMixer(model)
  if (gltf.animations[0]) mixer.clipAction(gltf.animations[0]).play()
  mixer.update(0)

  // centre it and scale to about 1.7 units tall
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())
  const holder = new THREE.Group()
  model.position.sub(center)
  holder.add(model)
  const biggest = Math.max(size.x, size.y, size.z)
  holder.scale.setScalar(1.7 / biggest)
  const pivot = new THREE.Group()
  pivot.add(holder)
  scene.add(pivot)

  const label = labelSprite(THREE)
  label.position.set(0, ((size.y / biggest) * 1.7) / 2 + 0.08, 0.15)
  label.scale.set(0.78, 0.317, 1)
  pivot.add(label)
  document.fonts?.ready.then(() => {
    const fresh = labelSprite(THREE)
    label.material.map = fresh.material.map
    label.material.needsUpdate = true
  })

  // look toward the cursor
  let mx = 0
  let my = 0
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect()
    mx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)))
    my = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)))
  }
  window.addEventListener('pointermove', onMove, { passive: true })
  const ro = new ResizeObserver(fit)
  ro.observe(canvas)

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const clock = new THREE.Clock()
  let rotY = 0
  let rotX = 0
  let spinAngle = 0
  let acc = 0
  let raf = 0
  const frame = () => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min(clock.getDelta(), 0.1)
    acc += dt
    if (acc < 1 / 30) return // 30 frames a second is plenty for a small mascot
    const step = acc
    acc = 0
    if (!reduce) mixer.update(step)
    const t = clock.elapsedTime
    // face the chat when it's open; it opens on the other side of the screen
    const towardChat = state.side === 'left' ? 0.55 : -0.55
    const targetY = state.open ? towardChat : mx * 0.7
    const targetX = state.open ? 0.05 : my * 0.25
    rotY += (targetY - rotY) * 0.08
    rotX += (targetX - rotX) * 0.08
    if (state.spin > 0.002) {
      spinAngle += state.spin
      state.spin *= 0.93
    } else {
      state.spin = 0
      spinAngle *= 0.9
    }
    pivot.rotation.set(rotX, rotY + spinAngle, 0)
    pivot.position.y = reduce ? 0 : Math.sin(t * 1.8) * 0.06
    renderer.render(scene, camera)
  }
  frame()
  const onVis = () => {
    cancelAnimationFrame(raf)
    if (!document.hidden) {
      clock.getDelta()
      frame()
    }
  }
  document.addEventListener('visibilitychange', onVis)

  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    document.removeEventListener('visibilitychange', onVis)
    ro.disconnect()
    renderer.dispose()
  }
}
