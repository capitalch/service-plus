# Service Plus Demo Data — Insert SQL
**Database:** `service_plus_demo` | **Schema:** `demo1`

> Prerequisites assumed already seeded: `state`, `customer_type`, `company_info` (id=1).
> `spare_part_master` is not in `tran.md` but is required as FK by line tables — it is included here as a prerequisite section.

---

## 0. Prerequisites — spare_part_master (200 records)

```sql
INSERT INTO demo1.spare_part_master
    (id, brand_id, part_code, part_name, part_description, category, model, uom, cost_price, mrp, hsn_code, gst_rate, is_active)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) % 10) + 1 AS brand_id,
    'SP' || LPAD(s::text, 4, '0') AS part_code,
    (ARRAY[
        'Display Screen', 'Battery Pack', 'Charging Port', 'Motherboard', 'Camera Module',
        'Speaker Unit', 'Microphone', 'Power Button', 'Volume Button', 'Back Cover',
        'Front Glass', 'Earphone Jack', 'SIM Card Tray', 'Vibrator Motor', 'Proximity Sensor',
        'Fingerprint Sensor', 'USB-C Port', 'Lightning Connector', 'Charging IC', 'Power IC',
        'RAM Module', 'SSD Storage', 'Keyboard Assembly', 'Trackpad', 'Fan Assembly',
        'Heat Sink', 'LCD Backlight', 'Inverter Board', 'HDMI Port', 'Antenna Cable',
        'Wifi Module', 'Bluetooth Module', 'GPS Module', 'NFC Chip', 'IR Sensor',
        'Ambient Light Sensor', 'Gyroscope', 'Accelerometer', 'Barometer', 'Compass',
        'Watch Crown', 'Watch Band Connector', 'Watch Glass', 'Watch Battery', 'Watch Strap',
        'TV Panel', 'TV Main Board', 'TV Power Board', 'TV T-Con Board', 'TV Remote Sensor',
        'Radio Tuner Module', 'Radio Speaker', 'Radio Antenna', 'Radio Volume Knob', 'Radio LCD',
        'Amplifier IC', 'Woofer Unit', 'Tweeter Unit', 'Crossover Board', 'Cabinet Screw Set',
        'Camera Lens', 'Camera Sensor', 'Camera Shutter', 'Camera Flash Module', 'Camera Mount',
        'Guitar String Set', 'Guitar Tuning Peg', 'Guitar Bridge', 'Guitar Pickup', 'Guitar Nut',
        'Piano Key', 'Piano Hammer', 'Piano Damper', 'Piano Pedal', 'Piano String',
        'Drum Head', 'Drum Rim', 'Drum Lug', 'Drum Tension Rod', 'Drum Cymbal Stand',
        'Synthesizer Key', 'Synth Encoder', 'Synth Display', 'Synth Power Supply', 'Synth Filter Chip',
        'Tablet Touch Screen', 'Tablet Battery', 'Tablet Charging Port', 'Tablet Camera', 'Tablet Speaker',
        'Headphone Driver', 'Headphone Cable', 'Headphone Cushion', 'Headphone Headband', 'Headphone Jack',
        'Smart Speaker Mic Array', 'Smart Speaker Woofer', 'Smart Speaker LED Ring', 'Smart Speaker Board', 'Smart Speaker Power',
        'Gaming Controller Trigger', 'Gaming Controller Joystick', 'Gaming Controller Battery', 'Gaming Controller PCB', 'Gaming Controller Rumble'
    ])[((s - 1) % 100) + 1] || ' - ' || 
    (ARRAY['Type A','Type B','Type C','Type D','Type E','Type F','Type G','Type H','Type I','Type J'])[((s - 1) % 10) + 1] AS part_name,
    'Genuine replacement part for electronic devices' AS part_description,
    (ARRAY[
        'Mobile Screen','Mobile Battery','Mobile Port','Mobile Motherboard','Mobile Camera',
        'Mobile Speaker','Mobile Sensor','Mobile Button','Mobile Cover','Mobile Glass',
        'Laptop Component','Laptop Memory','Laptop Storage','Laptop Keyboard','Laptop Cooling',
        'Watch Part','TV Component','TV Board','Radio Part','Audio Component',
        'Camera Part','Instrument String','Instrument Key','Instrument Body','Instrument Sensor',
        'Synthesizer Part','Tablet Part','Headphone Part','Speaker Part','Controller Part'
    ])[((s - 1) % 30) + 1] AS category,
    'Model-' || ((s - 1) % 50 + 1)::text AS model,
    'NOS' AS uom,
    ROUND((50 + (s * 137 % 4950))::numeric, 2) AS cost_price,
    ROUND((100 + (s * 173 % 9900))::numeric, 2) AS mrp,
    (ARRAY['84733010','84735010','84798990','85177010','85258090','85269190','90181900','84733090','85044090','85423910'])[((s - 1) % 10) + 1] AS hsn_code,
    (ARRAY[5.00, 12.00, 18.00, 28.00])[((s - 1) % 4) + 1] AS gst_rate,
    true
FROM generate_series(1, 200) s
ON CONFLICT (id) DO NOTHING;
```

---

## 1. branch (10 records)

```sql
INSERT INTO demo1.branch
    (id, code, name, phone, email, address_line1, address_line2, state_id, city, pincode, gstin, is_active, is_head_office)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    'BR' || LPAD(s::text, 3, '0'),
    (ARRAY[
        'Mumbai Head Office', 'Delhi Branch', 'Bangalore Branch', 'Chennai Branch',
        'Hyderabad Branch', 'Kolkata Branch', 'Ahmedabad Branch', 'Pune Branch',
        'Jaipur Branch', 'Kochi Branch'
    ])[s],
    '9' || LPAD((s * 98765432 % 1000000000)::text, 9, '0'),
    'branch' || s || '@servicecenter.in',
    (ARRAY[
        '12, MG Road', '45, Connaught Place', '78, Brigade Road', '23, Anna Salai',
        '56, Banjara Hills', '89, Park Street', '34, CG Road', '67, FC Road',
        '90, MI Road', '11, Lakeshore Drive'
    ])[s],
    (ARRAY[
        'Fort', 'Central Delhi', 'Shivajinagar', 'T. Nagar',
        'Madhapur', 'Esplanade', 'Navrangpura', 'Shivajinagar',
        'Malviya Nagar', 'Ernakulam'
    ])[s],
    (ARRAY[27, 7, 29, 33, 36, 19, 24, 27, 8, 32])[s],
    (ARRAY['Mumbai', 'Delhi', 'Bangalore', 'Chennai', 'Hyderabad', 'Kolkata', 'Ahmedabad', 'Pune', 'Jaipur', 'Kochi'])[s],
    (ARRAY['400001', '110001', '560001', '600017', '500081', '700001', '380009', '411005', '302017', '682016'])[s],
    (ARRAY[
        '27AABCS1429B1ZP', '07AABCS1429B1ZP', '29AABCS1429B1ZP', '33AABCS1429B1ZP',
        '36AABCS1429B1ZP', '19AABCS1429B1ZP', '24AABCS1429B1ZP', '27AABCS1430B1ZP',
        '08AABCS1429B1ZP', '32AABCS1429B1ZP'
    ])[s],
    true,
    s = 1
FROM generate_series(1, 10) s
ON CONFLICT (id) DO NOTHING;
```

---

## 2. brand (10 records)

```sql
INSERT INTO demo1.brand (id, code, name, is_active)
OVERRIDING SYSTEM VALUE
VALUES
    (1,  'SAMSUNG',   'Samsung',        true),
    (2,  'APPLE',     'Apple',          true),
    (3,  'SONY',      'Sony',           true),
    (4,  'LG',        'LG Electronics', true),
    (5,  'PHILIPS',   'Philips',        true),
    (6,  'PANASONIC', 'Panasonic',      true),
    (7,  'NOKIA',     'Nokia',          true),
    (8,  'XIAOMI',    'Xiaomi',         true),
    (9,  'ONEPLUS',   'OnePlus',        true),
    (10, 'YAMAHA',    'Yamaha',         true)
ON CONFLICT (id) DO NOTHING;
```

---

## 3. customer_contact (100 records)

```sql
INSERT INTO demo1.customer_contact
    (id, customer_type_id, full_name, gstin, mobile, alternate_mobile, email,
     address_line1, address_line2, landmark, state_id, city, postal_code, remarks, is_active)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) % 5) + 1 AS customer_type_id,
    (ARRAY[
        'Rajesh Kumar','Priya Sharma','Amit Singh','Sunita Patel','Vikram Nair',
        'Anita Desai','Suresh Reddy','Kavitha Rao','Manoj Gupta','Deepa Menon',
        'Arun Joshi','Meena Iyer','Rajan Pillai','Lakshmi Devi','Sanjay Shah',
        'Geeta Verma','Rakesh Tiwari','Usha Nambiar','Harish Chandra','Malathi Krishnan',
        'Vinod Kumar','Saroja Bai','Prasad Naidu','Revathi Srinivasan','Dinesh Choudhary',
        'Kamala Devi','Ashok Patil','Nalini Rao','Gopal Krishna','Savita Jain',
        'Mohan Lal','Radha Krishnamurthy','Ganesh Prabhu','Uma Shankar','Arjun Mehta',
        'Sneha Kulkarni','Ravi Shankar','Padma Subramanian','Kiran Bedi','Sushma Swaraj',
        'Tech Solutions Pvt Ltd','Digital World Enterprises','Smart Gadgets Corp','Future Tech Ltd','Nexus Electronics',
        'TechFix Services','QuickRepair Solutions','GadgetCare India','RepairMaster Co','ElectroFix Hub',
        'Shanthi Natarajan','Balaji Venkataraman','Durga Prasad','Saraswati Devi','Chandrasekhar Rao',
        'Jyothi Lakshmi','Narayana Swamy','Mangala Devi','Raghunandan Sharma','Indu Bala',
        'City Electronics Dealers','Metro Tech Traders','Urban Gadget Mart','Suburban Tech Store','Capital Electronics',
        'Ramesh Babu','Vijaya Lakshmi','Sreenivas Murthy','Hemavathi Devi','Krishnaswamy Iyer',
        'National Repair Services','State Tech Solutions','Premier Electronics','Alpha Gadgets','Beta Tech',
        'Suresh Nair','Leela Krishnan','Madhavan Pillai','Thankamma Amma','Gopinath Menon',
        'Sunrise Electronics','Moonlight Tech','Starlight Repairs','Galaxy Gadgets','Nebula Solutions',
        'Padmanabhan Iyer','Bhagavathi Devi','Sivakumar Raja','Muthumari Amma','Chandrakala',
        'Phoenix Electronics','Eagle Tech Services','Falcon Repairs','Hawk Gadgets','Sparrow Tech',
        'Venkateswaran Rao','Satyanarayana Devi','Gopala Krishna','Narayanamma','Tirupathi Rao'
    ])[s] AS full_name,
    CASE WHEN ((s - 1) % 5) + 1 IN (2, 3, 4) THEN
        (ARRAY['27','07','29','33','36','19','24','08','32','09'])[((s-1)%10)+1] ||
        'AABC' || LPAD(s::text, 5, '0') || 'R1ZP'
    END AS gstin,
    '9' || LPAD((s::bigint * 87654321 % 1000000000)::text, 9, '0') AS mobile,
    CASE WHEN s % 3 = 0 THEN '9' || LPAD((s::bigint * 76543210 % 1000000000)::text, 9, '0') END AS alternate_mobile,
    LOWER(REPLACE((ARRAY[
        'Rajesh Kumar','Priya Sharma','Amit Singh','Sunita Patel','Vikram Nair',
        'Anita Desai','Suresh Reddy','Kavitha Rao','Manoj Gupta','Deepa Menon',
        'Arun Joshi','Meena Iyer','Rajan Pillai','Lakshmi Devi','Sanjay Shah',
        'Geeta Verma','Rakesh Tiwari','Usha Nambiar','Harish Chandra','Malathi Krishnan',
        'Vinod Kumar','Saroja Bai','Prasad Naidu','Revathi Srinivasan','Dinesh Choudhary',
        'Kamala Devi','Ashok Patil','Nalini Rao','Gopal Krishna','Savita Jain',
        'Mohan Lal','Radha Krishnamurthy','Ganesh Prabhu','Uma Shankar','Arjun Mehta',
        'Sneha Kulkarni','Ravi Shankar','Padma Subramanian','Kiran Bedi','Sushma Swaraj',
        'techsolutions','digitalworld','smartgadgets','futuretech','nexuselectronics',
        'techfix','quickrepair','gadgetcare','repairmaster','electrofix',
        'Shanthi Natarajan','Balaji Venkataraman','Durga Prasad','Saraswati Devi','Chandrasekhar Rao',
        'Jyothi Lakshmi','Narayana Swamy','Mangala Devi','Raghunandan Sharma','Indu Bala',
        'cityelectronics','metrotech','urbangadget','suburbantech','capitalelectronics',
        'Ramesh Babu','Vijaya Lakshmi','Sreenivas Murthy','Hemavathi Devi','Krishnaswamy Iyer',
        'nationalrepair','statetech','premierelectronics','alphagadgets','betatech',
        'Suresh Nair','Leela Krishnan','Madhavan Pillai','Thankamma Amma','Gopinath Menon',
        'sunriseelectronics','moonlighttech','starlightrepairs','galaxygadgets','nebulasolutions',
        'Padmanabhan Iyer','Bhagavathi Devi','Sivakumar Raja','Muthumari Amma','Chandrakala',
        'phoenixelectronics','eagletech','falconrepairs','hawkgadgets','sparrowtech',
        'Venkateswaran Rao','Satyanarayana Devi','Gopala Krishna','Narayanamma','Tirupathi Rao'
    ])[s], ' ', '')) || s::text || '@email.com' AS email,
    s || ', Service Road' AS address_line1,
    'Block ' || ((s - 1) % 10 + 1)::text AS address_line2,
    (ARRAY['Near Bus Stand','Opp Railway Station','Next to Mall','Behind Hospital','Near School',
           'Opp Market','Near Temple','Behind Park','Next to Bank','Near Airport'])[((s-1)%10)+1] AS landmark,
    (ARRAY[27,7,29,33,36,19,24,27,8,32,27,7,29,33,36,19,24,27,8,32,
           27,7,29,33,36,19,24,27,8,32,27,7,29,33,36,19,24,27,8,32,
           27,7,29,33,36,19,24,27,8,32,27,7,29,33,36,19,24,27,8,32,
           27,7,29,33,36,19,24,27,8,32,27,7,29,33,36,19,24,27,8,32,
           27,7,29,33,36,19,24,27,8,32,27,7,29,33,36,19,24,27,8,32])[s] AS state_id,
    (ARRAY['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi'])[s] AS city,
    (ARRAY['400001','110001','560001','600017','500081','700001','380009','411005','302017','682016',
           '400002','110002','560002','600018','500082','700002','380010','411006','302018','682017',
           '400003','110003','560003','600019','500083','700003','380011','411007','302019','682018',
           '400004','110004','560004','600020','500084','700004','380012','411008','302020','682019',
           '400005','110005','560005','600021','500085','700005','380013','411009','302021','682020',
           '400006','110006','560006','600022','500086','700006','380014','411010','302022','682021',
           '400007','110007','560007','600023','500087','700007','380015','411011','302023','682022',
           '400008','110008','560008','600024','500088','700008','380016','411012','302024','682023',
           '400009','110009','560009','600025','500089','700009','380017','411013','302025','682024',
           '400010','110010','560010','600026','500090','700010','380018','411014','302026','682025'])[s] AS postal_code,
    CASE WHEN s % 10 = 0 THEN 'VIP customer, priority service' ELSE NULL END AS remarks,
    s % 20 <> 0 AS is_active
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 4. supplier (100 records)

```sql
INSERT INTO demo1.supplier
    (id, name, gstin, pan, phone, email, address_line1, address_line2, city, state_id, pincode, is_active, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    (ARRAY[
        'Global Electronics Traders','National Spare Parts Hub','Prime Tech Distributors','Apex Electronics Wholesale',
        'Star Parts Supply Co','Metro Gadget Suppliers','Pioneer Electronics Corp','Eagle Tech Wholesale',
        'Sunrise Parts Depot','Summit Electronics Ltd','Alpha Spare Parts India','Beta Tech Distributors',
        'Gamma Electronics Co','Delta Parts Traders','Epsilon Tech Supply','Zeta Electronics Mart',
        'Eta Spare Parts Hub','Theta Tech Distributors','Iota Electronics Ltd','Kappa Parts Wholesale',
        'Samsung Service Parts India','Apple Authorized Spare Parts','Sony Genuine Parts Depot','LG Spare Parts Center',
        'Philips Authorized Distributors','Panasonic Parts India','Nokia Spare Parts Hub','Xiaomi Authorized Parts',
        'OnePlus Official Spare Parts','Yamaha Musical Parts India','TechTrade Wholesale Hub','GadgetSupply Network',
        'SpareBase India Pvt Ltd','PartsMart Electronics','ComponentWorld India','CircuitBase Suppliers',
        'PowerParts Wholesale','DisplayTrade India','BatteryBase Suppliers','ChargeTrade Electronics',
        'Horizon Electronics Traders','Zenith Spare Parts Co','Meridian Tech Distributors','Pinnacle Parts Hub',
        'Vertex Electronics Depot','Quantum Spare Parts India','Fusion Tech Wholesale','Nexus Parts Network',
        'Orbit Electronics Traders','Nova Spare Parts Co','Comet Tech Distributors','Meteor Parts Hub',
        'Astral Electronics Depot','Galaxy Tech Wholesale','Cosmos Spare Parts India','Stellar Parts Network',
        'Solar Electronics Traders','Lunar Spare Parts Co','Venus Tech Distributors','Mars Parts Hub',
        'Jupiter Electronics Depot','Saturn Tech Wholesale','Neptune Spare Parts India','Pluto Parts Network',
        'North Electronics Traders','South Spare Parts Co','East Tech Distributors','West Parts Hub',
        'Central Electronics Depot','Regional Tech Wholesale','National Parts Network','Pan India Electronics',
        'United Spare Parts','Allied Tech Distributors','Federal Electronics Depot','Republic Parts Hub',
        'Bharat Electronics Wholesale','Hindustan Parts Network','Indian Tech Traders','Desi Spare Parts Co',
        'Modern Electronics Dist','Classic Parts Hub','Heritage Tech Wholesale','Contemporary Electronics',
        'Future Spare Parts India','Next Gen Parts Depot','Advanced Tech Wholesale','Digital Parts Network',
        'Smart Electronics Traders','Intelligent Parts Hub','Automated Tech Distributors','Robotic Parts Depot',
        'AI Spare Parts India','Cloud Tech Wholesale','Data Parts Network','Cyber Electronics Traders',
        'Virtual Spare Parts Co','Digital Tech Distributors','Online Parts Hub','E-commerce Electronics Depot',
        'Web Tech Wholesale','Internet Parts Network','Mobile Electronics Traders','Wireless Spare Parts Co'
    ])[s] AS name,
    (ARRAY['27','07','29','33','36','19','24','27','08','32'])[((s-1)%10)+1] ||
        'AABCS' || LPAD(s::text, 4, '0') || 'R1ZP' AS gstin,
    'AABCS' || LPAD(s::text, 4, '0') || 'P' AS pan,
    '9' || LPAD((s::bigint * 54321987 % 1000000000)::text, 9, '0') AS phone,
    'supplier' || s || '@parts.in' AS email,
    s || ', Industrial Estate' AS address_line1,
    'Sector ' || ((s - 1) % 20 + 1)::text AS address_line2,
    (ARRAY['Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Surat','Nagpur','Lucknow','Kanpur','Patna','Bhopal','Indore','Vadodara','Coimbatore','Vizag',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Surat','Nagpur','Lucknow','Kanpur','Patna','Bhopal','Indore','Vadodara','Coimbatore','Vizag',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Surat','Nagpur','Lucknow','Kanpur','Patna','Bhopal','Indore','Vadodara','Coimbatore','Vizag',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Surat','Nagpur','Lucknow','Kanpur','Patna','Bhopal','Indore','Vadodara','Coimbatore','Vizag',
           'Mumbai','Delhi','Bangalore','Chennai','Hyderabad','Kolkata','Ahmedabad','Pune','Jaipur','Kochi',
           'Surat','Nagpur','Lucknow','Kanpur','Patna','Bhopal','Indore','Vadodara','Coimbatore','Vizag'])[s] AS city,
    (ARRAY[27,7,29,33,36,19,24,27,8,32,24,27,9,9,10,23,23,24,33,28,
           27,7,29,33,36,19,24,27,8,32,24,27,9,9,10,23,23,24,33,28,
           27,7,29,33,36,19,24,27,8,32,24,27,9,9,10,23,23,24,33,28,
           27,7,29,33,36,19,24,27,8,32,24,27,9,9,10,23,23,24,33,28,
           27,7,29,33,36,19,24,27,8,32,24,27,9,9,10,23,23,24,33,28])[s] AS state_id,
    (ARRAY['400093','110095','560058','600096','500072','700155','395010','411019','302013','682028',
           '395003','440018','226001','208001','800001','462001','452001','390001','641001','530001',
           '400093','110095','560058','600096','500072','700155','395010','411019','302013','682028',
           '395003','440018','226001','208001','800001','462001','452001','390001','641001','530001',
           '400093','110095','560058','600096','500072','700155','395010','411019','302013','682028',
           '395003','440018','226001','208001','800001','462001','452001','390001','641001','530001',
           '400093','110095','560058','600096','500072','700155','395010','411019','302013','682028',
           '395003','440018','226001','208001','800001','462001','452001','390001','641001','530001',
           '400093','110095','560058','600096','500072','700155','395010','411019','302013','682028',
           '395003','440018','226001','208001','800001','462001','452001','390001','641001','530001'])[s] AS pincode,
    s % 15 <> 0 AS is_active,
    CASE WHEN s % 20 = 0 THEN 'Preferred vendor — bulk discount applicable' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 5. technician (15 records)

```sql
INSERT INTO demo1.technician
    (id, branch_id, code, name, phone, email, specialization, is_active)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) % 10) + 1 AS branch_id,
    'TECH' || LPAD(s::text, 3, '0') AS code,
    (ARRAY[
        'Ramesh Technician','Suresh Engineer','Mahesh Mechanic','Dinesh Specialist','Ganesh Expert',
        'Rajesh Technician','Vijay Engineer','Arun Mechanic','Kiran Specialist','Ravi Expert',
        'Sanjay Technician','Vijayakumar Engineer','Balakrishnan Mechanic','Murugan Specialist','Selvam Expert'
    ])[s] AS name,
    '9' || LPAD((s * 11223344 % 1000000000)::text, 9, '0') AS phone,
    'tech' || s || '@servicecenter.in' AS email,
    (ARRAY[
        'Mobile Phone Repairs','Laptop & Computer','Tablet Repairs','Smart Watch Service','Television Repairs',
        'Audio Systems','Camera Repairs','Musical Instruments','Mobile Phone Repairs','Laptop & Computer',
        'Tablet Repairs','Television Repairs','Mobile Phone Repairs','Audio Systems','General Electronics'
    ])[s] AS specialization,
    s <> 13 AS is_active
FROM generate_series(1, 15) s
ON CONFLICT (id) DO NOTHING;
```

---

## 6. product (100 records)

```sql
INSERT INTO demo1.product (id, name, is_active)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    (ARRAY[
        'MOBILE_PHONE','LAPTOP','TABLET','SMART_WATCH','LED_TELEVISION',
        'OLED_TELEVISION','QLED_TELEVISION','PORTABLE_RADIO','HOME_THEATRE_SYSTEM','SOUNDBAR',
        'BLUETOOTH_SPEAKER','WIRELESS_EARPHONES','WIRED_EARPHONES','OVER_EAR_HEADPHONES','SMART_SPEAKER',
        'DIGITAL_CAMERA','DSLR_CAMERA','MIRRORLESS_CAMERA','ACTION_CAMERA','CAMCORDER',
        'ELECTRIC_GUITAR','ACOUSTIC_GUITAR','BASS_GUITAR','CLASSICAL_GUITAR','UKULELE',
        'UPRIGHT_PIANO','GRAND_PIANO','DIGITAL_PIANO','ELECTRONIC_KEYBOARD','MIDI_CONTROLLER',
        'DRUM_KIT','ELECTRONIC_DRUM_PAD','SNARE_DRUM','BASS_DRUM','HAND_DRUM',
        'VIOLIN','VIOLA','CELLO','DOUBLE_BASS','ELECTRIC_VIOLIN',
        'MUSIC_SYNTHESIZER','ANALOG_SYNTHESIZER','DIGITAL_SYNTHESIZER','MODULAR_SYNTHESIZER','GROOVE_BOX',
        'GAMING_CONSOLE','HANDHELD_GAMING_DEVICE','GAMING_CONTROLLER','VR_HEADSET','STREAMING_STICK',
        'SMART_HOME_HUB','SMART_DOORBELL','SMART_LOCK','SMART_THERMOSTAT','SMART_BULB',
        'WIRELESS_ROUTER','MODEM_ROUTER_COMBO','NETWORK_SWITCH','WIFI_EXTENDER','MESH_NETWORK_SYSTEM',
        'DESKTOP_COMPUTER','ALL_IN_ONE_PC','MINI_PC','GAMING_PC','WORKSTATION',
        'EXTERNAL_HARD_DRIVE','SSD_DRIVE','USB_FLASH_DRIVE','MEMORY_CARD_READER','CARD_READER',
        'POWER_BANK','UPS_SYSTEM','VOLTAGE_STABILIZER','SURGE_PROTECTOR','SMART_PLUG',
        'PRINTER','SCANNER','ALL_IN_ONE_PRINTER','THREE_D_PRINTER','LABEL_PRINTER',
        'PROJECTOR','INTERACTIVE_DISPLAY','DIGITAL_FRAME','EREADER','BARCODE_SCANNER',
        'DRONE','RC_HELICOPTER','REMOTE_CONTROL_CAR','ROBOTIC_KIT','SMART_GLASSES',
        'FITNESS_TRACKER','GPS_DEVICE','CAR_AUDIO_SYSTEM','DASHBOARD_CAMERA','REVERSE_CAMERA',
        'MICROPHONE','CONDENSER_MICROPHONE','DYNAMIC_MICROPHONE','USB_MICROPHONE','WIRELESS_MICROPHONE',
        'AUDIO_MIXER','DJ_CONTROLLER','AUDIO_INTERFACE','STUDIO_MONITOR','EQUALIZER'
    ])[s] AS name,
    s % 25 <> 0 AS is_active
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 7. product_brand_model (1000 records)

```sql
INSERT INTO demo1.product_brand_model
    (id, product_id, brand_id, model_name, launch_year, remarks, is_active)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) % 100) + 1 AS product_id,
    ((s - 1) % 10) + 1 AS brand_id,
    (ARRAY[
        'Galaxy S24 Ultra','iPhone 15 Pro Max','Xperia 1 V','V60 ThinQ','OLED Phone 3',
        'G85 Pro','G Series 2024','14 Ultra','Nord 4','YZF-R15'
    ])[((s-1)%10)+1] || ' ' ||
    (ARRAY['(2024 Edition)','(Pro)','(Plus)','(Lite)','(Standard)','(Max)','(Mini)','(Classic)','(Elite)','(Special)'])[((s-1)%10)+1] || ' v' || ((s-1)/100 + 1)::text AS model_name,
    2020 + ((s - 1) % 5) AS launch_year,
    CASE WHEN s % 50 = 0 THEN 'Discontinued model, limited spare availability' ELSE NULL END AS remarks,
    s % 50 <> 0 AS is_active
FROM generate_series(1, 1000) s;
```

---

## 8. purchase_invoice (100 records)

```sql
INSERT INTO demo1.purchase_invoice
    (id, supplier_id, invoice_no, invoice_date, aggregate_amount, cgst_amount, sgst_amount,
     igst_amount, total_tax, total_amount, branch_id, brand_id, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) % 100) + 1 AS supplier_id,
    'PINV-2024-' || LPAD(s::text, 5, '0') AS invoice_no,
    DATE '2024-04-01' + ((s - 1) * 3 || ' days')::interval AS invoice_date,
    ROUND((5000 + (s * 1234 % 95000))::numeric, 2) AS aggregate_amount,
    CASE WHEN ((s-1)%10)+1 IN (1,2,3,4,5,6,7) THEN
        ROUND((5000 + (s * 1234 % 95000))::numeric * 0.09, 2) ELSE 0 END AS cgst_amount,
    CASE WHEN ((s-1)%10)+1 IN (1,2,3,4,5,6,7) THEN
        ROUND((5000 + (s * 1234 % 95000))::numeric * 0.09, 2) ELSE 0 END AS sgst_amount,
    CASE WHEN ((s-1)%10)+1 IN (8,9,10) THEN
        ROUND((5000 + (s * 1234 % 95000))::numeric * 0.18, 2) ELSE 0 END AS igst_amount,
    ROUND((5000 + (s * 1234 % 95000))::numeric * 0.18, 2) AS total_tax,
    ROUND((5000 + (s * 1234 % 95000))::numeric * 1.18, 2) AS total_amount,
    ((s - 1) % 10) + 1 AS branch_id,
    ((s - 1) % 10) + 1 AS brand_id,
    CASE WHEN s % 10 = 0 THEN 'Urgent stock replenishment order' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 9. purchase_invoice_line (1000 records)

```sql
INSERT INTO demo1.purchase_invoice_line
    (id, purchase_invoice_id, part_id, hsn_code, quantity, unit_price, aggregate_amount,
     gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 10) + 1 AS purchase_invoice_id,
    ((s - 1) % 200) + 1 AS part_id,
    (ARRAY['84733010','84735010','84798990','85177010','85258090','85269190','90181900','84733090','85044090','85423910'])[((s-1)%10)+1] AS hsn_code,
    ROUND((1 + (s % 49))::numeric, 2) AS quantity,
    ROUND((100 + (s * 137 % 4900))::numeric, 2) AS unit_price,
    ROUND((1 + (s % 49))::numeric * ROUND((100 + (s * 137 % 4900))::numeric, 2), 2) AS aggregate_amount,
    CASE WHEN s % 10 < 7 THEN 18.00 ELSE 18.00 END AS gst_rate,
    CASE WHEN s % 10 < 7 THEN
        ROUND((1 + (s % 49))::numeric * ROUND((100 + (s * 137 % 4900))::numeric, 2) * 0.09, 2) ELSE 0 END AS cgst_amount,
    CASE WHEN s % 10 < 7 THEN
        ROUND((1 + (s % 49))::numeric * ROUND((100 + (s * 137 % 4900))::numeric, 2) * 0.09, 2) ELSE 0 END AS sgst_amount,
    CASE WHEN s % 10 >= 7 THEN
        ROUND((1 + (s % 49))::numeric * ROUND((100 + (s * 137 % 4900))::numeric, 2) * 0.18, 2) ELSE 0 END AS igst_amount,
    ROUND((1 + (s % 49))::numeric * ROUND((100 + (s * 137 % 4900))::numeric, 2) * 1.18, 2) AS total_amount
FROM generate_series(1, 1000) s
ON CONFLICT (id) DO NOTHING;
```

---

## 10. sales_invoice (100 records)

```sql
INSERT INTO demo1.sales_invoice
    (id, invoice_no, invoice_date, company_id, customer_contact_id, customer_name,
     customer_gstin, customer_state_code, aggregate_amount, cgst_amount, sgst_amount,
     igst_amount, total_tax, total_amount, branch_id, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    'SINV-2024-' || LPAD(s::text, 5, '0') AS invoice_no,
    DATE '2024-04-01' + ((s - 1) * 3 || ' days')::interval AS invoice_date,
    1 AS company_id,
    CASE WHEN s % 5 = 0 THEN NULL ELSE ((s - 1) % 100) + 1 END AS customer_contact_id,
    (ARRAY[
        'Rajesh Kumar','Priya Sharma','Amit Singh','Sunita Patel','Walk-in Customer',
        'Tech Solutions Pvt Ltd','Digital World Enterprises','Smart Gadgets Corp','Future Tech Ltd','Walk-in Customer',
        'Vikram Nair','Anita Desai','Suresh Reddy','Kavitha Rao','Walk-in Customer',
        'Shanthi Natarajan','Balaji Venkataraman','Durga Prasad','Saraswati Devi','Walk-in Customer'
    ])[((s-1)%20)+1] AS customer_name,
    CASE WHEN s % 7 = 0 THEN
        (ARRAY['27','07','29','33','36','19','24','27','08','32'])[((s-1)%10)+1] ||
        'AABCS' || LPAD(s::text, 4, '0') || 'R1ZP'
    END AS customer_gstin,
    (ARRAY['27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32',
           '27','07','29','33','36','19','24','27','08','32'])[s]::character(2) AS customer_state_code,
    ROUND((500 + (s * 1597 % 49500))::numeric, 2) AS aggregate_amount,
    CASE WHEN s % 10 < 7 THEN ROUND((500 + (s * 1597 % 49500))::numeric * 0.09, 2) ELSE 0 END AS cgst_amount,
    CASE WHEN s % 10 < 7 THEN ROUND((500 + (s * 1597 % 49500))::numeric * 0.09, 2) ELSE 0 END AS sgst_amount,
    CASE WHEN s % 10 >= 7 THEN ROUND((500 + (s * 1597 % 49500))::numeric * 0.18, 2) ELSE 0 END AS igst_amount,
    ROUND((500 + (s * 1597 % 49500))::numeric * 0.18, 2) AS total_tax,
    ROUND((500 + (s * 1597 % 49500))::numeric * 1.18, 2) AS total_amount,
    ((s - 1) % 10) + 1 AS branch_id,
    CASE WHEN s % 15 = 0 THEN 'Corporate bulk sale — special pricing applied' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 11. sales_invoice_line (1000 records)

```sql
INSERT INTO demo1.sales_invoice_line
    (id, sales_invoice_id, part_id, item_description, hsn_code, quantity, unit_price,
     gst_rate, aggregate_amount, cgst_amount, sgst_amount, igst_amount, total_amount)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 10) + 1 AS sales_invoice_id,
    ((s - 1) % 200) + 1 AS part_id,
    (ARRAY[
        'Display Screen Replacement','Battery Replacement','Charging Port Repair','Motherboard Replacement','Camera Module',
        'Speaker Replacement','Microphone Repair','Button Replacement','Back Cover','Front Glass Replacement',
        'Laptop Keyboard','RAM Upgrade','SSD Upgrade','Cooling Fan','LCD Backlight',
        'Watch Glass Replacement','TV Panel Replacement','TV Main Board','Radio Repair','Audio Speaker',
        'Camera Lens','Guitar String Set','Piano Key Replacement','Drum Head','Synthesizer Repair',
        'Gaming Controller','Smart Home Setup','Router Configuration','PC Repair','Printer Maintenance'
    ])[((s-1)%30)+1] AS item_description,
    (ARRAY['84733010','84735010','84798990','85177010','85258090','85269190','90181900','84733090','85044090','85423910'])[((s-1)%10)+1] AS hsn_code,
    ROUND((1 + (s % 9))::numeric, 2) AS quantity,
    ROUND((200 + (s * 163 % 9800))::numeric, 2) AS unit_price,
    (ARRAY[5.00, 12.00, 18.00, 28.00])[((s-1)%4)+1] AS gst_rate,
    ROUND((1 + (s % 9))::numeric * ROUND((200 + (s * 163 % 9800))::numeric, 2), 2) AS aggregate_amount,
    CASE WHEN s % 10 < 7 THEN
        ROUND((1 + (s % 9))::numeric * ROUND((200 + (s * 163 % 9800))::numeric, 2) *
              (ARRAY[5.00, 12.00, 18.00, 28.00])[((s-1)%4)+1] / 200, 2) ELSE 0 END AS cgst_amount,
    CASE WHEN s % 10 < 7 THEN
        ROUND((1 + (s % 9))::numeric * ROUND((200 + (s * 163 % 9800))::numeric, 2) *
              (ARRAY[5.00, 12.00, 18.00, 28.00])[((s-1)%4)+1] / 200, 2) ELSE 0 END AS sgst_amount,
    CASE WHEN s % 10 >= 7 THEN
        ROUND((1 + (s % 9))::numeric * ROUND((200 + (s * 163 % 9800))::numeric, 2) *
              (ARRAY[5.00, 12.00, 18.00, 28.00])[((s-1)%4)+1] / 100, 2) ELSE 0 END AS igst_amount,
    ROUND((1 + (s % 9))::numeric * ROUND((200 + (s * 163 % 9800))::numeric, 2) *
          (1 + (ARRAY[5.00, 12.00, 18.00, 28.00])[((s-1)%4)+1] / 100), 2) AS total_amount
FROM generate_series(1, 1000) s
ON CONFLICT (id) DO NOTHING;
```

---

## 12. stock_adjustment (100 records)

```sql
INSERT INTO demo1.stock_adjustment
    (id, adjustment_date, adjustment_reason, ref_no, branch_id, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    DATE '2024-04-01' + ((s - 1) * 3 || ' days')::interval AS adjustment_date,
    (ARRAY[
        'Physical count variance','Damaged goods write-off','Expired parts disposal',
        'System error correction','Customer return processing','Theft/loss adjustment',
        'Quality rejection','Warranty claim parts','Promotional give-away','Sample parts',
        'Inter-branch reconciliation','Vendor return','Dead stock write-off','Goods received short',
        'Excess stock found','Breakage adjustment','Weather damage','Storage error correction',
        'Auditor recommendation','Year-end adjustment'
    ])[((s-1)%20)+1] AS adjustment_reason,
    'ADJ-REF-' || LPAD(s::text, 5, '0') AS ref_no,
    ((s - 1) % 10) + 1 AS branch_id,
    CASE WHEN s % 10 = 0 THEN 'Approved by branch manager' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 13. stock_adjustment_line (1000 records)

```sql
INSERT INTO demo1.stock_adjustment_line
    (id, stock_adjustment_id, part_id, dr_cr, qty, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 10) + 1 AS stock_adjustment_id,
    ((s - 1) % 200) + 1 AS part_id,
    CASE WHEN s % 3 = 0 THEN 'C' ELSE 'D' END AS dr_cr,
    ROUND((1 + (s % 49))::numeric, 3) AS qty,
    CASE WHEN s % 25 = 0 THEN 'Physical verification done' ELSE NULL END AS remarks
FROM generate_series(1, 1000) s
ON CONFLICT (id) DO NOTHING;
```

---

## 14. stock_branch_transfer (100 records)

```sql
INSERT INTO demo1.stock_branch_transfer
    (id, transfer_date, from_branch_id, to_branch_id, ref_no, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    DATE '2024-04-01' + ((s - 1) * 3 || ' days')::interval AS transfer_date,
    ((s - 1) % 10) + 1 AS from_branch_id,
    (((s - 1) % 10) + 1) % 10 + 1 AS to_branch_id,
    'TRF-' || LPAD(s::text, 5, '0') AS ref_no,
    CASE WHEN s % 10 = 0 THEN 'Urgent transfer for service requirement' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 15. stock_branch_transfer_line (1000 records)

```sql
INSERT INTO demo1.stock_branch_transfer_line
    (id, stock_branch_transfer_id, part_id, qty, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 10) + 1 AS stock_branch_transfer_id,
    ((s - 1) % 200) + 1 AS part_id,
    ROUND((1 + (s % 99))::numeric, 3) AS qty,
    CASE WHEN s % 50 = 0 THEN 'Fragile — handle with care' ELSE NULL END AS remarks
FROM generate_series(1, 1000) s
ON CONFLICT (id) DO NOTHING;
```

---

## 16. stock_loan (100 records)

```sql
INSERT INTO demo1.stock_loan
    (id, loan_date, branch_id, ref_no, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    DATE '2024-04-01' + ((s - 1) * 3 || ' days')::interval AS loan_date,
    ((s - 1) % 10) + 1 AS branch_id,
    'LOAN-' || LPAD(s::text, 5, '0') AS ref_no,
    CASE WHEN s % 10 = 0 THEN 'Loan to sister concern — return expected within 30 days' ELSE NULL END AS remarks
FROM generate_series(1, 100) s
ON CONFLICT (id) DO NOTHING;
```

---

## 17. stock_loan_line (1000 records)

```sql
INSERT INTO demo1.stock_loan_line
    (id, stock_loan_id, part_id, dr_cr, qty, remarks, loan_to)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 10) + 1 AS stock_loan_id,
    ((s - 1) % 200) + 1 AS part_id,
    CASE WHEN s % 4 = 0 THEN 'C' ELSE 'D' END AS dr_cr,
    ROUND((1 + (s % 29))::numeric, 3) AS qty,
    CASE WHEN s % 25 = 0 THEN 'Returned in good condition' ELSE NULL END AS remarks,
    (ARRAY[
        'TechFix Services Pvt Ltd','QuickRepair Solutions','GadgetCare India','RepairMaster Co',
        'ElectroFix Hub','Metro Gadget Suppliers','Pioneer Electronics Corp','Eagle Tech Wholesale',
        'Sunrise Parts Depot','Summit Electronics Ltd'
    ])[((s-1)%10)+1] AS loan_to
FROM generate_series(1, 1000) s;
```

---

## 18. stock_opening_balance (10 records — one per branch, unique constraint on branch_id)

```sql
INSERT INTO demo1.stock_opening_balance
    (id, entry_date, ref_no, branch_id, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    DATE '2024-04-01' AS entry_date,
    'OB-' || LPAD(s::text, 5, '0') AS ref_no,
    s AS branch_id,
    CASE WHEN s = 1 THEN 'Head office opening stock — verified by auditor' ELSE NULL END AS remarks
FROM generate_series(1, 10) s
ON CONFLICT (id) DO NOTHING;
```

---

## 19. stock_opening_balance_line (1000 records)

```sql
INSERT INTO demo1.stock_opening_balance_line
    (id, stock_opening_balance_id, part_id, qty, unit_cost, remarks)
OVERRIDING SYSTEM VALUE
SELECT
    s,
    ((s - 1) / 100) + 1 AS stock_opening_balance_id,
    ((s - 1) % 200) + 1 AS part_id,
    ROUND((10 + (s % 490))::numeric, 3) AS qty,
    ROUND((50 + (s * 113 % 4950))::numeric, 2) AS unit_cost,
    CASE WHEN s % 25 = 0 THEN 'Old stock — review for obsolescence' ELSE NULL END AS remarks
FROM generate_series(1, 1000) s
ON CONFLICT (id) DO NOTHING;
```

---

## Execution Order

Run in this sequence to satisfy foreign key constraints:

1. `spare_part_master` (prerequisite — FK target for `part_id`)
2. `branch`
3. `brand`
4. `customer_contact`
5. `supplier`
6. `technician`
7. `product`
8. `product_brand_model`
9. `purchase_invoice`
10. `purchase_invoice_line`
11. `sales_invoice`
12. `sales_invoice_line`
13. `stock_adjustment`
14. `stock_adjustment_line`
15. `stock_branch_transfer`
16. `stock_branch_transfer_line`
17. `stock_loan`
18. `stock_loan_line`
19. `stock_opening_balance`
20. `stock_opening_balance_line`
