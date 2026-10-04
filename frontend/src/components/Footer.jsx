import { useLayoutEffect, useRef } from 'react'
import { gsap, prefersReducedMotion } from '../lib/motion'
import { longDate } from '../lib/data'

export default function Footer({ data }) {
  const mark = useRef(null)
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(mark.current, { yPercent: 40 }, { yPercent: -10, ease: 'none', scrollTrigger: { trigger: mark.current, start: 'top bottom', end: 'bottom 60%', scrub: true } })
    })
    return () => ctx.revert()
  }, [])
  return (
    <footer className="foot" data-pal="wine">
      <div className="wrap">
        <div className="mark" ref={mark} aria-hidden="true">AirSentinel</div>
        <div className="foot-row">
          <span>Replaying {longDate(data.as_of)}. Data from CPCB, NASA FIRMS and Open-Meteo.</span>
          <span>General information, not medical advice.</span>
        </div>
      </div>
    </footer>
  )
}
