"""Invented workshop data for the live demo (plans/plan.md Step 6).

Every person, address, number and invoice here is made up. Mobiles use the fake series
9000010001 onwards and emails use example.com, so nothing points at a real person. Brand
and product names are the devices a real workshop repairs, not parties to the data.
"""

BUSINESS = {
    "address_line1": "14 Demo Market, Lake Road",
    "city": "Kolkata",
    "email": "demo@example.com",
    "name": "Demo Electronics Service Centre",
    "phone": "9000010000",
    "pincode": "700029",
}

TECHNICIANS = [
    ("T01", "Rakesh Demo", "Mobiles and tablets"),
    ("T02", "Sumit Sample", "TV and audio"),
    ("T03", "Imran Example", "AC, refrigerator and washing machine"),
]

SUPPLIERS = [
    ("Eastern Spares Demo Traders", "9000019001"),
    ("City Parts Sample Agency", "9000019002"),
    ("Bengal Electro Demo Supply", "9000019003"),
    ("Metro Components Example Co", "9000019004"),
]

# product name (product.name must be UPPER_SNAKE): (problems reported, hsn code for its parts)
PRODUCTS = {
    "AIR_CONDITIONER": (
        ["Not cooling", "Water leaking from indoor unit", "Outdoor unit noisy", "Trips the MCB"],
        "84159000",
    ),
    "LED_TELEVISION": (
        ["No display, sound OK", "Lines on screen", "Not powering on", "Remote not working"],
        "85299090",
    ),
    "DIGITAL_PIANO": (
        ["Some keys silent", "Keys sticking", "Sustain pedal not working", "Crackling sound from speakers", "Not powering on"],
        "92099400",
    ),
    "ELECTRONIC_KEYBOARD": (
        ["Some keys not working", "No sound", "Display not working", "Not powering on", "Adaptor socket loose"],
        "92099400",
    ),
    "HOME_THEATRE_SYSTEM": (["No sound from subwoofer", "HDMI ARC not working", "Not powering on", "Bluetooth not pairing"], "85189000"),
    "MICROWAVE_OVEN": (["Not heating", "Turntable not rotating", "Sparking inside", "Panel keys dead"], "85169000"),
    "MIRRORLESS_CAMERA": (["Lens error", "Not focusing", "Shutter stuck", "Sensor dust spots", "Water damage"], "90069100"),
    "MOBILE_PHONE": (
        ["Screen broken", "Not charging", "Battery drains fast", "Speaker not working", "Dead after water fall"],
        "85177900",
    ),
    "REFRIGERATOR": (["Not cooling", "Ice forming in freezer only", "Compressor noise"], "84189900"),
    "SOUNDBAR": (["No sound", "Remote not working", "Optical input not working", "Not powering on"], "85189000"),
    "WASHING_MACHINE": (["Drum not spinning", "Water not draining", "Error code on display", "Door lock fault"], "84509000"),
}

# brand code, brand name, {product: [models]}
BRANDS = [
    ("SAMSUNG", "Samsung", {
        "LED_TELEVISION": ["UA43T5310", "UA55AU7700"],
        "MOBILE_PHONE": ["Galaxy A14", "Galaxy M34", "Galaxy S23"],
        "REFRIGERATOR": ["RT28T3122"],
        "WASHING_MACHINE": ["WA65A4002VS"],
    }),
    ("LG", "LG", {
        "AIR_CONDITIONER": ["RS-Q19YNZE"],
        "LED_TELEVISION": ["32LM563BPTC", "43UQ7500"],
        "MICROWAVE_OVEN": ["MC2846SL"],
        "REFRIGERATOR": ["GL-I292RPZL"],
        "WASHING_MACHINE": ["T70SKSF1Z"],
    }),
    ("SONY", "Sony", {
        "HOME_THEATRE_SYSTEM": ["HT-S40R", "HT-S700RF"],
        "LED_TELEVISION": ["KD-43X74K", "KD-55X80L"],
        "MIRRORLESS_CAMERA": ["Alpha ILCE-6400", "Alpha ILCE-7M4", "ZV-E10"],
        "SOUNDBAR": ["HT-S20R", "HT-A3000"],
    }),
    ("CASIO", "Casio", {
        "DIGITAL_PIANO": ["Privia PX-S1100", "Privia PX-870", "CDP-S110", "Celviano AP-270"],
        "ELECTRONIC_KEYBOARD": ["CT-S300", "CT-X700", "CT-S1", "CT-S500", "WK-245"],
    }),
    ("XIAOMI", "Xiaomi", {"LED_TELEVISION": ["L32M8-5AIN"], "MOBILE_PHONE": ["Redmi Note 12", "Redmi 13C"]}),
    ("VOLTAS", "Voltas", {"AIR_CONDITIONER": ["183V CZTT", "123V DZX"]}),
    ("WHIRLPOOL", "Whirlpool", {"REFRIGERATOR": ["IF INV 278"], "WASHING_MACHINE": ["Whitemagic 7.5"]}),
    ("IFB", "IFB", {"MICROWAVE_OVEN": ["25BC4"], "WASHING_MACHINE": ["Senator WXS 8kg"]}),
    ("APPLE", "Apple", {"MOBILE_PHONE": ["iPhone 12", "iPhone 13", "iPhone 14"]}),
    ("PANASONIC", "Panasonic", {"AIR_CONDITIONER": ["CS-SU18ZKYW"], "MICROWAVE_OVEN": ["NN-ST26JMFDG"]}),
]

# product: [(part name, cost price)] — each brand that makes the product gets these parts.
PARTS = {
    "AIR_CONDITIONER": [("Capacitor 45 mfd", 320), ("Indoor fan motor", 1850), ("PCB control board", 2900), ("Gas charging R32", 1500)],
    "DIGITAL_PIANO": [("Key contact rubber strip set", 650), ("Main PCB", 4200), ("Power adaptor 24V", 1100), ("Speaker 12 cm", 900), ("Pedal unit SP-3", 750)],
    "ELECTRONIC_KEYBOARD": [("Key contact rubber strip", 420), ("Main board", 2600), ("LCD display", 1250), ("Power adaptor 9.5V", 650)],
    "HOME_THEATRE_SYSTEM": [("Amplifier board", 2900), ("Subwoofer driver", 2200), ("HDMI board", 1600), ("Remote control", 450)],
    "LED_TELEVISION": [("Backlight LED strip set", 1450), ("Power supply board", 2200), ("Main board", 3400), ("IR remote sensor", 260)],
    "MICROWAVE_OVEN": [("Magnetron", 1900), ("High-voltage capacitor", 520), ("Turntable motor", 380), ("Door switch set", 240)],
    "MIRRORLESS_CAMERA": [("Shutter unit", 3800), ("Rear LCD screen", 2400), ("Kit lens assembly", 6500), ("Battery NP-FW50", 1900)],
    "MOBILE_PHONE": [("Display combo", 2600), ("Battery", 950), ("Charging port flex", 420), ("Loud speaker", 310)],
    "REFRIGERATOR": [("Thermostat", 650), ("Defrost heater", 780), ("Relay and OLP set", 340)],
    "SOUNDBAR": [("Main amplifier board", 1800), ("Optical input board", 700), ("Remote control", 380)],
    "WASHING_MACHINE": [("Drain pump", 1100), ("Drive belt", 450), ("Door lock assembly", 890), ("Control PCB", 3100)],
}

LABOUR = {
    "AIR_CONDITIONER": (600, 1200),
    "DIGITAL_PIANO": (500, 1200),
    "ELECTRONIC_KEYBOARD": (300, 800),
    "HOME_THEATRE_SYSTEM": (400, 900),
    "MIRRORLESS_CAMERA": (700, 1600),
    "SOUNDBAR": (350, 700),
    "LED_TELEVISION": (400, 900),
    "MICROWAVE_OVEN": (300, 600),
    "MOBILE_PHONE": (250, 600),
    "REFRIGERATOR": (500, 1000),
    "WASHING_MACHINE": (450, 900),
}

FIRST_NAMES = [
    "Aarav", "Ananya", "Arjun", "Debjani", "Farhan", "Gargi", "Ishaan", "Joya", "Kabir", "Kavya", "Mehul",
    "Mitali", "Nikhil", "Nandini", "Pritam", "Rhea", "Rohan", "Sanjana", "Sayan", "Shreya", "Soumya", "Tanvi",
    "Tushar", "Ujjwal", "Varsha", "Vikram", "Zoya",
]
LAST_NAMES = [
    "Banerjee", "Basu", "Chatterjee", "Das", "Dey", "Ghosh", "Gupta", "Jain", "Khan", "Mitra", "Mondal",
    "Mukherjee", "Paul", "Roy", "Saha", "Sen", "Sharma", "Singh",
]
LOCALITIES = [
    ("Ballygunge", "700019"), ("Behala", "700034"), ("Dum Dum", "700028"), ("Gariahat", "700029"),
    ("Jadavpur", "700032"), ("Kasba", "700042"), ("New Town", "700156"), ("Park Circus", "700017"),
    ("Salt Lake", "700091"), ("Tollygunge", "700033"),
]
