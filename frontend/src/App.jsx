import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Header from './components/Header'
import Hero from './components/Hero'
import Journey from './components/Journey'
import Health from './components/Health'
import ModelSection from './components/ModelSection'
import Footer from './components/Footer'
import StatusScreen from './components/StatusScreen'
import { PALETTES, getAdvice, getDashboard } from './lib/data'
import { ScrollTrigger, gsap, prefersReducedMotion, resetScroll, startSmoothScroll, stopSmoothScroll } from './lib/motion'

export default function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState('child')
  const [advice, setAdvice] = useState(null)
  const [adviceError, setAdviceError] = useState(null)
  const profileRef = useRef(profile)
  profileRef.current = profile

  const load = useCallback(async (asOf) => {
    setLoading(true)
    setError(null)
    try {
      const d = await getDashboard(asOf, profileRef.current)
      setData(d)
      setAdvice(d.advice)
      setNotice(null)
      if (asOf) resetScroll()
    } catch (e) {
      if (asOf) setNotice(e.message)   // keep showing the current day
      else setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { startSmoothScroll(); return () => stopSmoothScroll() }, [])

  const changeProfile = async (p) => {
    setProfile(p)
    setAdviceError(null)
    try {
      setAdvice(await getAdvice(p, data.as_of))
    } catch (e) {
      setAdviceError(e.message)
    }
  }

  // The page moves from clean white to deep red as the smoke reaches the city
  useLayoutEffect(() => {
    if (!data) return
    const root = document.documentElement
    let ctx
    if (!prefersReducedMotion()) {
      root.classList.add('js-pal')
      gsap.set(root, PALETTES.white)
      ctx = gsap.context(() => {
        document.querySelectorAll('[data-pal]').forEach((sec) => {
          const pal = PALETTES[sec.dataset.pal]
          const set = () => gsap.to(root, { ...pal, duration: 1.2, ease: 'power2.inOut', overwrite: true })
          ScrollTrigger.create({ trigger: sec, start: 'top 55%', end: 'bottom 55%', onEnter: set, onEnterBack: set })
        })
        gsap.to('.progress', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.3 } })
      })
    }
    ScrollTrigger.refresh()
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    return () => {
      ctx && ctx.revert()
      root.classList.remove('js-pal')
    }
  }, [data?.as_of])

  if (!data) return <StatusScreen error={error} onRetry={() => load()} />

  return (
    <>
      <Header data={data} loading={loading} onDate={(d) => load(d)} />
      {notice && <p className="notice" role="alert" onClick={() => setNotice(null)}>{notice}</p>}
      <main key={data.as_of}>
        <Hero data={data} />
        <Journey data={data} />
        <Health data={data} advice={advice || data.advice} profile={profile} onProfile={changeProfile} adviceError={adviceError} />
        <ModelSection data={data} />
      </main>
      <Footer key={`f-${data.as_of}`} data={data} />
    </>
  )
}
