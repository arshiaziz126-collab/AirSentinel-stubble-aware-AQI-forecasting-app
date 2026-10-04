import { useEffect, useRef } from 'react'
import { finePointer, prefersReducedMotion } from '../lib/motion'

/** A light sprinkle of red smog particles drifting with the north-west wind. */
export default function Particles() {
  const ref = useRef(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv.getContext('2d')
    let W = 0, H = 0, raf = 0, running = true, boost = 0, mx = 0, my = 0
    const size = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2)
      W = cv.clientWidth; H = cv.clientHeight
      cv.width = W * d; cv.height = H * d
      ctx.setTransform(d, 0, 0, d, 0, 0)
    }
    size()
    const N = W < 700 ? 34 : 70
    const P = Array.from({ length: N }, () => ({
      x: Math.random() * W, y: Math.random() * H, r: Math.random() * 2.2 + 0.6,
      a: Math.random() * 0.45 + 0.15, e: Math.random() < 0.25, s: Math.random() * 0.7 + 0.35, ph: Math.random() * 6.28,
    }))
    const draw = (move) => {
      ctx.clearRect(0, 0, W, H)
      boost *= 0.94
      for (const p of P) {
        if (move) { p.x += (0.32 + boost) * p.s; p.y += (0.15 + boost * 0.45) * p.s; p.ph += 0.012 }
        if (p.x > W + 12) p.x = -12
        if (p.y > H + 12) p.y = -12
        const al = p.a * (0.6 + 0.4 * Math.sin(p.ph))
        ctx.beginPath()
        ctx.arc(p.x + mx * 24 * p.s, p.y + my * 24 * p.s, p.e ? p.r * 1.3 : p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.e ? `rgba(192,37,47,${Math.min(al + 0.2, 0.75)})` : `rgba(232,161,166,${al * 0.7})`
        ctx.fill()
      }
    }
    const frame = () => { if (!running) return; draw(true); raf = requestAnimationFrame(frame) }
    const onScroll = (e) => { boost = Math.min(Math.abs(e.detail.velocity) * 0.12, 5) }
    const onMove = (e) => { mx = e.clientX / window.innerWidth - 0.5; my = e.clientY / window.innerHeight - 0.5 }
    window.addEventListener('resize', size)

    if (prefersReducedMotion()) {
      draw(false)
      return () => window.removeEventListener('resize', size)
    }
    window.addEventListener('as:scroll', onScroll)
    if (finePointer()) window.addEventListener('pointermove', onMove)
    const io = new IntersectionObserver(([en]) => {
      const was = running
      running = en.isIntersecting
      if (running && !was) raf = requestAnimationFrame(frame)
    })
    io.observe(cv)
    raf = requestAnimationFrame(frame)
    return () => {
      running = false
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', size)
      window.removeEventListener('as:scroll', onScroll)
      window.removeEventListener('pointermove', onMove)
    }
  }, [])

  return <canvas ref={ref} className="haze" aria-hidden="true" />
}
