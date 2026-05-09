#!/usr/bin/env python3
"""
One-time extraction: revan619-builds.xlsx → YAML source files.
Run from the project root:  python3 scripts/extract-xlsx.py
Writes:
  data/colonies/{ColonyName}.yml
  data/vendors/{FactionName}.yml
  data/vendors/quest_rewards.yml
  data/resources/systems.yml
"""

import zipfile, xml.etree.ElementTree as ET, os, re, sys

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX_PATH = os.path.join(ROOT, 'revan619-builds.xlsx')

# ── helpers ────────────────────────────────────────────────────────────────────

def col_letter_to_num(ref):
    """Convert cell reference like 'AB3' → column number (1-indexed)."""
    col = re.match(r'([A-Z]+)', ref).group(1)
    n = 0
    for c in col:
        n = n * 26 + (ord(c) - ord('A') + 1)
    return n

def get_shared_strings(z):
    root = ET.fromstring(z.read('xl/sharedStrings.xml'))
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    strings = []
    for si in root.findall(f'{{{ns}}}si'):
        t = si.find(f'{{{ns}}}t')
        if t is not None:
            strings.append(t.text or '')
        else:
            parts = si.findall(f'.//{{{ns}}}t')
            strings.append(''.join(p.text or '' for p in parts))
    return strings

def cell_val(cell, shared):
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    v = cell.find(f'{{{ns}}}v')
    if v is None:
        return ''
    if cell.get('t', '') == 's':
        idx = int(v.text)
        return shared[idx] if idx < len(shared) else ''
    # numeric — strip trailing .0
    raw = v.text or ''
    try:
        f = float(raw)
        return str(int(f)) if f == int(f) else raw
    except:
        return raw

def read_sheet(z, sheet_num):
    """Return list of {col_num: value} dicts, one per row."""
    shared = get_shared_strings(z)
    ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'
    root = ET.fromstring(z.read(f'xl/worksheets/sheet{sheet_num}.xml'))
    rows_out = []
    for row in root.findall(f'.//{{{ns}}}row'):
        d = {}
        for cell in row.findall(f'{{{ns}}}c'):
            ref = cell.get('r', '')
            val = cell_val(cell, shared)
            if val:
                d[col_letter_to_num(ref)] = val.strip()
        if d:
            rows_out.append(d)
    return rows_out

def yaml_str(s):
    """Wrap a string for YAML — use block literal if multiline, quotes if needed."""
    if s is None:
        return 'null'
    s = str(s).replace('\t', ' ').replace('\n', ' ').strip()
    # Remove multiple spaces
    s = re.sub(r'  +', ' ', s)
    if not s:
        return "''"
    # Must quote if starts with special chars or contains : followed by space
    needs_quote = (
        s[0] in '#&*!|>\'"{}[],' or
        ': ' in s or
        s.startswith('- ') or
        s == 'null' or s == 'true' or s == 'false'
    )
    if needs_quote:
        escaped = s.replace("'", "''")
        return f"'{escaped}'"
    return s

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  wrote {os.path.relpath(path, ROOT)}')

# ── Colony Projects (sheet 26) ────────────────────────────────────────────────
# Structure: "Colony: {Name} URL" header, then Level subheadings, then projects.
# Columns: B=name, C=cost, D=benefit

def extract_colonies(z):
    rows = read_sheet(z, 26)
    colonies = {}   # name → {levels: {1: [projects], ...}}
    current_colony = None
    current_level  = None

    for row in rows:
        b = row.get(2, '')  # column B
        c = row.get(3, '')  # column C
        d = row.get(4, '')  # column D

        if b.startswith('Colony:'):
            # "Colony: Vheabos VI https://..." — strip URL suffix
            name_part = b.replace('Colony:', '').strip()
            name = re.split(r'\s+https?://', name_part)[0].strip()
            current_colony = name
            current_level  = None
            colonies[name] = {}
            continue

        if current_colony is None:
            continue

        if re.match(r'^Level\s+\d+$', b, re.IGNORECASE):
            lvl = int(re.search(r'\d+', b).group())
            current_level = lvl
            colonies[current_colony][lvl] = []
            continue

        # project row — must have a name and be under a level
        if b and b not in ('Project', '') and current_level is not None:
            # skip pure header rows
            if b in ('Project', 'Cost', 'Benefit'):
                continue
            colonies[current_colony][current_level].append({
                'name':    b,
                'cost':    c or 'None',
                'benefit': d or '',
            })

    # Write one YAML file per colony
    slug_map = {}
    for colony_name, levels in colonies.items():
        slug = colony_name.lower().replace(' ', '-').replace("'", '')
        slug_map[colony_name] = slug
        lines = [f'name: {yaml_str(colony_name)}', 'levels:']
        for lvl in sorted(levels.keys()):
            lines.append(f'  {lvl}:')
            projects = levels[lvl]
            if not projects:
                lines.append('    []')
                continue
            for p in projects:
                lines.append(f'    - name: {yaml_str(p["name"])}')
                lines.append(f'      cost: {yaml_str(p["cost"])}')
                lines.append(f'      benefit: {yaml_str(p["benefit"])}')
        dest = os.path.join(ROOT, 'data', 'colonies', f'{slug}.yml')
        write_file(dest, '\n'.join(lines) + '\n')

    print(f'  colonies: {list(colonies.keys())}')

# ── Vendors (sheet 17) ────────────────────────────────────────────────────────
# Main section: 6 faction groups of 5 cols each starting at col B.
# Group offsets (1-indexed col of Name field): 2, 7, 12, 17, 22, 28
# Per group: Name, Faction, Reputation, Act, ProfitFactor
# Special vendor section: cols B=name, C=source, D=condition, E=act

KNOWN_FACTIONS = {
    'Fellowship of the Void', 'Explorators', 'Drusians',
    'Kasballica Mission', 'Imperial Navy', 'Curiosity Vendor',
}

# Column start (1-indexed) for each of the 6 groups (Name col):
# verified from sheet: 2,8,14,20,26,32 — each group is 5 cols wide with 1-col gap
GROUP_STARTS = [2, 8, 14, 20, 26, 32]

def parse_rep(val):
    """Normalise rep: numeric string → int, text like 'Dogmatic 3' → string."""
    if not val:
        return 0
    try:
        return int(float(val))
    except:
        return val  # keep text like "Dogmatic 3"

def extract_vendors(z):
    rows = read_sheet(z, 17)
    factions   = {f: [] for f in KNOWN_FACTIONS}
    quest_items = []

    for row in rows:
        b = row.get(2, '')

        # Skip header/url rows
        if b in ('', 'Name') or b.startswith('http'):
            continue

        # Check group 1 faction column (col C = col 3)
        faction_col1 = row.get(3, '')
        if faction_col1 in KNOWN_FACTIONS:
            # Main vendor section: parse all 6 groups
            for start in GROUP_STARTS:
                name   = row.get(start, '')
                faction = row.get(start + 1, '')
                rep    = row.get(start + 2, '')
                act    = row.get(start + 3, '')
                pf     = row.get(start + 4, '')
                if name and faction in KNOWN_FACTIONS:
                    try:
                        act_int = int(float(act)) if act else 1
                    except:
                        act_int = 1
                    factions[faction].append({
                        'name': name,
                        'rep':  parse_rep(rep),
                        'act':  act_int,
                        'pf':   pf,
                    })
        else:
            # Special vendor section: B=name, C=source, D=condition, E=act
            c = row.get(3, '')
            d = row.get(4, '')
            e = row.get(5, '')
            if b and c:
                try:
                    act_int = int(float(e)) if e else None
                except:
                    act_int = None
                quest_items.append({
                    'name':      b,
                    'source':    c,
                    'condition': d,
                    'act':       act_int,
                })

    # Write one YAML per faction
    for faction_name, items in factions.items():
        if not items:
            continue
        slug = (faction_name.lower()
                .replace(' ', '-').replace("'", '').replace('/', '-'))
        lines = [f'name: {yaml_str(faction_name)}', 'items:']
        for item in items:
            lines.append(f'  - name: {yaml_str(item["name"])}')
            rep = item['rep']
            if isinstance(rep, int):
                lines.append(f'    rep: {rep}')
            else:
                lines.append(f'    rep: {yaml_str(str(rep))}')
            lines.append(f'    act: {item["act"]}')
            if item['pf']:
                lines.append(f'    pf: {yaml_str(item["pf"])}')
        dest = os.path.join(ROOT, 'data', 'vendors', f'{slug}.yml')
        write_file(dest, '\n'.join(lines) + '\n')

    # Write quest rewards
    if quest_items:
        lines = ['items:']
        for item in quest_items:
            lines.append(f'  - name: {yaml_str(item["name"])}')
            lines.append(f'    source: {yaml_str(item["source"])}')
            if item['condition']:
                lines.append(f'    condition: {yaml_str(item["condition"])}')
            if item['act'] is not None:
                lines.append(f'    act: {item["act"]}')
        dest = os.path.join(ROOT, 'data', 'vendors', 'quest-rewards.yml')
        write_file(dest, '\n'.join(lines) + '\n')

    total = sum(len(v) for v in factions.values()) + len(quest_items)
    print(f'  vendors: {total} items across {len(factions)} factions + {len(quest_items)} quest rewards')

# ── Space & System Resources (sheet 28) ───────────────────────────────────────
# Col B = system name, C-L = resource quantities, N = extractum quality, O = event quality
# Resource columns (1-indexed): People=3, Provisions=4, Chemicals=5, Plasteel=6,
#   Mechanisms=7, Promethium=8, Weapons=9, Xenotech=10, Adamantine=11, Flogiston=12
# Extractum=14, Event=15

RESOURCE_COLS = {
    3:  'people',
    4:  'provisions',
    5:  'chemicals',
    6:  'plasteel',
    7:  'mechanisms',
    8:  'promethium',
    9:  'weapons',
    10: 'xenotech',
    11: 'adamantine',
    12: 'flogiston',
}

# Systems that are actually route/notes, not real star systems
SKIP_SYSTEMS = {
    'Resource', 'System', 'Pre Space', 'DLC2 Heartless Encounter',
    'Possible after 4', 'Can provide Second Escort', 'DLC1 after 13',
    'Dargonus (For Escort)', '10500 Navy Rep',
    'Space Combat Route',
}

def parse_qty(val):
    """'7.0' → 7, '"1 / 2"' → '1/2' (keep as string for split quantities)."""
    if not val:
        return None
    val = val.strip().strip('"')
    if '/' in val:
        parts = [p.strip() for p in val.split('/')]
        try:
            return [int(float(p)) for p in parts]
        except:
            return val
    try:
        f = float(val)
        return int(f) if f == int(f) else f
    except:
        return val

def extract_resources(z):
    rows = read_sheet(z, 28)
    systems = []

    for row in rows:
        name = row.get(2, '')  # col B
        if not name or name.startswith('http') or name in SKIP_SYSTEMS:
            continue

        resources = {}
        for col, res_name in RESOURCE_COLS.items():
            qty = parse_qty(row.get(col, ''))
            if qty is not None:
                resources[res_name] = qty

        extractum = row.get(14, '')  # col N
        event     = row.get(15, '')  # col O

        if not resources and not extractum and not event:
            continue  # skip empty rows like Furibundus

        entry = {'name': name}
        if resources:
            entry['resources'] = resources
        if extractum:
            entry['extractum'] = extractum.lower()
        if event:
            entry['event'] = event.lower()

        systems.append(entry)

    # Deduplicate (Last Chance of Cyrene appears twice)
    seen = set()
    unique = []
    for s in systems:
        if s['name'] not in seen:
            seen.add(s['name'])
            unique.append(s)

    # Write YAML
    lines = ['systems:']
    for s in unique:
        lines.append(f'  - name: {yaml_str(s["name"])}')
        if 'resources' in s:
            lines.append('    resources:')
            for res, qty in s['resources'].items():
                if isinstance(qty, list):
                    lines.append(f'      {res}: [{qty[0]}, {qty[1]}]')
                else:
                    lines.append(f'      {res}: {qty}')
        if 'extractum' in s:
            lines.append(f'    extractum: {yaml_str(s["extractum"])}')
        if 'event' in s:
            lines.append(f'    event: {yaml_str(s["event"])}')

    dest = os.path.join(ROOT, 'data', 'resources', 'systems.yml')
    write_file(dest, '\n'.join(lines) + '\n')
    print(f'  resources: {len(unique)} systems')

# ── main ──────────────────────────────────────────────────────────────────────

if not os.path.exists(XLSX_PATH):
    print(f'ERROR: {XLSX_PATH} not found', file=sys.stderr)
    sys.exit(1)

print('Extracting from revan619-builds.xlsx …')
with zipfile.ZipFile(XLSX_PATH) as z:
    print('\nColonies:')
    extract_colonies(z)
    print('\nVendors:')
    extract_vendors(z)
    print('\nResources:')
    extract_resources(z)

print('\nDone.')
