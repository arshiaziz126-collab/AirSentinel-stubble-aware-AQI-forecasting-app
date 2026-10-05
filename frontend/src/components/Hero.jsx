import { useLayoutEffect, useRef } from 'react'
import Particles from './Particles'
import { gsap, prefersReducedMotion, scrollToTarget } from '../lib/motion'
import { heroHeadline, longDate } from '../lib/data'

const C = 2 * Math.PI * 90   // ring circumference

export default function Hero({ data }) {
  const root = useRef(null)
  const num = useRef(null)
  const ring = useRef(null)
  const headline = heroHeadline(data)
  const aqi = data.today.aqi
  const dash = (Math.min(aqi, 500) / 500) * C

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
      tl.from('.hero-meta', { y: 18, opacity: 0, duration: 1 })
        .from('h1 .wi', { yPercent: 115, rotate: 5, duration: 1.5, stagger: 0.055 }, '-=.7')
        .from('.hero-sub', { y: 26, opacity: 0, filter: 'blur(10px)', duration: 1.3 }, '-=1.1')
        .from('.hero-cta > *', { y: 20, opacity: 0, duration: 1.1, stagger: 0.1 }, '-=1.1')
        .from('.gauge-box', { scale: 0.86, opacity: 0, rotate: -8, duration: 1.8 }, '-=1.6')
      gsap.fromTo(ring.current, { attr: { 'stroke-dasharray': `0 ${C}` } },
        { attr: { 'stroke-dasharray': `${dash} ${C}` }, duration: 2.6, ease: 'expo.out', delay: 0.5 })
      const o = { v: 0 }
      gsap.to(o, { v: aqi, duration: 2.6, ease: 'expo.out', delay: 0.5,
        onUpdate: () => { if (num.current) num.current.textContent = Math.round(o.v) } })
      const st = { trigger: root.current, start: 'top top', end: 'bottom top', scrub: true }
      gsap.to('.hero-copy', { y: -120, opacity: 0, filter: 'blur(8px)', ease: 'none', scrollTrigger: st })
      gsap.to('.gauge-box', { y: -200, scale: 0.82, opacity: 0.2, ease: 'none', scrollTrigger: { ...st } })
    }, root)
    return () => ctx.revert()
  }, [aqi, dash])

  const go = (sel) => (e) => { e.preventDefault(); scrollToTarget(sel) }

  return (
    <section className="hero" id="top" data-pal="white" ref={root}>
      <Particles />
      <div className="hero-in">
        <div className="hero-copy">
          <p className="hero-meta">Delhi NCR, {longDate(data.as_of)}</p>
          <h1 aria-label={headline}>
            {headline.split(' ').map((w, i) => (
              <span key={i} aria-hidden="true"><span className="w"><span className="wi">{w}</span></span>{' '}</span>
            ))}
          </h1>
          <p className="hero-sub">
            PyroAQ forecasts Delhi's air three days ahead by watching stubble fires in Punjab and Haryana,
            and the wind that carries their smoke.
          </p>
          <div className="hero-cta">
            <a className="btn btn-solid" href="#journey" onClick={go('#journey')}>See how it happens</a>
            <a className="btn btn-line" href="#health" onClick={go('#health')}>Get health advice</a>
          </div>
          {data.data_source === 'demo' && (
            <p className="demo-note">You're looking at synthetic demo data. Add the real CPCB, NASA FIRMS and Open-Meteo data to see real results.</p>
          )}
        </div>
        <div className="gauge">
          <div className="gauge-box">
            <svg viewBox="0 0 220 220" aria-hidden="true">
              <circle cx="110" cy="110" r="104" fill="none" stroke="#E7D8D5" strokeWidth="1" strokeDasharray="1 5" />
              <circle cx="110" cy="110" r="90" fill="none" stroke="#F1E5E2" strokeWidth="2.5" />
              <circle ref={ring} cx="110" cy="110" r="90" fill="none" stroke="#C0252F" strokeWidth="2.5"
                strokeLinecap="round" strokeDasharray={`${dash} ${C}`} transform="rotate(-90 110 110)" />
            </svg>
            <div className="gauge-mid">
              <span className="gauge-num num" ref={num}>{aqi}</span>
              <span className="gauge-cap">AQI, out of 500</span>
              <span className="gauge-cat">{data.today.category.label}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="cue" aria-hidden="true">Scroll<i /></div>
    </section>
  )
}
