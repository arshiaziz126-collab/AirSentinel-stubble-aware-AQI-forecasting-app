const PATHS = {
  mask: <><path d="M4 9c3-2 13-2 16 0v4c-1 4-5 6-8 6s-7-2-8-6z" /><path d="M4 10L2 9M20 10l2-1" /></>,
  home: <><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" /></>,
  purifier: <><path d="M5 8h10a3 3 0 1 0-3-3" /><path d="M3 12h15a3 3 0 1 1-3 3" /><path d="M4 16h6" /></>,
  heart: <><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /><path d="M8 11h2l1-2 2 4 1-2h2" /></>,
  activity: <><circle cx="13" cy="4.5" r="2" /><path d="M7 21l3-6 3 2v5" /><path d="M10 15l1-6 4 3 3 1" /><path d="M8 11l3-2" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  child: <><circle cx="12" cy="7" r="3" /><path d="M7 21v-5a5 5 0 0 1 10 0v5" /></>,
  elder: <><circle cx="11" cy="6" r="3" /><path d="M8 21l1-7 3-2 2 3v6" /><path d="M17 12v9" /></>,
  lungs: <><path d="M12 4v7" /><path d="M12 11c-2 0-6 1-6 6 0 2 1 3 2.5 3S11 18 11 15" /><path d="M12 11c2 0 6 1 6 6 0 2-1 3-2.5 3S13 18 13 15" /></>,
}

export default function Icon({ name, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[name] || PATHS.heart}
    </svg>
  )
}
