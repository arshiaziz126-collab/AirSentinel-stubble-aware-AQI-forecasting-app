import { useLayoutEffect, useMemo, useRef } from 'react'
import Icon from './Icon'
import { countUp, gsap, prefersReducedMotion, scrollToTarget } from '../lib/motion'
import { dayMonth, fmt, weekday } from '../lib/data'

const W = 760, H = 440

/* ---------- fire map: real hotspots projected onto Punjab and Haryana ---------- */
function FireMap({ fires }) {
  const { bbox, points, delhi } = fires
  const px = (lon) => ((lon - bbox.west) / (bbox.east - bbox.west)) * W
  const py = (lat) => ((bbox.north - lat) / (bbox.north - bbox.south)) * H

  const { dots, glows, plume } = useMemo(() => {
    const dots = points.map((p) => ({ x: px(p.lon), y: py(p.lat), r: 1.6 + (Math.min(p.frp, 60) / 60) * 3 }))
    const bins = new Map()
    points.forEach((p) => {
      const k = `${Math.round(p.lat / 0.35)}:${Math.round(p.lon / 0.35)}`
      const b = bins.get(k) || { n: 0, lat: 0, lon: 0 }
      b.n += 1; b.lat += p.lat; b.lon += p.lon
      bins.set(k, b)
    })
    const top = [...bins.values()].sort((a, b) => b.n - a.n).slice(0, 4)
    const glows = top.map((b) => ({ x: px(b.lon / b.n), y: py(b.lat / b.n), r: 40 + Math.min(b.n, 120) / 120 * 40 }))
    const dx = px(delhi.lon), dy = py(delhi.lat)
    const plume = glows[0]
      ? `M${glows[0].x},${glows[0].y} Q${(glows[0].x + dx) / 2 + 40},${(glows[0].y + dy) / 2 - 30} ${dx},${dy}`
      : null
    return { dots, glows, plume }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points])

  const dx = px(delhi.lon), dy = py(delhi.lat)
  const lats = [28, 29, 30, 31, 32], lons = [74, 75, 76, 77]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Map of ${points.length} sampled fire hotspots in Punjab and Haryana, upwind of Delhi`}
      style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
      <defs>
        <radialGradient id="fireGlow"><stop offset="0%" stopColor="#C0252F" stopOpacity=".22" /><stop offset="60%" stopColor="#E8A1A6" stopOpacity=".12" /><stop offset="100%" stopColor="#E8A1A6" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width={W} height={H} fill="#FFFFFF" />
      <g stroke="#F4ECEA">
        {lats.map((l) => <line key={l} x1="0" x2={W} y1={py(l)} y2={py(l)} />)}
        {lons.map((l) => <line key={l} y1="0" y2={H} x1={px(l)} x2={px(l)} />)}
      </g>
      <g fontSize="10" fill="#C2B4B1">
        {lats.map((l) => <text key={l} x="8" y={py(l) - 6}>{l}°N</text>)}
        {lons.map((l) => <text key={l} x={px(l) + 6} y={H - 10}>{l}°E</text>)}
      </g>
      {plume && <path className="drift" d={plume} stroke="#A3202C" strokeOpacity=".07" strokeWidth="70" strokeLinecap="round" fill="none" />}
      {glows.map((g, i) => <circle key={i} cx={g.x} cy={g.y} r={g.r} fill="url(#fireGlow)" />)}
      <g className="flick" fill="#C0252F">{dots.filter((_, i) => i % 2 === 0).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)}</g>
      <g className="flick2" fill="#C0252F">{dots.filter((_, i) => i % 2 === 1).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={d.r} />)}</g>
      <text x={px(74.9)} y={py(31.6)} fontSize="12" fill="#9A8C89">Punjab</text>
      <text x={px(76.0)} y={py(28.9)} fontSize="12" fill="#9A8C89">Haryana</text>
      <circle cx={dx} cy={dy} r="6" fill="#FFFFFF" stroke="#1E1416" strokeWidth="1.5" />
      <text x={dx - 12} y={dy + 26} textAnchor="end" fontFamily="Sora, sans-serif" fontSize="15" fill="#1E1416">Delhi</text>
    </svg>
  )
}

/* ---------- wind: streamlines turned to today's wind direction ---------- */
function WindViz({ wind }) {
  const to = (wind.from_deg + 180) % 360
  const rot = to - 120   // the base drawing flows towards a bearing of 120 degrees
  const lines = [
    ['M-120,60 C120,80 360,180 880,330', 1, 0.9], ['M-120,110 C140,130 380,230 880,370', 0.8, 0.6],
    ['M-120,20 C160,40 400,130 880,280', 0.8, 0.55], ['M-120,170 C160,190 400,280 880,410', 0.7, 0.4],
    ['M-40,-40 C200,0 440,70 880,230', 0.7, 0.35], ['M-120,230 C140,250 360,330 820,480', 0.6, 0.25],
  ]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Wind from the ${wind.from} at ${wind.speed_kmh} kilometres per hour`}>
      <rect width={W} height={H} fill="#FFFFFF" />
      <g transform={`rotate(${rot} 380 220)`} fill="none" stroke="#C0252F" strokeLinecap="round">
        {lines.map(([d, w, o], i) => <path key={i} className="flow" d={d} strokeWidth={w} strokeDasharray="10 12" opacity={o} />)}
      </g>
      <g transform="translate(110,330)" fill="none" stroke="#E6D6D3"><circle r="54" /><circle r="40" strokeDasharray="1 5" /></g>
      <g transform={`translate(110,330) rotate(${to})`}><path d="M0,-44 L7,-8 L0,-14 L-7,-8 Z" fill="#C0252F" /></g>
      <text x="110" y="268" textAnchor="middle" fontFamily="Sora, sans-serif" fontSize="12" fill="#9A8C89">North</text>
    </svg>
  )
}

/* ---------- chart: last 10 days, plus the 3-day forecast ---------- */
function AqiChart({ history, forecast }) {
  const values = [
    ...history.map((d) => d.aqi), ...forecast.flatMap((f) => [f.low, f.high, f.actual]),
  ].filter((v) => v != null)
  const lo = Math.max(0, Math.floor((Math.min(...values) - 30) / 50) * 50)
  const hi = Math.ceil((Math.max(...values) + 30) / 50) * 50
  const x = (i) => 40 + i * 55
  const y = (v) => 190 - ((v - lo) / (hi - lo)) * 150
  const n = history.length
  const obs = history.map((d, i) => (d.aqi == null ? null : `${x(i)},${y(d.aqi)}`)).filter(Boolean).join(' ')
  const last = history[n - 1]
  const fc = [`${x(n - 1)},${y(last.aqi)}`, ...forecast.map((f, i) => `${x(n + i)},${y(f.aqi)}`)].join(' ')
  const band = [`${x(n - 1)},${y(last.aqi)}`, ...forecast.map((f, i) => `${x(n + i)},${y(f.high)}`),
    ...forecast.map((f, i) => ({ f, i })).reverse().map(({ f, i }) => `${x(n + i)},${y(f.low)}`)].join(' ')
  const peak = forecast.reduce((a, b) => (b.aqi > a.aqi ? b : a))
  const pi = forecast.indexOf(peak)
  const lines = [[200, 'Poor'], [300, 'Very poor'], [400, 'Severe']].filter(([v]) => v > lo && v < hi)
  const labelIdx = [0, 3, 6, n - 1, n + forecast.length - 1]

  return (
    <svg viewBox="0 0 760 250" role="img" style={{ fontFamily: "'IBM Plex Mono', monospace" }}
      aria-label={`AQI for the last ${n} days and a ${forecast.length}-day forecast peaking at ${peak.aqi} on ${weekday(peak.date)}`}>
      <defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#1E1416" stopOpacity=".07" /><stop offset="100%" stopColor="#1E1416" stopOpacity="0" /></linearGradient></defs>
      {lines.map(([v, name]) => (
        <g key={v}>
          <line x1="30" x2="740" y1={y(v)} y2={y(v)} stroke="#F1E6E3" />
          <text x="740" y={y(v) - 6} textAnchor="end" fontSize="11" fill="#9A8C89">{name} above {v}</text>
        </g>
      ))}
      <path d={`M${obs.split(' ')[0]} L${obs.split(' ').slice(1).join(' L')} L${x(n - 1)},190 L${x(0)},190 Z`} fill="url(#area)" />
      <polygon points={band} fill="#C0252F" opacity=".10" />
      <polyline className="obs-line" pathLength="1" strokeDasharray="1" strokeDashoffset="0" points={obs} fill="none" stroke="#1E1416" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      <polyline points={fc} fill="none" stroke="#C0252F" strokeWidth="1.4" strokeDasharray="5 6" strokeLinejoin="round" />
      <line x1={x(n - 1)} x2={x(n - 1)} y1="34" y2="190" stroke="#E6D6D3" strokeDasharray="2 4" />
      {forecast.map((f, i) => f.actual != null && <circle key={f.date} cx={x(n + i)} cy={y(f.actual)} r="3" fill="#9A8C89" />)}
      <circle cx={x(n - 1)} cy={y(last.aqi)} r="5" fill="#FFFFFF" stroke="#1E1416" strokeWidth="1.5" />
      <circle cx={x(n + pi)} cy={y(peak.aqi)} r="5" fill="#FFFFFF" stroke="#7A1420" strokeWidth="1.5" />
      <text x={x(n + pi)} y={Math.max(16, y(peak.aqi) - 16)} textAnchor="middle" fontSize="12" fill="#A3202C">{weekday(peak.date).slice(0, 3)} {peak.aqi}</text>
      <g fontSize="11" fill="#9A8C89" textAnchor="middle">
        {labelIdx.map((i) => {
          const d = i < n ? history[i].date : forecast[i - n].date
          return <text key={i} x={x(i)} y="218" fill={i === n - 1 ? '#1E1416' : '#9A8C89'}>{i === n - 1 ? 'Today' : dayMonth(d)}</text>
        })}
      </g>
    </svg>
  )
}

export default function Journey({ data }) {
  const root = useRef(null)
  const { fires, wind, forecast, history } = data
  const peak = forecast.reduce((a, b) => (b.aqi > a.aqi ? b : a))
  const change = fires.change_vs_last_week_pct

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const sec = root.current
    let mm
    const ctx = gsap.context(() => {
      mm = gsap.matchMedia()
      mm.add('(min-width: 900px)', () => {
        const track = sec.querySelector('.track')
        const dist = () => track.scrollWidth - window.innerWidth
        const move = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1 },
        })
        gsap.to('.j-fill', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: sec, start: 'top top', end: () => '+=' + dist(), scrub: true } })
        gsap.utils.toArray('.panel', sec).forEach((p, i) => {
          const st = i === 0 ? { trigger: sec, start: 'top 65%' } : { trigger: p, containerAnimation: move, start: 'left 70%' }
          gsap.from(p.querySelectorAll('[data-in]'), {
            x: i === 0 ? 0 : 120, y: i === 0 ? 90 : 30, opacity: 0, filter: 'blur(14px)', rotateY: i === 0 ? 0 : -12,
            transformPerspective: 1000, duration: 1.4, ease: 'expo.out', stagger: 0.09, scrollTrigger: st,
          })
          p.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), { scrollTrigger: st }))
          const vis = p.querySelector('.p-vis')
          if (vis && i > 0) {
            gsap.fromTo(vis, { y: 40 }, { y: -40, ease: 'none', scrollTrigger: { trigger: p, containerAnimation: move, start: 'left right', end: 'right left', scrub: true } })
          }
        })
        gsap.fromTo('.obs-line', { attr: { 'stroke-dashoffset': 1 } }, {
          attr: { 'stroke-dashoffset': 0 }, ease: 'none',
          scrollTrigger: { trigger: '.panel-city', containerAnimation: move, start: 'left 60%', end: 'left 5%', scrub: true },
        })
      })
      mm.add('(max-width: 899px)', () => {
        gsap.utils.toArray('.panel', sec).forEach((p) => {
          const st = { trigger: p, start: 'top 80%' }
          gsap.from(p.querySelectorAll('[data-in]'), { y: 80, opacity: 0, filter: 'blur(12px)', duration: 1.3, ease: 'expo.out', stagger: 0.08, scrollTrigger: st })
          p.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), { scrollTrigger: st }))
        })
        gsap.fromTo('.obs-line', { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 2, ease: 'power2.out', scrollTrigger: { trigger: '.panel-city', start: 'top 70%' } })
      })
    }, sec)
    return () => { mm && mm.revert(); ctx.revert() }
  }, [])

  return (
    <section className="journey" id="journey" data-pal="blush" aria-label="How the smoke reaches Delhi" ref={root}>
      <div className="track">
        <div className="panel">
          <div className="panel-in">
            <div className="p-copy">
              <p className="p-step" data-in>From the fields</p>
              <h2 className="p-h" data-in>It starts in the fields of Punjab and Haryana.</h2>
              <p className="p-t" data-in>After the rice harvest, farmers burn the leftover stubble. NASA satellites spot every fire from space.</p>
              <span className="big num" data-in data-count={fires.count_3d}>{fmt(fires.count_3d)}</span>
              <span className="big-cap" data-in>
                {`fires in the last three days${change != null ? `, ${change >= 0 ? 'up' : 'down'} ${Math.abs(change)}% on the week before` : ''}`}
              </span>
            </div>
            <div className="p-vis" data-in><div className="vis-card"><FireMap fires={fires} /></div></div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-in">
            <div className="p-copy">
              <p className="p-step" data-in>On the wind</p>
              <h2 className="p-h" data-in>Then the wind carries the smoke towards the city.</h2>
              <p className="p-t" data-in>Slow winds and cold nights trap it close to the ground, so it builds up instead of blowing away.</p>
              <span className="big num" data-in>{wind.speed_kmh} km/h</span>
              <span className="big-cap" data-in>{`wind from the ${wind.from}, with nights down to ${data.weather.tmin}°C`}</span>
            </div>
            <div className="p-vis" data-in><div className="vis-card"><WindViz wind={wind} /></div></div>
          </div>
        </div>

        <div className="panel panel-city">
          <div className="panel-in">
            <div className="p-copy">
              <p className="p-step" data-in>Over the city</p>
              <h2 className="p-h" data-in>And it settles over Delhi for days.</h2>
              <p className="p-t" data-in>LightGBM reads the last week of air, the fires upwind and the weather to forecast the next 72 hours.</p>
              <span className="big num" data-in data-count={peak.aqi}>{peak.aqi}</span>
              <span className="big-cap" data-in>{`forecast peak on ${weekday(peak.date)}, ${peak.category.label.toLowerCase()}`}</span>
            </div>
            <div className="p-vis" data-in>
              <div className="vis-card">
                <div style={{ padding: '28px 28px 8px' }}><AqiChart history={history} forecast={forecast} /></div>
                <div className="legend">
                  <span><i style={{ width: 18, height: 2, background: '#1E1416' }} />Measured</span>
                  <span><i style={{ width: 18, borderTop: '2px dashed #C0252F' }} />Forecast</span>
                  <span><i style={{ width: 14, height: 10, background: 'rgba(192,37,47,.15)', borderRadius: 2 }} />Likely range</span>
                  {forecast.some((f) => f.actual != null) && <span><i style={{ width: 7, height: 7, borderRadius: '50%', background: '#9A8C89' }} />What actually happened</span>}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-in">
            <div className="p-copy">
              <p className="p-step" data-in>Into our lungs</p>
              <h2 className="p-h" data-in>Some people feel it first.</h2>
              <p className="p-t" data-in>AirSentinel turns the forecast into simple advice for the people most at risk.</p>
              <div style={{ marginTop: 34 }} data-in>
                <a className="btn btn-solid" href="#health" onClick={(e) => { e.preventDefault(); scrollToTarget('#health') }}>Get health advice</a>
              </div>
            </div>
            <div className="p-vis">
              <div className="groups">
                <div className="grp" data-in><Icon name="child" /><div><strong>Children</strong><span>They breathe faster and take in more air for their size.</span></div></div>
                <div className="grp" data-in><Icon name="elder" /><div><strong>Older adults</strong><span>Heart and lung conditions are more common, and more easily triggered.</span></div></div>
                <div className="grp" data-in><Icon name="lungs" /><div><strong>People with breathing trouble</strong><span>Polluted days can bring on coughing and breathlessness.</span></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="j-rail" aria-hidden="true"><span>Fields</span><div className="j-bar"><div className="j-fill" /></div><span>People</span></div>
    </section>
  )
}
