import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

let lenis = null
let tick = null

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const finePointer = () => window.matchMedia('(pointer: fine)').matches

/** Buttery smooth scrolling, kept in sync with ScrollTrigger. */
export function startSmoothScroll() {
  if (lenis || prefersReducedMotion()) return lenis
  lenis = new Lenis({ lerp: 0.08, smoothWheel: true, wheelMultiplier: 0.9 })
  lenis.on('scroll', (l) => {
    ScrollTrigger.update()
    window.dispatchEvent(new CustomEvent('as:scroll', { detail: { velocity: l.velocity || 0 } }))
  })
  tick = (t) => lenis && lenis.raf(t * 1000)
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)
  return lenis
}

export function stopSmoothScroll() {
  if (!lenis) return
  gsap.ticker.remove(tick)
  lenis.destroy()
  lenis = null
}

export function scrollToTarget(selector) {
  const el = document.querySelector(selector)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { offset: -64, duration: 1.6 })
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/** Counts a number up inside `el`, e.g. 0 → 1,842. */
export function countUp(el, to, { decimals = 0, suffix = '', scrollTrigger, duration = 2.2, delay = 0 } = {}) {
  const fmt = (v) =>
    v.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix
  const o = { v: 0 }
  el.textContent = fmt(0)
  return gsap.to(o, {
    v: to, duration, delay, ease: 'expo.out', scrollTrigger,
    onUpdate: () => { el.textContent = fmt(o.v) },
  })
}

/** Cards lean slightly towards the pointer. Returns a cleanup function. */
export function addTilt(root) {
  if (!finePointer() || prefersReducedMotion()) return () => {}
  const offs = []
  root.querySelectorAll('[data-tilt]').forEach((el) => {
    const rx = gsap.quickTo(el, 'rotateX', { duration: 0.6, ease: 'power3.out' })
    const ry = gsap.quickTo(el, 'rotateY', { duration: 0.6, ease: 'power3.out' })
    gsap.set(el, { transformPerspective: 900 })
    const move = (e) => {
      const r = el.getBoundingClientRect()
      ry(((e.clientX - r.left) / r.width - 0.5) * 8)
      rx(-((e.clientY - r.top) / r.height - 0.5) * 8)
    }
    const leave = () => { rx(0); ry(0) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    offs.push(() => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave) })
  })
  return () => offs.forEach((f) => f())
}

export { gsap, ScrollTrigger }

export function resetScroll() {
  if (lenis) lenis.scrollTo(0, { immediate: true })
  else window.scrollTo(0, 0)
}
