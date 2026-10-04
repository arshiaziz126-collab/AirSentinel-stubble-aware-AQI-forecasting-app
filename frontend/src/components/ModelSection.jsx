import { useLayoutEffect, useRef } from 'react'
import { addTilt, countUp, gsap, prefersReducedMotion } from '../lib/motion'
import { weekday } from '../lib/data'

export default function ModelSection({ data }) {
  const root = useRef(null)
  const { drivers, model, forecast } = data
  const top = drivers[0]?.share || 1
  const best = Math.min(...model.models.map((m) => m.mae))
  const season = model.stubble_season_mae || {}
  const s1 = season.lightgbm?.['1'], b1 = season.baseline?.['1']
  const next = forecast[0]
    const fire = model.fire_ablation?.stubble_season

  useLayoutEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray('[data-emerge]').forEach((el) => {
        gsap.from(el, { y: 90, opacity: 0, filter: 'blur(16px)', scale: 0.97, duration: 1.5, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
      })
      gsap.from('.model > *', {
        y: 160, opacity: 0, rotateX: 24, transformPerspective: 1000, transformOrigin: '50% 100%', filter: 'blur(10px)',
        duration: 1.6, ease: 'expo.out', stagger: 0.12, scrollTrigger: { trigger: '.model', start: 'top 86%' },
      })
      gsap.utils.toArray('.track-x i').forEach((el) => {
        gsap.from(el, { scaleX: 0, transformOrigin: 'left center', duration: 1.8, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 92%' } })
      })
      gsap.utils.toArray('[data-count]', root.current).forEach((el) => {
        countUp(el, Number(el.dataset.count), { decimals: Number(el.dataset.dec || 0), suffix: el.dataset.suffix || '', scrollTrigger: { trigger: el, start: 'top 90%' } })
      })
    }, root)
    const untilt = addTilt(root.current)
    return () => { untilt(); ctx.revert() }
  }, [])

  return (
    <section className="sec" id="model" data-pal="wine" ref={root}>
      <div className="wrap">
        <p className="kicker" data-emerge>The model</p>
        <h2 className="h2" data-emerge>Not just a number. A reason.</h2>
        <p className="lead" data-emerge>
          SHAP shows how much each factor pushed {weekday(next.date)}'s forecast of {next.aqi} up, so an alert is never a black box.
        </p>
        <div className="model">
          <div className="shap" data-tilt>
            <h3>What's pushing the forecast up</h3>
            {drivers.map((d, i) => {
              const pct = Math.round(d.share * 100)
              return (
                <div key={d.factor}>
                  <div className="row-top"><span>{d.factor}</span><span className="num" data-count={pct} data-suffix="%">{pct}%</span></div>
                  <div className="track-x"><i className={i === 0 ? 'hi' : ''} style={{ width: `${(d.share / top) * 100}%` }} /></div>
                </div>
              )
            })}
          </div>
          <div className="scores" data-tilt>
            <h3>Average error in AQI points, lower is better</h3>
            {model.models.map((m) => (
              <div key={m.name} className={`score${m.chosen ? ' chosen' : ''}`}>
                <span>{m.name}{m.chosen ? ', in use' : ''}<small>{m.detail}{m.mae === best ? ', lowest error' : ''}</small></span>
                <span className="num" data-count={m.mae} data-dec="1">{m.mae.toFixed(1)}</span>
              </div>
            ))}
                        {fire && fire.improvement_pct > 0 && (
              <p className="note">
                Satellite fire data cut the stubble-season error by {fire.improvement_pct}%, from {fire.without_fires} to {fire.with_fires} AQI points.
              </p>
            )}
            <p className="note">
              Tested on {model.test_period[0]} to {model.test_period[1]}, data the model never saw while training.
              {s1 != null && b1 != null && ` In the stubble season, the next-day error was ${s1} against ${b1} for the naive baseline.`}
              {model.trained_on === 'demo' && ' These numbers come from synthetic demo data.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
