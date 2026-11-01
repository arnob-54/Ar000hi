"""Campus pickup hotspots and zone aliases (Features 6 and 14).

Data lives here so the ride orchestrator is not also a 200-line data file.
"""
HOTSPOTS = [
    # --- BRACU New Campus in Merul Badda ---
    {
        "id": "gate 1",
        "name": "Gate 1 (Main Entrance - Pragati Sarani)",
        "category": "campus_gate",
        "lat": 23.7745,
        "lng": 90.4255,
        "description": "BRACU Main Gate 1 & Front Plaza on Bir Uttam Rafiqul Islam Ave / Pragati Sarani",
        "popular": True,
    },
    {
        "id": "gate 2",
        "name": "Gate 2 (Hatirjheel / West Walkway)",
        "category": "campus_gate",
        "lat": 23.7741,
        "lng": 90.4245,
        "description": "West entrance facing Hatirjheel promenade and lake link road",
        "popular": True,
    },
    {
        "id": "gate 3",
        "name": "Gate 3 (Aftabnagar / South Gate)",
        "category": "campus_gate",
        "lat": 23.7738,
        "lng": 90.4262,
        "description": "South student drop-off & parking gate near Aftabnagar link",
        "popular": False,
    },
    # --- Surrounding Transit Hubs & Student Residential Areas ---
    {
        "id": "aftabnagar",
        "name": "Aftabnagar Main Gate (Block A)",
        "category": "transit_hub",
        "lat": 23.7730,
        "lng": 90.4280,
        "description": "Directly across Pragati Sarani — major student residential hub & EWU link",
        "popular": True,
    },
    {
        "id": "hatirjheel ghat",
        "name": "Hatirjheel Merul Badda Water Taxi Ghat",
        "category": "transit_hub",
        "lat": 23.7725,
        "lng": 90.4230,
        "description": "Water taxi terminal connecting to FDC, Niketan, Gulshan-1 & Rampura",
        "popular": True,
    },
    {
        "id": "rampura bridge",
        "name": "Rampura Bridge / DIT Road",
        "category": "transit_hub",
        "lat": 23.7650,
        "lng": 90.4240,
        "description": "Major bus junction connecting to Malibagh, Kakrail, and South Dhaka",
        "popular": True,
    },
    {
        "id": "banasree",
        "name": "Banasree (Block A / Rampura Link)",
        "category": "transit_hub",
        "lat": 23.7600,
        "lng": 90.4350,
        "description": "Key student residential area across Rampura canal",
        "popular": False,
    },
    {
        "id": "notun bazar",
        "name": "Notun Bazar / Madani Ave (100 Feet)",
        "category": "transit_hub",
        "lat": 23.7930,
        "lng": 90.4260,
        "description": "Major transit hub towards Baridhara, Kuril, and Purbachal 300ft",
        "popular": True,
    },
    {
        "id": "gulshan 1",
        "name": "Gulshan-1 Circle (via Police Plaza)",
        "category": "transit_hub",
        "lat": 23.7790,
        "lng": 90.4180,
        "description": "Connected via Gudara Ghat / Hatirjheel link road to Badda",
        "popular": True,
    },
    {
        "id": "gulshan 2",
        "name": "Gulshan-2 Circle",
        "category": "transit_hub",
        "lat": 23.7925,
        "lng": 90.4165,
        "description": "Diplomatic zone & transit corridor",
        "popular": False,
    },
    {
        "id": "mohakhali",
        "name": "Mohakhali Wireless / Old Campus Hub",
        "category": "transit_hub",
        "lat": 23.7775,
        "lng": 90.4050,
        "description": "Connecting to Old Mohakhali campus & Western Dhaka routes",
        "popular": True,
    },
    {
        "id": "kuril",
        "name": "Kuril Flyover / Bishwa Road",
        "category": "transit_hub",
        "lat": 23.8180,
        "lng": 90.4230,
        "description": "Gateway to Airport Road, Uttara, and North-Eastern universities",
        "popular": True,
    },
    {
        "id": "bashundhara",
        "name": "Bashundhara R/A Gate / Jamuna Future Park",
        "category": "transit_hub",
        "lat": 23.8150,
        "lng": 90.4250,
        "description": "Pragati Sarani northern carpool corridor",
        "popular": True,
    },
    {
        "id": "dhanmondi",
        "name": "Dhanmondi Hub (Road 27)",
        "category": "transit_hub",
        "lat": 23.7450,
        "lng": 90.3800,
        "description": "Dhanmondi student carpool hub",
        "popular": False,
    },
    {
        "id": "mirpur",
        "name": "Mirpur 10 Circle (Metro)",
        "category": "transit_hub",
        "lat": 23.8100,
        "lng": 90.3500,
        "description": "Mirpur metro rail & student transit hub",
        "popular": False,
    },
]

ZONES = {h["id"]: (h["lat"], h["lng"]) for h in HOTSPOTS}
# Common aliases and synonyms
ZONES["gate 1"] = (23.7745, 90.4255)
ZONES["gate 2"] = (23.7741, 90.4245)
ZONES["gate 3"] = (23.7738, 90.4262)
ZONES["main gate"] = (23.7745, 90.4255)
ZONES["cafe"] = (23.7744, 90.4251)
ZONES["cafeteria"] = (23.7744, 90.4251)
ZONES["food court"] = (23.7744, 90.4251)
ZONES["library"] = (23.7747, 90.4250)
ZONES["ayesha abed library"] = (23.7747, 90.4250)
ZONES["academic building"] = (23.7746, 90.4252)
ZONES["ub building"] = (23.7746, 90.4252)
ZONES["ub"] = (23.7746, 90.4252)
ZONES["auditorium"] = (23.7743, 90.4254)
ZONES["sports complex"] = (23.7749, 90.4253)
ZONES["gym"] = (23.7749, 90.4253)
ZONES["aftabnagar"] = (23.7730, 90.4280)
ZONES["hatirjheel"] = (23.7725, 90.4230)
ZONES["hatirjheel ghat"] = (23.7725, 90.4230)
ZONES["water taxi"] = (23.7725, 90.4230)
ZONES["rampura"] = (23.7650, 90.4240)
ZONES["rampura bridge"] = (23.7650, 90.4240)
ZONES["banasree"] = (23.7600, 90.4350)
ZONES["notun bazar"] = (23.7930, 90.4260)
ZONES["madani avenue"] = (23.7930, 90.4260)
ZONES["gulshan 1"] = (23.7790, 90.4180)
ZONES["gulshan 2"] = (23.7925, 90.4165)
ZONES["mohakhali"] = (23.7775, 90.4050)
ZONES["kuril"] = (23.8180, 90.4230)
ZONES["bashundhara"] = (23.8150, 90.4250)
ZONES["dhanmondi"] = (23.7450, 90.3800)
ZONES["mirpur"] = (23.8100, 90.3500)

# Logical campus zone clusters for smart matching
CAMPUS_CLUSTERS = {
    "badda_campus": {"gate 1", "gate 2", "gate 3", "main gate", "academic building", "library", "ayesha abed library", "cafeteria", "cafe", "food court", "auditorium", "sports complex", "gym", "ub building", "ub"},
    "aftabnagar_lake": {"aftabnagar", "hatirjheel", "hatirjheel ghat", "water taxi"},
    "rampura_banasree": {"rampura", "rampura bridge", "banasree"},
    "gulshan_corridor": {"gulshan 1", "gulshan 2", "police plaza"},
    "pragati_sarani_north": {"notun bazar", "madani avenue", "kuril", "bashundhara", "jamuna"},
    "mohakhali_link": {"mohakhali", "old campus"},
    "dhanmondi_hub": {"dhanmondi"},
    "mirpur_hub": {"mirpur"},
}

def get_hotspots():
    """Returns categorized campus pickup hotspots and transit points."""
    return HOTSPOTS
