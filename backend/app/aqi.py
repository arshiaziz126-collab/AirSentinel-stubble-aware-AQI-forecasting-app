"""India's National AQI (NAQI) bands as published by CPCB."""

BANDS = [
    # upper bound, key, label, health impact (CPCB wording, lightly shortened)
    (50, "good", "Good", "Minimal impact."),
    (100, "satisfactory", "Satisfactory", "Minor breathing discomfort for sensitive people."),
    (200, "moderate", "Moderate", "Breathing discomfort for people with lung disease, asthma or heart disease."),
    (300, "poor", "Poor", "Breathing discomfort for most people on prolonged exposure."),
    (400, "very_poor", "Very poor", "Respiratory illness on prolonged exposure."),
    (10_000, "severe", "Severe", "Affects healthy people and seriously affects those with existing diseases."),
]

ORDER = [b[1] for b in BANDS]


def category(aqi: float) -> dict:
    for upper, key, label, impact in BANDS:
        if aqi <= upper:
            return {"key": key, "label": label, "impact": impact, "level": ORDER.index(key)}
    raise ValueError(aqi)


def compass(deg: float) -> str:
    names = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"]
    return names[int(((deg % 360) + 22.5) // 45) % 8]
