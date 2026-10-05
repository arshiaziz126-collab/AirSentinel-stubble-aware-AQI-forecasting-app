import { scrollToTarget } from '../lib/motion'

export default function Header({ data, loading, onDate }) {
  const go = (sel) => (e) => { e.preventDefault(); scrollToTarget(sel) }
  return (
    <header className="top">
      <div className="top-in">
        <a className="brand" href="#top" onClick={go('#top')}><span className="dot" aria-hidden="true" />AirSentinel</a>
        <nav className="nav" aria-label="Sections">
          <a href="#journey" onClick={go('#journey')}>How it happens</a>
          <a href="#health" onClick={go('#health')}>Your health</a>
          <a href="#model" onClick={go('#model')}>The model</a>
        </nav>
        <div className="place">
          {loading ? <span className="busy">Loading…</span> : <span className="live" aria-hidden="true" />}
          {data && (
            <label className="replay">
              <span className="lbl">Delhi NCR on</span>
              <input type="date" value={data.as_of} min={data.date_range.min} max={data.date_range.max}
                onChange={(e) => e.target.value && onDate(e.target.value)} aria-label="Day to replay" />
            </label>
          )}
        </div>
      </div>
      <div className="progress" aria-hidden="true" />
    </header>
  )
}
