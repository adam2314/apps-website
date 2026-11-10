/* Game data: tuning constants, tools, wash steps, services, upgrades and car designs. */

export const CONFIG = {
  stepDone: 0.95,       // progress needed to finish a step
  dayStart: 8 * 60,     // 8:00 AM in minutes
  dayEnd: 18 * 60,      // 6:00 PM
  daySeconds: 300,      // real seconds per business day
  baseArrival: 58,      // seconds between customers on day 1 at 3 stars with no ads (shrinks as days go by)
  queueMax: 4,
  basePatience: 80,     // seconds a customer waits in line
  saveKey: 'shine-time-3d-save-v1',
};

/* ---------- tools ---------- */
export const TOOL_ORDER = ['hose', 'foam', 'sponge', 'dryer', 'tire', 'wax'];

export const TOOLS = {
  hose:   { id: 'hose',   name: 'Hose',        key: '1' },
  foam:   { id: 'foam',   name: 'Foam Cannon', key: '2' },
  sponge: { id: 'sponge', name: 'Sponge',      key: '3' },
  dryer:  { id: 'dryer',  name: 'Towel',       key: '4' },
  tire:   { id: 'tire',   name: 'Tire Shine',  key: '5' },
  wax:    { id: 'wax',    name: 'Polisher',    key: '6' },
};

/** Live stats for a tool given upgrade levels (radius in meters).
 *  kind 'spray' works over time (power per second); 'rub' works with motion (power per meter rubbed). */
export function toolStats(id, up) {
  switch (id) {
    case 'hose': {
      const l = up.nozzle || 0;
      return { kind: 'spray', radius: 0.42 * (1 + 0.11 * l), power: 5.5 * (1 + 0.25 * l) };
    }
    case 'foam': {
      const l = up.foamer || 0;
      return { kind: 'spray', radius: 0.52 * (1 + 0.11 * l), power: 6 * (1 + 0.28 * l) };
    }
    case 'sponge': {
      const l = up.mitt || 0;
      return { kind: 'rub', radius: 0.3 * (1 + 0.1 * l), power: 4.2 * (1 + 0.3 * l), idle: 0.5 };
    }
    case 'dryer': {
      const l = up.dryer || 0;
      if (l >= 3) return { kind: 'spray', radius: 0.7, power: 7, name: 'Turbo Blower', variant: 'turbo', blower: true };
      if (l === 2) return { kind: 'spray', radius: 0.58, power: 5, name: 'Air Blower', variant: 'blower', blower: true };
      if (l === 1) return { kind: 'rub', radius: 0.48, power: 2.3, idle: 0.3, name: 'Plush Towel', variant: 'plush' };
      return { kind: 'rub', radius: 0.42, power: 1.7, idle: 0.25, name: 'Towel', variant: 'towel' };
    }
    case 'tire': {
      const l = Math.max(0, (up.tireKit || 1) - 1);
      return { kind: 'spray', radius: 0.3 * (1 + 0.15 * l), power: 4 * (1 + 0.4 * l) };
    }
    case 'wax': {
      const l = Math.max(0, (up.waxKit || 1) - 1);
      return { kind: 'rub', radius: 0.44 * (1 + 0.15 * l), power: 1.9 * (1 + 0.4 * l), idle: 0.25 };
    }
  }
  return { kind: 'spray', radius: 0.3, power: 1 };
}

export function toolName(id, up) {
  return toolStats(id, up).name || TOOLS[id].name;
}

export function toolUnlocked(id, up) {
  if (id === 'tire') return (up.tireKit || 0) > 0;
  if (id === 'wax') return (up.waxKit || 0) > 0;
  return true;
}

/* ---------- wash steps ---------- */
// layer: which wash layer the step works on. mode: 'remove' lowers it, 'apply' raises it. par: seconds a customer expects.
export const STEPS = {
  prerinse: { id: 'prerinse', name: 'Pre-Rinse',  tool: 'hose',   layer: 'dust',  mode: 'remove', par: 12, hint: 'Spray the dust off every panel' },
  foam:     { id: 'foam',     name: 'Foam',       tool: 'foam',   layer: 'foam',  mode: 'apply',  par: 9,  hint: 'Cover the whole car in thick foam' },
  scrub:    { id: 'scrub',    name: 'Scrub',      tool: 'sponge', layer: 'grime', mode: 'remove', par: 12, hint: 'Rub the stubborn spots back and forth' },
  rinse:    { id: 'rinse',    name: 'Rinse',      tool: 'hose',   layer: 'foam',  mode: 'remove', par: 10, hint: 'Rinse away all of the suds' },
  dry:      { id: 'dry',      name: 'Dry',        tool: 'dryer',  layer: 'water', mode: 'remove', par: 11, hint: 'Wipe off every water spot' },
  tires:    { id: 'tires',    name: 'Tire Shine', tool: 'tire',   layer: 'tire',  mode: 'apply',  par: 7,  hint: 'Spray all four tires glossy black' },
  wax:      { id: 'wax',      name: 'Wax',        tool: 'wax',    layer: 'wax',   mode: 'apply',  par: 11, hint: 'Buff the paint to a mirror shine' },
};

/* ---------- services ---------- */
export const SERVICES = [
  { id: 'quick',    name: 'Quick Rinse',     price: 14, color: '#7dd3fc', steps: ['prerinse', 'dry'], grime: false },
  { id: 'full',     name: 'Full Wash',       price: 28, color: '#51e4d1', steps: ['prerinse', 'foam', 'scrub', 'rinse', 'dry'], grime: true },
  { id: 'shine',    name: 'Shine Wash',      price: 42, color: '#ffd166', steps: ['prerinse', 'foam', 'scrub', 'rinse', 'dry', 'tires'], grime: true, needs: ['tireKit'] },
  { id: 'showroom', name: 'Showroom Detail', price: 66, color: '#ff9ecf', steps: ['prerinse', 'foam', 'scrub', 'rinse', 'dry', 'wax', 'tires'], grime: true, needs: ['tireKit', 'waxKit'] },
];

export function serviceUnlocked(svc, up) {
  return !svc.needs || svc.needs.every((k) => (up[k] || 0) > 0);
}

/* ---------- upgrades ---------- */
export const UPGRADES = [
  { id: 'nozzle',   cat: 'Tools',    icon: 'hose',   name: 'Pressure Nozzle',  costs: [90, 220, 480, 950, 1800], desc: 'Wider, harder-hitting hose spray.' },
  { id: 'foamer',   cat: 'Tools',    icon: 'foam',   name: 'Foam Cannon',      costs: [110, 260, 600, 1200],    desc: 'Thicker foam from a wider fan.' },
  { id: 'mitt',     cat: 'Tools',    icon: 'sponge', name: 'Scrub Mitts',      costs: [100, 240, 550, 1100],    desc: 'Lift stubborn grime faster.' },
  { id: 'dryer',    cat: 'Tools',    icon: 'dryer',  name: 'Drying Gear',      costs: [140, 420, 950],          desc: 'Plush towel, then an air blower, then a turbo blower.' },
  { id: 'tireKit',  cat: 'Services', icon: 'tire',   name: 'Tire Shine Kit',   costs: [260, 600],               desc: 'Unlocks the Shine Wash ($42). Level 2 sprays faster.' },
  { id: 'waxKit',   cat: 'Services', icon: 'wax',    name: 'Wax Polisher',     costs: [650, 1300],              desc: 'Unlocks the Showroom Detail ($66). Level 2 buffs faster.', requires: 'tireKit' },
  { id: 'bot',      cat: 'Staff',    icon: 'bot',    name: 'Scrub Bot',        costs: [500, 1400, 3200],        desc: 'A helper drone that works each step alongside you.' },
  { id: 'belt',     cat: 'Staff',    icon: 'belt',   name: 'Tool Belt',        costs: [150],                    desc: 'Switches to the right tool automatically after each step.' },
  { id: 'lounge',   cat: 'Business', icon: 'lounge', name: 'Waiting Lounge',   costs: [160, 420, 950],          desc: '+25% customer patience per level.' },
  { id: 'ads',      cat: 'Business', icon: 'ads',    name: 'Advertising',      costs: [200, 520, 1200],         desc: '+20% more customers per level.' },
  { id: 'products', cat: 'Business', icon: 'star',   name: 'Premium Products', costs: [320, 850, 1900],         desc: '+12% on every service price per level.' },
  { id: 'vending',  cat: 'Business', icon: 'vend',   name: 'Vending Machine',  costs: [180, 480],               desc: 'Customers grab a snack: +$3 per car per level.' },
];

export const RANKS = [
  { at: 0,     name: 'Driveway Startup' },
  { at: 800,   name: 'Corner Wash' },
  { at: 3000,  name: 'Suds Station' },
  { at: 9000,  name: 'Shine Factory' },
  { at: 22000, name: 'Gloss Boss' },
  { at: 50000, name: 'Car Spa Legend' },
];

export const CUSTOMER_NAMES = ['Maya', 'Leo', 'Priya', 'Sam', 'Jordan', 'Ava', 'Noah', 'Zoe', 'Kai', 'Lena', 'Omar', 'Rosa',
  'Theo', 'Iris', 'Malik', 'Nina', 'Felix', 'Hana', 'Diego', 'Ruby', 'Eli', 'Mira', 'Owen', 'Talia', 'Ben', 'Yuki',
  'Grace', 'Arjun', 'Chloe', 'Max', 'Sofia', 'Remy', 'Ada', 'Luca', 'Nora', 'Jonah'];

export const CAR_COLORS = ['#d32f2f', '#1e88e5', '#fbc02d', '#43a047', '#fb8c00', '#8e24aa', '#eceff1', '#37474f',
  '#90a4ae', '#00acc1', '#6d4c41', '#d81b60', '#263238', '#7cb342', '#3949ab', '#f4511e'];

/*
 * Car designs as side profiles, facing right (+x). Units: ground at y=300 (y down), x from 0 (rear) to len (front).
 * The 3D builder extrudes these. body: outline [x, y, cornerRadius?]; belt: window-line height;
 * windows: side glass; windshield / rearGlass: [top point, bottom point] of the sloped glass (null for upright);
 * wheels: [x, y, r]; doors: polylines; handles: [x, y]; head/tail: side light shapes; mirror: [x, y].
 * width: metres; cabin: cabin width as a fraction of body width.
 */
export const CAR_TYPES = {
  sedan: {
    label: 'sedan', len: 800, weight: 1.3, width: 1.8, cabin: 0.84, belt: 150,
    body: [[34, 262, 10], [16, 238, 14], [14, 186, 16], [32, 160, 18], [196, 150, 24], [292, 92, 30], [330, 82, 20], [466, 80, 24], [506, 90, 30], [588, 148, 30], [736, 160, 30], [784, 180, 20], [796, 226, 14], [780, 262, 10]],
    windows: [
      [[214, 150], [298, 100], [328, 92], [386, 91], [386, 150]],
      [[398, 150], [398, 91], [466, 89], [494, 96], [566, 150]],
    ],
    windshield: [[506, 90], [588, 148]], rearGlass: [[292, 92], [196, 150]],
    wheels: [[172, 250, 50], [628, 250, 50]],
    doors: [[[392, 152], [392, 254]], [[240, 152], [240, 250]], [[560, 150], [556, 250]]],
    handles: [[338, 170], [510, 170]],
    head: [[744, 170], [780, 182], [783, 198], [750, 194]],
    tail: [[22, 176], [46, 170], [48, 194], [18, 198]],
    mirror: [574, 140],
    extras: ['taxi'],
  },
  hatch: {
    label: 'hatchback', len: 700, weight: 1.1, width: 1.72, cabin: 0.86, belt: 150,
    body: [[30, 262, 10], [12, 234, 12], [12, 160, 16], [28, 118, 26], [78, 80, 30], [118, 72, 20], [384, 70, 24], [418, 80, 30], [508, 142, 30], [640, 154, 30], [684, 174, 20], [694, 224, 14], [680, 262, 10]],
    windows: [
      [[40, 150], [52, 124], [88, 88], [118, 82], [236, 81], [236, 150]],
      [[248, 150], [248, 81], [382, 80], [408, 88], [488, 150]],
    ],
    windshield: [[418, 80], [508, 142]], rearGlass: [[78, 80], [28, 118]],
    wheels: [[150, 254, 46], [556, 254, 46]],
    doors: [[[242, 152], [242, 254]], [[494, 152], [492, 250]]],
    handles: [[292, 170]],
    head: [[650, 164], [680, 176], [684, 192], [654, 188]],
    tail: [[16, 150], [30, 146], [32, 176], [14, 180]],
    mirror: [500, 134],
    extras: [],
  },
  suv: {
    label: 'SUV', len: 820, weight: 1.1, width: 1.94, cabin: 0.9, belt: 128,
    body: [[30, 252, 12], [12, 222, 14], [10, 104, 14], [22, 64, 26], [62, 48, 24], [560, 46, 22], [594, 56, 28], [652, 130, 30], [770, 140, 30], [808, 160, 20], [816, 220, 14], [800, 252, 12]],
    windows: [
      [[38, 128], [38, 72], [62, 60], [198, 60], [198, 128]],
      [[212, 128], [212, 60], [388, 60], [388, 128]],
      [[402, 128], [402, 60], [556, 58], [582, 68], [638, 128]],
    ],
    windshield: [[594, 56], [652, 130]], rearGlass: null,
    wheels: [[182, 242, 58], [650, 242, 58]],
    doors: [[[205, 130], [205, 246]], [[395, 130], [395, 250]], [[600, 132], [588, 246]]],
    handles: [[256, 150], [446, 150]],
    head: [[772, 146], [806, 162], [810, 180], [776, 176]],
    tail: [[12, 110], [30, 108], [30, 150], [12, 152]],
    mirror: [632, 118],
    extras: ['roofrack'],
  },
  pickup: {
    label: 'pickup', len: 860, weight: 0.9, width: 1.96, cabin: 0.9, belt: 136,
    body: [[26, 256, 10], [10, 226, 12], [10, 152, 10], [20, 142, 6], [358, 142, 6], [368, 132, 8], [374, 72, 18], [398, 58, 20], [560, 56, 22], [592, 66, 28], [652, 136, 30], [800, 146, 30], [842, 168, 20], [852, 222, 14], [836, 256, 10]],
    windows: [
      [[390, 136], [390, 72], [404, 66], [466, 65], [466, 136]],
      [[478, 136], [478, 65], [556, 64], [582, 74], [636, 136]],
    ],
    windshield: [[592, 66], [652, 136]], rearGlass: null,
    wheels: [[178, 244, 56], [692, 244, 56]],
    doors: [[[366, 144], [366, 254]], [[472, 138], [472, 252]], [[642, 140], [630, 250]]],
    handles: [[420, 156], [520, 156]],
    head: [[806, 152], [840, 168], [846, 186], [810, 182]],
    tail: [[12, 158], [26, 158], [26, 196], [12, 196]],
    mirror: [636, 126],
    extras: ['bed'],
  },
  van: {
    label: 'van', len: 860, weight: 0.8, width: 1.98, cabin: 0.95, belt: 114,
    body: [[26, 258, 10], [10, 226, 12], [10, 60, 16], [24, 36, 24], [60, 28, 24], [612, 28, 30], [660, 40, 30], [742, 118, 30], [822, 138, 30], [848, 168, 20], [852, 226, 14], [836, 258, 10]],
    windows: [
      [[40, 114], [40, 56], [54, 48], [196, 48], [196, 114]],
      [[212, 114], [212, 48], [470, 48], [470, 114]],
      [[562, 120], [562, 52], [640, 50], [668, 60], [728, 122]],
    ],
    windshield: [[660, 40], [742, 118]], rearGlass: null,
    wheels: [[172, 248, 52], [702, 248, 52]],
    doors: [[[204, 116], [204, 250]], [[480, 116], [480, 254]], [[552, 120], [552, 254]], [[738, 124], [728, 250]]],
    handles: [[492, 150], [580, 150]],
    head: [[808, 142], [844, 160], [848, 180], [812, 176]],
    tail: [[12, 120], [26, 118], [26, 170], [12, 172]],
    mirror: [736, 112],
    extras: ['stripe'],
  },
  coupe: {
    label: 'sports coupe', len: 800, weight: 0.8, width: 1.86, cabin: 0.8, belt: 162,
    body: [[30, 262, 10], [14, 238, 14], [16, 196, 16], [36, 172, 16], [150, 162, 30], [252, 118, 40], [332, 96, 26], [436, 94, 26], [478, 104, 40], [584, 160, 40], [742, 172, 30], [788, 196, 20], [798, 234, 14], [780, 262, 10]],
    windows: [
      [[262, 162], [300, 128], [336, 106], [392, 104], [392, 162]],
      [[402, 162], [402, 104], [432, 104], [462, 112], [560, 162]],
    ],
    windshield: [[478, 104], [584, 160]], rearGlass: [[332, 96], [252, 118]],
    wheels: [[172, 252, 48], [628, 252, 48]],
    doors: [[[396, 164], [396, 254]], [[566, 166], [562, 250]]],
    handles: [[420, 182]],
    head: [[740, 176], [782, 196], [786, 210], [748, 202]],
    tail: [[18, 192], [48, 182], [50, 200], [18, 208]],
    mirror: [570, 152],
    extras: ['spoiler'],
  },
};
