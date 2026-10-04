import { useEffect, useLayoutEffect, useRef } from 'react'
import Icon from './Icon'
import { addTilt, gsap, prefersReducedMotion } from '../lib/motion'

const PROFILES = [
  ['adult', 'Adult'], ['child', 'Child'], ['elderly', 'Older adult'], ['sensitive', 'Asthma or heart condition'],
]

const hourLabel = (h) => (h === 0 ? '12a' : h === 12 ? '12p' : h < 12 ? `${h}a` : `${h - 12}p`)

export default function Health({ data, advice, profile, onProfile, adviceError }) {
  const root = useRef(null)
  const first = useRef(true)
  const { hourly, best_window: win } = data
  const bars = hourly.filter((h) => h.hour % 2 === 0)
  const max = Math.max(...bars.map((b) => b.aqi), 1)
  const ok = (h) => h >= win.start && h < win.end

  // entrances: cards float up in 3D, bars grow, headings emerge from the haze
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('[data-emerge]').forEach((el) => {
        gsap.from(el, { y: 90, opacity: 0, filter: 'blur(16px)', scale: 0.97, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
      })
      gsap.from('.cards > *', {
        y: 160, opacity: 0, rotateX: 24, transformPerspective: 1000, transformOrigin: '50% 100%', filter: 'blur(10px)',
        duration: 1.6, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.cards', start: 'top 86%' },
      })
      gsap.from('.bars > div', { scaleY: 0, transformOrigin: '50% 100%', duration: 1.3, ease: 'expo.out', stagger: 0.05, scrollTrigger: { trigger: '.bars', start: 'top 85%' } })
    }, root)
    const untilt = addTilt(root.current)
    return () => { untilt(); ctx.revert() }
  }, [])

  // the headline lights up word by word as you scroll
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo('.sw', { opacity: 0.12 }, { opacity: 1, stagger: 0.1, ease: 'none', scrollTrigger: { trigger: '.statement', start: 'top 78%', end: 'bottom 42%', scrub: true } })
    }, root)
    return () => ctx.revert()
  }, [advice.headline])

  // when the profile changes, the new advice settles into place
  useEffect(() => {
    if (first.current) { first.current = false; return }
    if (prefersReducedMotion()) return
    gsap.fromTo(root.current.querySelectorAll('.cards > *'), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'expo.out', stagger: 0.06 })
  }, [advice])

  return (
    <section className="sec" id="health" data-pal="crimson" ref={root}>
      <div className="wrap">
        <p className="kicker" data-emerge>Your health today</p>
        <p className="statement" aria-label={advice.headline}>
          {advice.headline.split(' ').map((w, i) => <span key={`${advice.profile}-${i}`} aria-hidden="true"><span className="sw">{w}</span>{' '}</span>)}
        </p>
        <p className="impact" data-emerge>{advice.impact}</p>

        <div className="profiles" role="group" aria-label="Who is this for?" data-emerge>
          {PROFILES.map(([key, label]) => (
            <button key={key} type="button" className="pill" aria-pressed={profile === key} onClick={() => onProfile(key)}>{label}</button>
          ))}
        </div>
        {adviceError && <p className="fine" role="alert">{adviceError}</p>}

        <div className="cards">
          {advice.tips.map((t) => (
            <article className="card" data-tilt key={t.title}>
              <Icon name={t.icon} />
              <h3>{t.title}</h3>
              <p>{t.text}</p>
            </article>
          ))}
        </div>

        <div className="hours" data-emerge>
          <div className="hours-top"><h3>Cleanest hours today</h3><p>{win.label.replace(' and ', ' to ')}</p></div>
          <div className="bars" role="img" aria-label={`Typical hourly pattern for today. The air is cleanest between ${win.label}.`}>
            {bars.map((b) => <div key={b.hour} className={ok(b.hour) || ok(b.hour + 1) ? 'ok' : ''} style={{ height: `${(b.aqi / max) * 100}%` }} />)}
          </div>
          <div className="hrs num" aria-hidden="true">
            {bars.map((b) => <span key={b.hour} className={ok(b.hour) || ok(b.hour + 1) ? 'ok' : ''}>{hourLabel(b.hour)}</span>)}
          </div>
          <p className="fine">Based on the usual hour-by-hour pattern of Delhi's air in this month.</p>
        </div>
        <p className="fine">{advice.disclaimer}</p>
      </div>
    </section>
  )
}
