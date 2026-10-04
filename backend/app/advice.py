"""Plain-language health advice by AQI band and who it's for.

This is general guidance based on CPCB health statements, not medical advice.
"""

PROFILES = {
    "adult": "Adults",
    "child": "Children",
    "elderly": "Older adults",
    "sensitive": "People with breathing or heart conditions",
}

# Headline per profile for each band level (0 good .. 5 severe)
HEADLINES = {
    "adult": [
        "A good day to be outside.", "A good day to be outside.",
        "Fine for most people today.", "Cut back on long or hard outdoor exercise.",
        "Avoid outdoor exercise today.", "Stay indoors and skip all outdoor exercise.",
    ],
    "child": [
        "A good day for outdoor play.", "A good day for outdoor play.",
        "Outdoor play is fine, with breaks.", "Keep outdoor play short today.",
        "Keep children indoors this morning.", "Keep children indoors all day.",
    ],
    "elderly": [
        "A good day for a walk outside.", "A good day for a walk outside.",
        "Fine for a gentle walk today.", "Limit time outdoors, especially in the morning.",
        "Stay indoors as much as you can.", "Stay indoors all day.",
    ],
    "sensitive": [
        "Air is clean enough for most activities.", "Mostly fine, but watch for symptoms.",
        "Keep outdoor time short and carry your inhaler.", "Stay indoors where you can and keep medicines handy.",
        "Stay indoors and keep medicines handy.", "Stay indoors all day and call your doctor if symptoms get worse.",
    ],
}

TIPS_LOW = [
    {"icon": "activity", "title": "Enjoy time outside", "text": "A good day for walks, sport and outdoor play."},
    {"icon": "home", "title": "Open the windows", "text": "Let fresh air through your home while it lasts."},
    {"icon": "calendar", "title": "Check the next few days", "text": "Stubble season can change the air within a day."},
    {"icon": "heart", "title": "Keep inhalers handy", "text": "Sensitive people may still notice mild symptoms."},
]
TIPS_MID = [
    {"icon": "activity", "title": "Take it easier outdoors", "text": "Swap a run for a walk if you feel any discomfort."},
    {"icon": "mask", "title": "Carry an N95 for busy roads", "text": "Traffic corridors are usually worse than the city average."},
    {"icon": "home", "title": "Air out in the afternoon", "text": "Open windows when the air is at its cleanest."},
    {"icon": "heart", "title": "Keep inhalers handy", "text": "People with asthma often notice symptoms first."},
]
TIPS_HIGH = [
    {"icon": "mask", "title": "Wear an N95 outside", "text": "Cloth and surgical masks don't stop the fine PM2.5 particles in smoke."},
    {"icon": "home", "title": "Keep windows shut till noon", "text": "Smog sits low in the cold morning and lifts as the day warms up."},
    {"icon": "purifier", "title": "Run a purifier if you have one", "text": "Keep it in the room where you sleep, with the door closed."},
    {"icon": "heart", "title": "Watch for symptoms", "text": "If you feel breathless or have chest pain, see a doctor."},
]


def advice(profile: str, level: int, impact: str, window_label: str | None) -> dict:
    if profile not in PROFILES:
        raise ValueError(f"Unknown profile '{profile}'. Use one of: {', '.join(PROFILES)}")
    headline = HEADLINES[profile][level]
    if window_label and level == 5:
        headline += f" If you have to go out, go between {window_label}, when the air is at its cleanest."
    elif window_label and level >= 2:
        headline += f" Step out between {window_label}, when today's air is at its cleanest."
    tips = TIPS_LOW if level <= 1 else TIPS_MID if level == 2 else TIPS_HIGH
    return {
        "profile": profile,
        "profile_label": PROFILES[profile],
        "headline": headline,
        "impact": impact,
        "tips": tips,
        "disclaimer": "General information based on CPCB health advisories, not medical advice.",
    }
