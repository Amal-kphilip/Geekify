"use client";

import { useEffect, useRef } from "react";

// ── math helpers ──────────────────────────────────────────────────

const TAU = Math.PI * 2;
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const frac = (x: number) => x - Math.floor(x);

function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

function hash3(x: number, y: number, z: number) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function hueMatrix(degrees: number) {
  const a = Math.cos((degrees * Math.PI) / 180);
  const s = Math.sin((degrees * Math.PI) / 180);
  return [
    0.213 + a * 0.787 - s * 0.213,
    0.715 - a * 0.715 - s * 0.715,
    0.072 - a * 0.072 + s * 0.928,
    0.213 - a * 0.213 + s * 0.143,
    0.715 + a * 0.285 + s * 0.14,
    0.072 - a * 0.072 - s * 0.283,
    0.213 - a * 0.213 - s * 0.787,
    0.715 - a * 0.715 + s * 0.715,
    0.072 + a * 0.928 + s * 0.072,
  ];
}

function applyHue(r: number, g: number, b: number, m: number[]): [number, number, number] {
  return [
    m[0] * r + m[1] * g + m[2] * b,
    m[3] * r + m[4] * g + m[5] * b,
    m[6] * r + m[7] * g + m[8] * b,
  ];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const n = parseInt(clean, 16);
  if (Number.isNaN(n) || clean.length !== 6) return [50, 135, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ── ink constants ─────────────────────────────────────────────────

const INK_SCALE = 0;
const INK_DARK = 1;
const INK_SPOT = 2;
const INK_SHIMMER = 3;
const INK_GLASS = 4;
const INK_GLOW = 5;
const INK_BODY = 6;
const INK_LIT = 7;

interface InkOut {
  r: number;
  g: number;
  b: number;
  kind: number;
  glyphs: string | null;
  au: number;
  av: number;
}

function ink(
  out: InkOut,
  r: number,
  g: number,
  b: number,
  kind: number = INK_SCALE,
  glyphs: string | null = null
) {
  out.r = r;
  out.g = g;
  out.b = b;
  out.kind = kind;
  out.glyphs = glyphs;
  return true;
}

// ── butterfly model & tuning ──────────────────────────────────────

interface Lobe {
  from: number;
  to: number;
  reach: number;
  peak: number;
  round: number;
  scallop: number;
}

const FORE: Lobe = { from: -0.3, to: 1, reach: 0.56, peak: 0.55, round: 0.5, scallop: 0 };
const HIND: Lobe = { from: -1.45, to: 0.15, reach: 0.44, peak: 0.48, round: 0.42, scallop: 0.04 };
const FORE_ROOT = 0.06;
const HIND_ROOT = -0.02;
const BODY: [number, number, number] = [30, 30, 42];
const FLAP_HZ = 2.6;
const GLIDE = 0.35;
const FLUTTER = 1.3;

function lobeReach(l: Lobe, phi: number, t = (phi - l.from) / (l.to - l.from)) {
  if (t <= 0 || t >= 1) return 0;
  const s = t < l.peak ? (t / l.peak) * 0.5 : 0.5 + ((t - l.peak) / (1 - l.peak)) * 0.5;
  const R = l.reach * Math.pow(Math.sin(Math.PI * s), l.round);
  return l.scallop ? R * (1 - l.scallop * (0.5 + 0.5 * Math.cos(t * Math.PI * 14))) : R;
}

function bodyHalfWidth(u: number) {
  if (u > 0.17 || u < -0.32) return 0;
  if (u > 0.11) return Math.sqrt(Math.max(0, 0.03 * 0.03 - (u - 0.14) ** 2));
  if (u > -0.04) return 0.034;
  return 0.03 * (1 - 0.6 * ((-0.04 - u) / 0.28));
}

const lobe = { t: 0, r: 0 };
function inLobe(l: Lobe, du: number, vw: number) {
  const phi = Math.atan2(du, vw);
  const t = (phi - l.from) / (l.to - l.from);
  const R = lobeReach(l, phi, t);
  const r = Math.hypot(du, vw);
  if (r > R) return false;
  lobe.t = t;
  lobe.r = r / R;
  return true;
}

const DEFAULTS = {
  density: 1.05,
  corner: false,
  direction: 49,
  speed: 1.05,
  sway: 0,
  spread: 0,
  size: 1.25,
  farthest: 0.18,
  farBias: 1.7,
  grip: 5,
  separation: 700,
  wingColor: "#3287ff",
  hueShift: 0,
  colorCycle: 0,
  colorVariety: 0,
  shimmer: 0.3,
  sparkle: 0.12,
  fog: 0.75,
  trail: 1.55,
  trailFade: 0.15,
  grid: 1.05,
  detail: 1.3,
  flutter: 0,
  glide: 2.75,
  flapRate: 1,
};

type Tuning = typeof DEFAULTS;
type TuningKey = keyof Tuning;

interface BaseCreature {
  id: number;
  roll: number;
  depth: number;
  span: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  heading: number;
  bias: number;
  startledUntil: number;
  gone: boolean;
}

interface Butterfly extends BaseCreature {
  phase: number;
  open: number;
  glide: number;
  glideUntil: number;
  flutterX: number;
  flutterY: number;
}

interface Pose {
  x: number;
  y: number;
  heading: number;
  span: number;
  depth: number;
  id: number;
}

const butterflies = {
  key: "butterflies",
  label: "Butterfly",
  swatch: [50, 135, 255] as [number, number, number],
  defaults: DEFAULTS,
  area: 48e3,
  scale: 1,
  speed: 90,
  trail: {
    light: [70, 118, 226] as [number, number, number],
    dark: [96, 156, 255] as [number, number, number],
  },
  create: (c: BaseCreature): Butterfly => ({
    ...c,
    phase: rand(0, TAU),
    open: 1,
    glide: 0,
    glideUntil: 0,
    flutterX: 0,
    flutterY: 0,
  }),
  enter(b: Butterfly) {
    b.flutterX = 0;
    b.flutterY = 0;
  },
  update(b: Butterfly, flock: Flock, dt: number) {
    const k = flock.tuning;
    const t = flock.time;
    const cruise = flock.cruise(b);
    const acc = flock.begin();
    flock.steer(b, flock.heading + b.bias * k.spread, cruise, k.grip);
    const kick =
      Math.sqrt(dt) * 520 * FLUTTER * k.flutter * (1 - 0.8 * b.glide) * (0.5 + 0.5 * b.depth);
    b.flutterX += -b.flutterX * 3 * dt + (Math.random() * 2 - 1) * kick;
    b.flutterY += -b.flutterY * 3 * dt + (Math.random() * 2 - 1) * kick;
    acc.x += b.flutterX;
    acc.y += b.flutterY;
    const down = Math.max(0, -Math.sin(b.phase)) * (1 - b.glide);
    acc.x += Math.cos(b.heading) * down * cruise * 1.4;
    acc.y += Math.sin(b.heading) * down * cruise * 1.4;
    flock.separate(b);
    const speed = flock.move(b, dt, cruise * 2.2);
    if (flock.passed(b)) flock.reenter(b);
    if (speed > 12) flock.face(b, dt);
    if (
      b.glide < 0.5 &&
      t > b.glideUntil &&
      speed > cruise * 0.5 &&
      Math.random() < GLIDE * k.glide * dt
    ) {
      b.glideUntil = t + rand(0.5, 1.4);
    }
    b.glide += ((t < b.glideUntil ? 1 : 0) - b.glide) * Math.min(1, dt * 6);
    const urgency = clamp(speed / (cruise * 2), 0, 1);
    b.phase += dt * TAU * FLAP_HZ * k.flapRate * (0.8 + 0.6 * urgency) * (1 - 0.9 * b.glide);
    const beat = Math.pow(0.5 + 0.5 * Math.cos(b.phase), 0.8);
    b.open = 0.1 + 0.9 * (beat * (1 - b.glide) + 0.96 * b.glide);
  },
  startle(b: Butterfly, dx: number, dy: number, strength: number, flock: Flock) {
    const k = strength * 420 * b.depth;
    b.vx += dx * k;
    b.vy += dy * k;
    b.startledUntil = flock.time + rand(0.6, 1.2);
    b.glideUntil = 0;
  },
  draw(b: Butterfly, pen: Pen) {
    const S = b.span;
    const open = Math.max(0.08, b.open);
    const ink$ = pen.ink;
    const [cr, cg, cb] = pen.wingRgb;
    const pose: Pose = {
      x: b.x,
      y: b.y,
      heading: b.heading + 0.06 * Math.sin(b.phase),
      span: S,
      depth: b.depth,
      id: b.id,
    };
    const minBody = pen.cw * 0.4;
    pen.shape(
      pose,
      0.75,
      (u, v) => {
        const av = Math.abs(v);
        const bw = bodyHalfWidth(u);
        if (bw > 0 && av * S <= Math.max(bw * S, minBody)) {
          ink(ink$, ...BODY, INK_BODY);
          return true;
        }
        const vw = av / open;
        let part: number;
        if (inLobe(FORE, u - FORE_ROOT, vw)) part = 0;
        else if (inLobe(HIND, u - HIND_ROOT, vw)) part = 1;
        else return false;
        const { t, r } = lobe;
        if (r > 0.86) {
          if (part === 0 && r < 0.95 && Math.abs(frac(t * 5) - 0.5) < 0.14)
            ink(ink$, 236, 240, 255, INK_SPOT);
          else ink(ink$, cr * 0.35 + 4, cg * 0.21, cb * 0.24, INK_DARK);
        } else if (r < 0.08) ink(ink$, cr * 0.5, cg * 0.33, cb * 0.43, INK_DARK);
        else if (part === 0 && t > 0.9) ink(ink$, cr * 0.58, cg * 0.37, cb * 0.47, INK_DARK);
        else
          ink(
            ink$,
            cr + (255 - cr) * 0.34 * r,
            cg + (255 - cg) * 0.5 * r,
            cb + (255 - cb) * 0.34 * r,
            INK_SHIMMER
          );
        return true;
      },
      { light: 0.6 + 0.4 * b.open, tilt: b.open * 3 }
    );
    const sway = 0.012 * Math.sin(pen.t * 3 + b.id);
    for (const side of [-1, 1]) {
      pen.lineBody(
        pose,
        0.16,
        0.012 * side,
        0.37 + sway,
        (0.12 + sway) * side,
        pen.contrast,
        S > 120 ? "o" : undefined
      );
    }
    const stroke2 = Math.max(0, -Math.sin(b.phase)) * (1 - b.glide);
    const phi = FORE.from + (FORE.to - FORE.from) * FORE.peak;
    const tipU = FORE_ROOT + Math.sin(phi) * FORE.reach * 0.95;
    const tipV = Math.cos(phi) * FORE.reach * 0.95 * b.open;
    const at5 = { x: 0, y: 0 };
    for (const side of [-1, 1]) {
      pen.toWorld(pose, tipU, tipV * side, at5);
      pen.shed(at5.x, at5.y, (0.02 + 0.1 * stroke2) * b.depth);
    }
  },
};

// ── flock simulation ──────────────────────────────────────────────

const STARTLE_RADIUS = 240;
const REFERENCE_SIZE = 160;

class Flock {
  animal = butterflies;
  tuning: Tuning;
  count?: number;
  width = 0;
  height = 0;
  time = 0;
  creatures: Butterfly[] = [];
  events: { x: number; y: number; radius: number; amount: number }[] = [];
  base = 120;
  acc = { x: 0, y: 0 };
  nextId = 1;

  constructor(tuning: Tuning, count?: number) {
    this.tuning = tuning;
    this.count = count;
  }

  resize(width: number, height: number) {
    const first = this.width === 0;
    this.width = width;
    this.height = height;
    this.base = clamp(Math.min(width, height) * 0.2, 80, 190) * this.animal.scale;
    if (first) this.populate(true);
  }

  get course() {
    const k = this.tuning;
    return k.corner ? Math.atan2(-this.height, this.width) : (-k.direction * Math.PI) / 180;
  }

  get heading() {
    const t = this.time;
    return this.course + this.tuning.sway * (Math.sin(t * 0.13) + 0.5 * Math.sin(t * 0.31 + 1.7));
  }

  get target() {
    const { width: W, height: H, animal } = this;
    const shrink = (this.base / animal.scale / REFERENCE_SIZE) ** 2;
    return (
      this.count ??
      clamp(Math.round(((W * H) / (animal.area * shrink)) * this.tuning.density), 1, 200)
    );
  }

  depthOf(roll: number) {
    const k = this.tuning;
    return k.farthest + (1 - k.farthest) * Math.pow(roll, k.farBias);
  }

  cruise(c: Butterfly) {
    return this.animal.speed * (0.55 + 0.45 * c.depth) * this.tuning.speed;
  }

  startle(x: number, y: number) {
    this.events.push({ x, y, radius: 6, amount: 1.4 });
    for (const c of this.creatures) {
      const dx = c.x - x;
      const dy = c.y - y;
      const d = Math.hypot(dx, dy) || 1;
      if (d > STARTLE_RADIUS) continue;
      const strength = 1 - d / STARTLE_RADIUS;
      this.animal.startle(c, dx / d, dy / d, strength, this);
    }
  }

  step(dt: number) {
    this.time += dt;
    this.populate(false);
    for (const c of this.creatures) {
      c.depth = this.depthOf(c.roll);
      c.span = this.base * c.depth * this.tuning.size;
    }
    for (const c of this.creatures) this.animal.update(c, this, dt);
  }

  populate(scatter: boolean) {
    const target = this.target;
    while (this.creatures.length > target) {
      const [c] = this.creatures.splice(Math.floor(Math.random() * this.creatures.length), 1);
      c.gone = true;
    }
    while (this.creatures.length < target) {
      const c = this.spawn();
      if (scatter || Math.random() < 0.5) {
        c.x = rand(0, this.width);
        c.y = rand(0, this.height);
        this.animal.enter(c);
      }
      this.insert(c);
    }
  }

  insert(c: Butterfly) {
    const at5 = this.creatures.findIndex((o) => o.roll > c.roll);
    this.creatures.splice(at5 < 0 ? this.creatures.length : at5, 0, c);
  }

  spawn() {
    const base: BaseCreature = {
      id: this.nextId++,
      roll: Math.random(),
      depth: 1,
      span: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      heading: 0,
      bias: 0,
      startledUntil: 0,
      gone: false,
    };
    base.depth = this.depthOf(base.roll);
    base.span = this.base * base.depth * this.tuning.size;
    const c = this.animal.create(base);
    this.reenter(c);
    return c;
  }

  reenter(c: Butterfly) {
    const { width: W, height: H, course } = this;
    const m = c.span * 0.6;
    const cos = Math.cos(course);
    const sin = Math.sin(course);
    const sideways = H * Math.abs(cos);
    const vertical = W * Math.abs(sin);
    if (Math.random() * (sideways + vertical) < sideways) {
      c.x = cos >= 0 ? -m : W + m;
      c.y = rand(0, H);
    } else {
      c.x = rand(0, W);
      c.y = sin <= 0 ? H + m : -m;
    }
    const cruise = this.cruise(c);
    c.heading = course;
    c.vx = cos * cruise;
    c.vy = sin * cruise;
    c.bias = rand(-1, 1);
    this.animal.enter(c);
  }

  passed(c: Butterfly, margin = c.span) {
    const { width: W, height: H, course } = this;
    const cos = Math.cos(course);
    const sin = Math.sin(course);
    const out =
      (cos > 0.05 && c.x > W + margin) ||
      (cos < -0.05 && c.x < -margin) ||
      (sin < -0.05 && c.y < -margin) ||
      (sin > 0.05 && c.y > H + margin);
    const lost = c.x < -3 * margin || c.x > W + 3 * margin || c.y < -3 * margin || c.y > H + 3 * margin;
    return out || lost;
  }

  begin() {
    this.acc.x = 0;
    this.acc.y = 0;
    return this.acc;
  }

  steer(c: Butterfly, dir: number, speed: number, grip: number) {
    this.acc.x += (Math.cos(dir) * speed - c.vx) * grip;
    this.acc.y += (Math.sin(dir) * speed - c.vy) * grip;
  }

  separate(c: Butterfly, strength = this.tuning.separation, range = 0.42) {
    if (strength <= 0) return;
    for (const o of this.creatures) {
      if (o === c || Math.abs(o.depth - c.depth) > 0.18) continue;
      const ox = c.x - o.x;
      const oy = c.y - o.y;
      const d = Math.hypot(ox, oy);
      const r = (c.span + o.span) * range;
      if (d < r && d > 1e-3) {
        const w = (1 - d / r) * strength;
        this.acc.x += (ox / d) * w;
        this.acc.y += (oy / d) * w;
      }
    }
  }

  move(c: Butterfly, dt: number, max: number) {
    c.vx += this.acc.x * dt;
    c.vy += this.acc.y * dt;
    let speed = Math.hypot(c.vx, c.vy);
    const cap = max + (this.time < c.startledUntil ? 300 : 0);
    if (speed > cap) {
      c.vx *= cap / speed;
      c.vy *= cap / speed;
      speed = cap;
    }
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    return speed;
  }

  face(c: Butterfly, dt: number, rate = 7, angle = Math.atan2(c.vy, c.vx)) {
    const turn = rate * dt;
    c.heading += clamp(angleDiff(c.heading, angle), -turn, turn);
  }
}

// ── ASCII renderer ────────────────────────────────────────────────

const ALPHA_LEVELS = 6;
const PALETTE = {
  background: [12, 11, 17] as [number, number, number],
  grid: [255, 255, 255, 0.055] as [number, number, number, number],
  trailAlpha: 0.85,
  ink: [150, 160, 200] as [number, number, number],
};

const SCALE_RAMP = ".:;+=*%#";
const DARK_GLYPHS = "#%@";
const SPOT_GLYPHS = "o*";
const BODY_GLYPHS = "8#@";
const GLOW_RAMP = ".:+*";
const EDGE_HEAVY = ":;";
const EDGE_LIGHT = ".',`";
const SPARKLES: [number, number, number][] = [
  [255, 255, 255],
  [228, 246, 255],
  [200, 244, 255],
];
const CELL_NONE = 0;
const CELL_SOLID = 1;
const CELL_SOFT = 2;
const SUBSAMPLES = [0.25, 0.3, 0.75, 0.3, 0.25, 0.72, 0.75, 0.72];

function paintGrid(
  g: CanvasRenderingContext2D,
  W: number,
  H: number,
  cw: number,
  ch: number,
  dpr: number,
  strokeStyle: string
) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.strokeStyle = strokeStyle;
  g.lineWidth = 1;
  g.beginPath();
  for (let c = 0; c <= Math.ceil(W / cw); c++) {
    const x = Math.round(c * cw * dpr) + 0.5;
    g.moveTo(x, 0);
    g.lineTo(x, H * dpr);
  }
  for (let r = 0; r <= Math.ceil(H / ch); r++) {
    const y = Math.round(r * ch * dpr) + 0.5;
    g.moveTo(0, y);
    g.lineTo(W * dpr, y);
  }
  g.stroke();
}

const rgb = (r: number, g: number, b: number) =>
  `rgb(${clamp(Math.round(r), 0, 255)},${clamp(Math.round(g), 0, 255)},${clamp(Math.round(b), 0, 255)})`;
const pack = (r: number, g: number, b: number) =>
  (clamp(Math.round(r), 0, 255) << 16) |
  (clamp(Math.round(g), 0, 255) << 8) |
  clamp(Math.round(b), 0, 255);

function lineGlyph(angle: number) {
  let a = angle % Math.PI;
  if (a < 0) a += Math.PI;
  return a < Math.PI / 8 || a >= (7 * Math.PI) / 8
    ? "-"
    : a < (3 * Math.PI) / 8
    ? "\\"
    : a < (5 * Math.PI) / 8
    ? "|"
    : "/";
}

type SampleFn = (u: number, v: number, px: number, py: number) => boolean;

class Pen {
  ink: InkOut = { r: 0, g: 0, b: 0, kind: 0, glyphs: null, au: 0, av: 0 };
  t = 0;
  wingRgb: [number, number, number] = [50, 135, 255];
  private a = { x: 0, y: 0 };
  private b = { x: 0, y: 0 };

  constructor(private r: AsciiRenderer) {}

  get cw() {
    return this.r.cw;
  }
  get ch() {
    return this.r.ch;
  }
  get contrast() {
    return PALETTE.ink;
  }

  toWorld(p: Pose, u: number, v: number, out: { x: number; y: number }) {
    const c = Math.cos(p.heading);
    const s = Math.sin(p.heading);
    out.x = p.x + (u * c - v * s) * p.span;
    out.y = p.y + (u * s + v * c) * p.span;
    return out;
  }

  fogFor(depth: number) {
    return (1 - depth) * this.r.tuning.fog;
  }

  shape(
    p: Pose,
    reach: number,
    sample: SampleFn,
    opts: { light?: number; tilt?: number; fog?: number } = {}
  ) {
    this.r.shape(p, reach, sample, opts);
  }

  lineBody(
    p: Pose,
    u0: number,
    v0: number,
    u1: number,
    v1: number,
    color: [number, number, number],
    tip?: string
  ) {
    const a = this.toWorld(p, u0, v0, this.a);
    const b = this.toWorld(p, u1, v1, this.b);
    this.r.line(a.x, a.y, b.x, b.y, color, this.fogFor(p.depth), tip);
  }

  shed(x: number, y: number, amount: number) {
    this.r.shed(x, y, amount);
  }
}

class AsciiRenderer {
  cw = 12;
  ch = 18;
  cols = 0;
  rows = 0;
  pen = new Pen(this);
  ctx: CanvasRenderingContext2D;
  bg: HTMLCanvasElement;
  dpr = 1;
  width = 0;
  height = 0;
  fontFamily = "ui-monospace, Menlo, monospace";
  energy = new Float32Array(0);
  energyTmp = new Float32Array(0);
  trailStyles: string[] = [];
  hue = hueMatrix(0);
  hueOn = false;
  activeHueDeg = 0;
  cellFlag = new Uint8Array(0);
  cellFill = new Uint32Array(0);
  cellColor = new Uint32Array(0);
  cellGlyph = new Uint16Array(0);

  constructor(private canvas: HTMLCanvasElement, public tuning: Tuning) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("2D canvas unavailable");
    this.ctx = ctx;
    this.bg = document.createElement("canvas");
    this.restyle();
  }

  setFontFamily(family: string) {
    if (family) this.fontFamily = family;
  }

  updateTrailStyles(hueDeg = this.activeHueDeg) {
    const [wr, wg, wb] = hexToRgb(this.tuning.wingColor);
    this.pen.wingRgb = [wr, wg, wb];
    const baseTrail: [number, number, number] = [
      wr + (255 - wr) * 0.22,
      wg + (255 - wg) * 0.18,
      wb + (255 - wb) * 0.22,
    ];
    this.activeHueDeg = hueDeg;
    this.hue = hueMatrix(hueDeg);
    this.hueOn = Math.abs(hueDeg % 360) > 0.01;
    const [r, g, b] = this.turn(baseTrail[0], baseTrail[1], baseTrail[2]);
    this.trailStyles = [];
    for (let l = 0; l < ALPHA_LEVELS; l++) {
      this.trailStyles.push(
        `rgba(${clamp(Math.round(r), 0, 255)},${clamp(Math.round(g), 0, 255)},${clamp(
          Math.round(b),
          0,
          255
        )},${((PALETTE.trailAlpha * (l + 1)) / ALPHA_LEVELS).toFixed(3)})`
      );
    }
  }

  restyle() {
    this.updateTrailStyles(this.tuning.hueShift + this.pen.t * this.tuning.colorCycle * 45);
    this.paintBackground();
  }

  turn(r: number, g: number, b: number, extraMatrix?: number[]): [number, number, number] {
    let out: [number, number, number] = [r, g, b];
    if (this.hueOn) out = applyHue(out[0], out[1], out[2], this.hue);
    if (extraMatrix) out = applyHue(out[0], out[1], out[2], extraMatrix);
    return out;
  }

  fade(r: number, g: number, b: number, f: number) {
    const [br, bg, bb] = PALETTE.background;
    return pack(r + (br - r) * f, g + (bg - g) * f, b + (bb - b) * f);
  }

  resize(width: number, height: number, dpr: number) {
    const prevCols = this.cols;
    const prevRows = this.rows;
    this.width = width;
    this.height = height;
    this.dpr = dpr;
    this.cw = clamp(Math.round(width / 124 / this.tuning.detail), 5, 24);
    this.ch = Math.round(this.cw * 1.45);
    this.cols = Math.ceil(width / this.cw);
    this.rows = Math.ceil(height / this.ch);
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.bg.width = this.canvas.width;
    this.bg.height = this.canvas.height;
    const n = this.cols * this.rows;
    if (this.cols !== prevCols || this.rows !== prevRows) {
      this.energy = new Float32Array(n);
      this.energyTmp = new Float32Array(n);
      this.cellFlag = new Uint8Array(n);
      this.cellFill = new Uint32Array(n);
      this.cellColor = new Uint32Array(n);
      this.cellGlyph = new Uint16Array(n);
    }
    this.paintBackground();
  }

  paintBackground() {
    const g = this.bg.getContext("2d");
    if (!g) return;
    const { width: W, height: H, dpr, cw, ch } = this;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = rgb(...PALETTE.background);
    g.fillRect(0, 0, W, H);
    const [gr, gg, gb, ga] = PALETTE.grid;
    paintGrid(g, W, H, cw, ch, dpr, `rgba(${gr},${gg},${gb},${(ga * this.tuning.grid).toFixed(3)})`);
  }

  render(flock: Flock, dt: number) {
    const { ctx, dpr, cols, ch } = this;
    if (cols === 0) return;
    this.pen.t = flock.time;
    if (this.tuning.colorCycle > 0) {
      this.updateTrailStyles(this.tuning.hueShift + flock.time * this.tuning.colorCycle * 45);
    }
    for (const e of flock.events) this.stamp(e.x, e.y, e.radius, e.amount);
    flock.events.length = 0;
    this.diffuse(dt);
    this.cellFlag.fill(CELL_NONE);
    for (const c of flock.creatures) flock.animal.draw(c, this.pen);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawTrail(flock.time);
    ctx.font = `600 ${Math.round(ch * 0.74)}px ${this.fontFamily}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    this.drawCells();
  }

  cellIndex(x: number, y: number) {
    const c = Math.floor(x / this.cw);
    const r = Math.floor(y / this.ch);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  shed(x: number, y: number, amount: number) {
    const i = this.cellIndex(x, y);
    if (i >= 0) this.energy[i] = Math.min(1.6, this.energy[i] + amount * this.tuning.trail);
  }

  stamp(x: number, y: number, radius: number, amount: number) {
    const field = this.energy;
    const c0 = Math.floor(x / this.cw);
    const r0 = Math.floor(y / this.ch);
    for (let r = r0 - radius; r <= r0 + radius; r++) {
      for (let c = c0 - radius; c <= c0 + radius; c++) {
        if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) continue;
        const d = Math.hypot(c - c0, (r - r0) * 1.4);
        if (d > radius + 0.5) continue;
        const i = r * this.cols + c;
        field[i] = Math.min(1.6, field[i] + amount * (1 - d / (radius + 1)));
      }
    }
  }

  diffuse(dt: number) {
    const { cols, rows, energy, energyTmp: tmp } = this;
    const decay = Math.exp(-dt * this.tuning.trailFade);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const l = c > 0 ? energy[i - 1] : energy[i];
        const rt = c < cols - 1 ? energy[i + 1] : energy[i];
        const u = r > 0 ? energy[i - cols] : energy[i];
        const d = r < rows - 1 ? energy[i + cols] : energy[i];
        tmp[i] = (energy[i] * 4 + l + rt + u + d) * 0.125 * decay;
      }
    }
    this.energy = tmp;
    this.energyTmp = energy;
  }

  drawTrail(t: number) {
    const { ctx, cols, cw, ch, energy, cellFlag } = this;
    const small = Math.max(2, Math.round(cw * 0.19));
    for (let level = 0; level < ALPHA_LEVELS; level++) {
      ctx.fillStyle = this.trailStyles[level];
      for (let i = 0; i < energy.length; i++) {
        const e = energy[i];
        if (e < 0.12 || cellFlag[i] === CELL_SOLID) continue;
        const col = i % cols;
        const row = (i / cols) | 0;
        const twinkle = 0.75 + 0.25 * Math.sin(t * 5 + hash3(col, row, 3) * 40);
        if (clamp(Math.floor(e * twinkle * 4 * ALPHA_LEVELS) - 1, 0, ALPHA_LEVELS - 1) !== level)
          continue;
        const size = e > 0.6 ? small + 1 : small;
        ctx.fillRect(
          Math.round(col * cw + cw * 0.5 - size / 2),
          Math.round(row * ch + ch * 0.6 - size / 2),
          size,
          size
        );
      }
    }
  }

  probe(sample: SampleFn, p: Pose, hc: number, hs: number, px: number, py: number) {
    const ink2 = this.pen.ink;
    const dx = px - p.x;
    const dy = py - p.y;
    const u = (dx * hc + dy * hs) / p.span;
    const v = (dy * hc - dx * hs) / p.span;
    ink2.glyphs = null;
    ink2.au = u;
    ink2.av = v;
    return sample(u, v, px, py);
  }

  shape(
    p: Pose,
    reach: number,
    sample: SampleFn,
    { light = 1, tilt = 0, fog = (1 - p.depth) * this.tuning.fog }
  ) {
    const { cellFlag, cellFill, cellColor, cellGlyph, cw, ch, cols, rows } = this;
    const ink2 = this.pen.ink;
    const t = this.pen.t;
    const { shimmer, sparkle, colorVariety } = this.tuning;
    const varietyMatrix =
      colorVariety > 0 ? hueMatrix(((p.id * 137.508) % 360) * colorVariety) : undefined;
    const S = p.span;
    const hc = Math.cos(p.heading);
    const hs = Math.sin(p.heading);
    const R = reach * S;
    const c0 = Math.max(0, Math.floor((p.x - R) / cw));
    const c1 = Math.min(cols - 1, Math.floor((p.x + R) / cw));
    const r0 = Math.max(0, Math.floor((p.y - R) / ch));
    const r1 = Math.min(rows - 1, Math.floor((p.y + R) / ch));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const x = c * cw;
        const y = r * ch;
        const center = this.probe(sample, p, hc, hs, x + cw / 2, y + ch / 2);
        let hits = center ? 1 : 0;
        let ir = ink2.r;
        let ig = ink2.g;
        let ib = ink2.b;
        const kind = ink2.kind;
        const glyphs = ink2.glyphs;
        const au = ink2.au;
        const av = ink2.av;
        for (let k2 = 0; k2 < SUBSAMPLES.length; k2 += 2) {
          if (this.probe(sample, p, hc, hs, x + SUBSAMPLES[k2] * cw, y + SUBSAMPLES[k2 + 1] * ch)) {
            if (hits === 0) {
              ir = ink2.r;
              ig = ink2.g;
              ib = ink2.b;
            }
            hits++;
          }
        }
        if (hits === 0) continue;
        const coverage = hits / 5;
        const i = r * cols + c;
        const solid = center && coverage >= 0.6;
        if (!solid && cellFlag[i] === CELL_SOLID) continue;
        if (kind !== INK_BODY) {
          [ir, ig, ib] = this.turn(ir, ig, ib, varietyMatrix);
        }
        let k = light * (1 + (hash3(c, r, Math.floor(t * 6)) - 0.5) * 0.06);
        if (solid && kind === INK_SHIMMER) {
          k *= 1 - 0.4 * shimmer + shimmer * Math.sin(t * 2.2 + au * 9 + av * 6 + tilt + p.heading * 2);
        }
        ir *= k;
        ig *= k;
        ib *= k;
        const key =
          (hash3(Math.round((au * S) / (cw * 0.9)), Math.round((av * S) / (cw * 0.9)), p.id) *
            4294967295) >>>
          0;
        if (!solid) {
          const set2 = coverage >= 0.5 ? EDGE_HEAVY : EDGE_LIGHT;
          cellFlag[i] = CELL_SOFT;
          cellColor[i] = this.fade(ir, ig, ib, Math.min(1, fog + 0.55 - 0.45 * coverage));
          cellGlyph[i] = set2.charCodeAt((key >>> 8) % set2.length);
          continue;
        }
        if (kind === INK_GLOW) {
          if (cellFlag[i] === CELL_SOLID) continue;
          const lum = (0.3 * ir + 0.59 * ig + 0.11 * ib) / 255;
          const set2 = glyphs ?? GLOW_RAMP;
          cellFlag[i] = CELL_SOFT;
          cellColor[i] = this.fade(ir, ig, ib, fog);
          cellGlyph[i] = set2.charCodeAt(
            glyphs ? (key >>> 8) % set2.length : clamp(Math.floor(lum * set2.length), 0, set2.length - 1)
          );
          continue;
        }
        cellFlag[i] = CELL_SOLID;
        const roll = hash3(key, Math.floor(t * 2.4 + (key % 997) / 97), 7);
        let set: string;
        let gr: number;
        let gg: number;
        let gb: number;
        if (kind === INK_GLASS) {
          cellFill[i] = this.fade(ir, ig, ib, Math.min(1, 0.62 + fog * 0.38));
          set = glyphs ?? SCALE_RAMP;
          cellColor[i] = this.fade(ir, ig, ib, fog);
          cellGlyph[i] = set.charCodeAt((key >>> 8) % set.length);
          if (roll < sparkle) cellColor[i] = pack(...SPARKLES[key % SPARKLES.length]);
          continue;
        }
        if (kind === INK_LIT) {
          cellFill[i] = this.fade(ir * 0.58, ig * 0.58, ib * 0.58, fog);
          set = glyphs ?? ".:*";
          cellColor[i] =
            roll < sparkle
              ? pack(...SPARKLES[key % SPARKLES.length])
              : this.fade(
                  Math.min(255, ir * 1.05 + 50),
                  Math.min(255, ig * 1.05 + 50),
                  Math.min(255, ib * 1.05 + 50),
                  fog
                );
          cellGlyph[i] = set.charCodeAt((key >>> 8) % set.length);
          continue;
        }
        const fill = this.fade(ir, ig, ib, fog);
        cellFill[i] = fill;
        const fr = fill >>> 16;
        const fg = (fill >>> 8) & 255;
        const fb = fill & 255;
        if (kind === INK_BODY) {
          set = glyphs ?? BODY_GLYPHS;
          [gr, gg, gb] = [fr * 1.6 + 44, fg * 1.6 + 40, fb * 1.6 + 36];
        } else if (kind === INK_DARK) {
          set = glyphs ?? DARK_GLYPHS;
          [gr, gg, gb] = [fr * 1.7 + 34, fg * 1.7 + 30, fb * 1.7 + 30];
        } else if (kind === INK_SPOT) {
          set = glyphs ?? SPOT_GLYPHS;
          [gr, gg, gb] = [fr * 0.4, fg * 0.4, fb * 0.4];
        } else {
          set = glyphs ?? SCALE_RAMP;
          [gr, gg, gb] = [fr * 0.42, fg * 0.42, fb * 0.42];
        }
        let glyph: number;
        if (glyphs || (kind !== INK_SCALE && kind !== INK_SHIMMER)) {
          glyph = set.charCodeAt((key >>> 8) % set.length);
        } else {
          const lum = (0.3 * fr + 0.59 * fg + 0.11 * fb) / 255;
          const jitter = ((key >>> 4) % 3) - 1;
          glyph = set.charCodeAt(
            clamp(Math.floor((1 - lum) * (set.length - 0.01)) + jitter, 0, set.length - 1)
          );
        }
        cellGlyph[i] = glyph;
        const glints = kind === INK_SHIMMER ? sparkle : kind === INK_SCALE ? sparkle / 3 : 0;
        cellColor[i] = roll < glints ? pack(...SPARKLES[key % SPARKLES.length]) : pack(gr, gg, gb);
      }
    }
  }

  line(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    color: [number, number, number],
    fog: number,
    tip?: string
  ) {
    const { cellFlag, cellColor, cellGlyph, cw } = this;
    const [r, g, b] = this.turn(color[0], color[1], color[2]);
    const packed = this.fade(r, g, b, fog);
    const glyph = lineGlyph(Math.atan2(y1 - y0, x1 - x0)).charCodeAt(0);
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cw * 0.5)));
    let last = -1;
    for (let s = 1; s <= steps; s++) {
      const i = this.cellIndex(x0 + ((x1 - x0) * s) / steps, y0 + ((y1 - y0) * s) / steps);
      if (i < 0 || cellFlag[i] === CELL_SOLID) continue;
      cellFlag[i] = CELL_SOFT;
      cellColor[i] = packed;
      cellGlyph[i] = glyph;
      last = i;
    }
    if (tip && last >= 0) cellGlyph[last] = tip.charCodeAt(0);
  }

  drawCells() {
    const { ctx, cols, rows, cw, ch, cellFlag, cellFill, cellColor, cellGlyph } = this;
    const n = cols * rows;
    for (let i = 0; i < n; i++) {
      const flag = cellFlag[i];
      if (!flag) continue;
      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * ch;
      if (flag === CELL_SOLID) {
        const f = cellFill[i];
        ctx.fillStyle = rgb(f >>> 16, (f >>> 8) & 255, f & 255);
        ctx.fillRect(x + 1, y + 1, cw - 1, ch - 1);
      }
      const g = cellColor[i];
      ctx.fillStyle = rgb(g >>> 16, (g >>> 8) & 255, g & 255);
      ctx.fillText(String.fromCharCode(cellGlyph[i]), x + cw / 2, y + ch / 2 + 1);
    }
  }
}

// ── Tweaks panel ──────────────────────────────────────────────────

const OPEN_KEY = "ascii-animals:tweaks-open";
const STORAGE_KEY = "ascii-animals:tweaks:butterflies";

type ControlSpec =
  | {
      key: TuningKey;
      label: string;
      toggle: true;
      hint: string;
    }
  | {
      key: TuningKey;
      label: string;
      color: true;
      hint: string;
    }
  | {
      key: TuningKey;
      label: string;
      min: number;
      max: number;
      step: number;
      disabledWhen?: TuningKey;
      hint: string;
    };

const BUTTERFLY_SECTIONS: [string, ControlSpec[]][] = [
  [
    "Color",
    [
      {
        key: "wingColor",
        label: "Wing color",
        color: true,
        hint: "Pick a custom base colour for the butterfly wings and their trail.",
      },
      {
        key: "hueShift",
        label: "Hue shift (°)",
        min: -180,
        max: 180,
        step: 1,
        hint: "Rotates the butterfly's colour around the colour wheel, in degrees.",
      },
      {
        key: "colorCycle",
        label: "Color cycle speed",
        min: 0,
        max: 3,
        step: 0.05,
        hint: "Automatically cycles butterfly colours smoothly through the spectrum over time. 0 turns it off.",
      },
      {
        key: "colorVariety",
        label: "Rainbow flock",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "Gives each individual butterfly its own colour variation across the flock. 0 makes them all match.",
      },
    ],
  ],
  [
    "Movement",
    [
      { key: "density", label: "Density", min: 0.1, max: 4, step: 0.05, hint: "How many are on screen." },
      {
        key: "corner",
        label: "Corner to corner",
        toggle: true,
        hint: "Cross from the bottom-left corner to the top-right, whatever the window's shape. Turn off to set Direction yourself.",
      },
      {
        key: "direction",
        label: "Direction (°)",
        min: 0,
        max: 360,
        step: 1,
        disabledWhen: "corner",
        hint: "Which way they travel, in degrees: 0 is right, 90 is up. Only used when Corner to corner is off.",
      },
      { key: "speed", label: "Speed", min: 0.1, max: 3, step: 0.05, hint: "How fast they travel." },
      {
        key: "sway",
        label: "Sway",
        min: 0,
        max: 0.6,
        step: 0.01,
        hint: "How much the whole group slowly drifts left and right off course. 0 is a dead-straight line.",
      },
      {
        key: "spread",
        label: "Spread",
        min: 0,
        max: 0.8,
        step: 0.01,
        hint: "How far each one's own path can stray from the group's. 0 means everyone keeps exactly the same line.",
      },
      { key: "size", label: "Size", min: 0.3, max: 2.5, step: 0.05, hint: "How big they are." },
      {
        key: "farthest",
        label: "Farthest depth",
        min: 0.1,
        max: 1,
        step: 0.01,
        hint: "How small and faint the farthest ones get. 1 makes them all equally close.",
      },
      {
        key: "farBias",
        label: "Far bias",
        min: 0.3,
        max: 3,
        step: 0.05,
        hint: "How many sit far away versus close. Higher puts more of them in the distance.",
      },
      {
        key: "grip",
        label: "Hold course",
        min: 0.2,
        max: 5,
        step: 0.05,
        hint: "How hard they steer back onto course after drifting. Higher is stricter.",
      },
      {
        key: "separation",
        label: "Separation",
        min: 0,
        max: 1000,
        step: 10,
        hint: "How strongly neighbours keep their distance from each other.",
      },
    ],
  ],
  [
    "Flight",
    [
      { key: "flutter", label: "Flutter", min: 0, max: 3, step: 0.05, hint: "How much their path zigzags." },
      {
        key: "glide",
        label: "Glide",
        min: 0,
        max: 4,
        step: 0.05,
        hint: "How often they stop flapping and glide with wings held flat.",
      },
      { key: "flapRate", label: "Flap rate", min: 0.2, max: 3, step: 0.05, hint: "How fast their wings beat." },
    ],
  ],
  [
    "Look",
    [
      {
        key: "shimmer",
        label: "Shimmer",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "How much iridescent surfaces roll brighter and darker as the butterfly turns.",
      },
      {
        key: "sparkle",
        label: "Sparkle",
        min: 0,
        max: 0.5,
        step: 0.01,
        hint: "How often cells flash white, like light catching wings.",
      },
      {
        key: "fog",
        label: "Distance fade",
        min: 0,
        max: 1,
        step: 0.01,
        hint: "How much far-away ones fade into the background.",
      },
      { key: "trail", label: "Trail", min: 0, max: 4, step: 0.05, hint: "How much they leave behind." },
      {
        key: "trailFade",
        label: "Trail fade",
        min: 0.05,
        max: 6,
        step: 0.05,
        hint: "How quickly that trail fades. Lower lingers longer.",
      },
      {
        key: "grid",
        label: "Grid",
        min: 0,
        max: 4,
        step: 0.05,
        hint: "How visible the background grid lines are.",
      },
      {
        key: "detail",
        label: "ASCII detail",
        min: 0.5,
        max: 2,
        step: 0.05,
        hint: "ASCII resolution. Higher means smaller characters and finer butterflies.",
      },
    ],
  ],
];

const decimals = (step: number) => (step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step))));

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function loadSaved(): Partial<Tuning> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed.tuning ?? {};
  } catch {
    return {};
  }
}

function changed(values: Tuning, defaults: Tuning) {
  const out: Record<string, number | boolean | string> = {};
  for (const key of Object.keys(defaults) as TuningKey[]) {
    if (values[key] !== defaults[key]) out[key] = values[key];
  }
  return out;
}

function mountTweakPanel(
  tuning: Tuning,
  setKey: <K extends TuningKey>(key: K, value: Tuning[K]) => void
) {
  const saved = loadSaved();
  for (const [key, value] of Object.entries(saved)) {
    if (key in DEFAULTS) {
      setKey(key as TuningKey, value as never);
    }
  }

  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tuning: changed(tuning, DEFAULTS) }));
    } catch {
      // ignore storage errors
    }
  };

  const panel = el("aside", "tweaks tweaks-glass");
  panel.setAttribute("aria-label", "Tweaks");
  const header = el("header", "tweaks-head");
  const title = el("h2", "", "Tweaks");
  const copy = el("button", "tweaks-action", "Copy");
  copy.type = "button";
  const reset = el("button", "tweaks-action", "Reset");
  reset.type = "button";
  const close = el("button", "tweaks-close");
  close.type = "button";
  close.setAttribute("aria-label", "Close tweaks");
  close.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>`;
  header.append(title, copy, reset, close);
  const body = el("div", "tweaks-body scrollbar-thin");
  panel.append(header, body);

  const refreshers: (() => void)[] = [];
  const refreshAll = () => refreshers.forEach((r) => r());

  const tip = el("div", "tweaks-tip");
  tip.setAttribute("role", "tooltip");
  tip.hidden = true;
  const showTip = (row: HTMLElement, hint: string) => {
    if (!hint) return;
    tip.innerHTML = "";
    tip.append(el("span", "", hint), el("small", "", "Double-click the name to reset it."));
    tip.hidden = false;
    const r = row.getBoundingClientRect();
    const p = panel.getBoundingClientRect();
    tip.style.right = `${window.innerWidth - p.left + 10}px`;
    tip.style.top = `${Math.max(
      8,
      Math.min(window.innerHeight - tip.offsetHeight - 8, r.top + r.height / 2 - tip.offsetHeight / 2)
    )}px`;
  };
  const hideTip = () => {
    tip.hidden = true;
  };

  for (const [name, controls] of BUTTERFLY_SECTIONS) {
    const section = el("section", "tweaks-group");
    section.append(el("h3", "", name));
    for (const c of controls) {
      const isToggle = "toggle" in c;
      const isColor = "color" in c;
      const row = el("label", `tweaks-row ${isToggle ? "toggle" : isColor ? "color" : "range"}`);
      const label = el("span", "tweaks-label", c.label);
      row.addEventListener("pointerenter", () => showTip(row, c.hint));
      row.addEventListener("pointerleave", hideTip);
      row.addEventListener("focusin", () => showTip(row, c.hint));
      row.addEventListener("focusout", hideTip);

      if (isToggle) {
        const box = el("input");
        box.type = "checkbox";
        box.addEventListener("change", () => {
          setKey(c.key, box.checked as never);
          refreshAll();
          save();
        });
        refreshers.push(() => {
          box.checked = Boolean(tuning[c.key]);
        });
        label.addEventListener("dblclick", (e) => {
          e.preventDefault();
          setKey(c.key, DEFAULTS[c.key] as never);
          refreshAll();
          save();
        });
        row.append(label, box);
      } else if (isColor) {
        const picker = el("input");
        picker.type = "color";
        picker.addEventListener("input", () => {
          setKey(c.key, picker.value as never);
          refreshAll();
          save();
        });
        refreshers.push(() => {
          picker.value = String(tuning[c.key]);
        });
        label.addEventListener("dblclick", (e) => {
          e.preventDefault();
          setKey(c.key, DEFAULTS[c.key] as never);
          refreshAll();
          save();
        });
        row.append(label, picker);
      } else {
        const out = el("output", "tweaks-value");
        const input = el("input");
        input.type = "range";
        input.min = String(c.min);
        input.max = String(c.max);
        input.step = String(c.step);
        const show = () => {
          const v = Number(tuning[c.key]);
          input.value = String(v);
          out.textContent = v.toFixed(decimals(c.step));
          input.style.setProperty("--fill", `${((v - c.min) / (c.max - c.min)) * 100}%`);
          const off = c.disabledWhen ? Boolean(tuning[c.disabledWhen]) : false;
          input.disabled = off;
          row.classList.toggle("off", off);
        };
        input.addEventListener("input", () => {
          setKey(c.key, Number(input.value) as never);
          show();
          save();
        });
        label.addEventListener("dblclick", (e) => {
          e.preventDefault();
          setKey(c.key, DEFAULTS[c.key] as never);
          show();
          save();
        });
        refreshers.push(show);
        row.append(label, out, input);
      }
      section.append(row);
    }
    body.append(section);
  }

  refreshAll();

  copy.addEventListener("click", async () => {
    const json = JSON.stringify({ tuning: changed(tuning, DEFAULTS) }, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      copy.textContent = "Copied";
    } catch {
      console.log(json);
      copy.textContent = "In console";
    }
    setTimeout(() => {
      copy.textContent = "Copy";
    }, 1400);
  });

  let armed = 0;
  const disarm = () => {
    clearTimeout(armed);
    armed = 0;
    reset.textContent = "Reset";
    reset.classList.remove("confirm");
  };
  reset.addEventListener("click", () => {
    if (!armed) {
      reset.textContent = "Reset all?";
      reset.classList.add("confirm");
      armed = window.setTimeout(disarm, 3000);
      return;
    }
    disarm();
    for (const key of Object.keys(DEFAULTS) as TuningKey[]) {
      setKey(key, DEFAULTS[key] as never);
    }
    refreshAll();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  });

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    try {
      localStorage.setItem(OPEN_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  };
  close.addEventListener("click", () => {
    hideTip();
    setOpen(false);
  });
  const onToggleEvent = () => {
    if (!panel.hidden) hideTip();
    setOpen(panel.hidden);
  };
  window.addEventListener("tweaks:toggle", onToggleEvent);
  document.body.append(panel, tip);

  let open = false;
  try {
    open = localStorage.getItem(OPEN_KEY) === "1";
  } catch {
    // ignore
  }
  setOpen(open);

  return {
    destroy() {
      clearTimeout(armed);
      window.removeEventListener("tweaks:toggle", onToggleEvent);
      panel.remove();
      tip.remove();
    },
  };
}

export function toggleTweaksPanel() {
  window.dispatchEvent(new CustomEvent("tweaks:toggle"));
}

// ── engine & component ────────────────────────────────────────────

const STEP = 1 / 60;
const MAX_STEPS = 4;

export function ButterflyBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tuning: Tuning = { ...DEFAULTS };
    const flock = new Flock(tuning);
    const renderer = new AsciiRenderer(canvas, tuning);
    renderer.setFontFamily(getComputedStyle(canvas).fontFamily);

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let last = 0;
    let acc = 0;
    let visible = true;
    let disposed = false;

    const drawStill = () => {
      if (flock.time < 4) {
        for (let i = 0; i < 240; i++) flock.step(STEP);
      }
      renderer.render(flock, STEP);
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.resize(rect.width, rect.height, dpr);
      flock.resize(rect.width, rect.height);
      if (reducedMotion.matches) drawStill();
    };

    const setKey = <K extends TuningKey>(key: K, value: Tuning[K]) => {
      tuning[key] = value;
      if (key === "detail") resize();
      else if (key === "hueShift" || key === "grid" || key === "wingColor" || key === "colorCycle")
        renderer.restyle();
      if (reducedMotion.matches) drawStill();
    };

    const tweaks = mountTweakPanel(tuning, setKey);

    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      acc += dt;
      let steps = 0;
      while (acc >= STEP && steps < MAX_STEPS) {
        flock.step(STEP);
        acc -= STEP;
        steps++;
      }
      if (steps === MAX_STEPS) acc = 0;
      renderer.render(flock, dt);
      raf = requestAnimationFrame(frame);
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      if (disposed || !visible || reducedMotion.matches) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };

    const onMotionPreference = () => {
      if (reducedMotion.matches) {
        cancelAnimationFrame(raf);
        drawStill();
      } else {
        schedule();
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (reducedMotion.matches) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest(".tweaks, .tweaks-open-inline")) return;
      const rect = canvas.getBoundingClientRect();
      flock.startle(e.clientX - rect.left, e.clientY - rect.top);
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      schedule();
    });
    intersectionObserver.observe(canvas);

    reducedMotion.addEventListener("change", onMotionPreference);
    window.addEventListener("pointerdown", onPointerDown, { passive: true });

    resize();
    document.fonts?.load(`600 16px ${getComputedStyle(canvas).fontFamily}`).then(() => {
      if (!disposed && reducedMotion.matches) drawStill();
    });
    schedule();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      tweaks.destroy();
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      reducedMotion.removeEventListener("change", onMotionPreference);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 block h-full w-full"
      style={{ fontFamily: "var(--font-geist-mono), ui-monospace, Menlo, monospace" }}
    />
  );
}
