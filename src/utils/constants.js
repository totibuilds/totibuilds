// ═══════════════════════════════════════
// CATEGORIES & STRUCTURED OPTIONS
// ═══════════════════════════════════════
export const CATEGORIES = ["Shelf", "Standing Shelf", "Cabinet", "Furniture", "Artwork", "Decorative"];

export const MOUNT_TYPES = {
  "Shelf": ["Floating / concealed", "Bracket-mounted", "Rail system"],
  "Standing Shelf": ["Freestanding flush", "Freestanding with legs"],
  "Cabinet": ["Wall-hung", "Freestanding with legs", "Freestanding flush"],
  "Furniture": ["Freestanding with legs", "Freestanding flush"],
  "Artwork": [],
  "Decorative": [],
};

export const DOOR_STYLES = ["Plain / handleless", "Bar handle", "Knob", "Recessed grip", "Open / no door"];
export const DOOR_CONFIGS = ["Single door", "Double doors", "No door"];
export const FRAME_TYPES = ["No frame / canvas wrap", "Thin modern frame", "Thick traditional frame", "Floating frame"];
export const SHELF_STYLES = ["Flat slab", "With lip / edge", "With backboard"];
export const DRAWER_COUNTS = [0, 1, 2, 3, 4, 5, 6];
export const LEG_STYLES = ["None", "Short legs", "Tall legs", "Hairpin legs"];

// ═══════════════════════════════════════
// MATERIALS & COLORS
// ═══════════════════════════════════════
export const MATERIALS = {
  Wood: [
    { name: "Birch", hex: "#d4be97" },
    { name: "Maple", hex: "#c9a86c" },
    { name: "Honey Oak", hex: "#b8884b" },
    { name: "Medium Oak", hex: "#9a7340" },
    { name: "Cherry", hex: "#8b4a2b" },
    { name: "Walnut", hex: "#6b4423" },
    { name: "Dark Walnut", hex: "#503318" },
    { name: "Espresso", hex: "#3c2415" },
    { name: "Wenge", hex: "#2e1a0e" },
  ],
  Metal: [
    { name: "Chrome", hex: "#c0c0c0" },
    { name: "Brushed Steel", hex: "#8a8a8a" },
    { name: "Gold / Brass", hex: "#c5a14e" },
    { name: "Copper", hex: "#b87333" },
    { name: "Matte Black", hex: "#2a2a2a" },
    { name: "White Metal", hex: "#e8e4dc" },
  ],
  Painted: [
    { name: "White", hex: "#f5f2eb" },
    { name: "Cream", hex: "#f0e6d0" },
    { name: "Warm Grey", hex: "#a09a90" },
    { name: "Cool Grey", hex: "#8a8f96" },
    { name: "Charcoal", hex: "#4a4a4a" },
    { name: "Black", hex: "#1a1a1e" },
    { name: "Navy", hex: "#2c3e5a" },
    { name: "Forest", hex: "#3a5a3a" },
    { name: "Sage", hex: "#8aaa7a" },
    { name: "Terracotta", hex: "#c4604a" },
    { name: "Dusty Rose", hex: "#c4888a" },
    { name: "Sky Blue", hex: "#7aaac4" },
  ],
  Glass: [
    { name: "Clear", hex: "#d4e8f0" },
    { name: "Frosted", hex: "#c8d4d8" },
    { name: "Tinted", hex: "#8aaa9a" },
    { name: "Smoked", hex: "#6a6a6a" },
  ],
};

// ═══════════════════════════════════════
// THEME COLORS
// ═══════════════════════════════════════
export const C = {
  bg: "#f7f3ed",
  surface: "#ffffff",
  surfaceAlt: "#f0ebe3",
  border: "#e0d8cc",
  borderLight: "#ebe5db",
  accent: "#b8884b",
  accentDark: "#96703c",
  accentGlow: "rgba(184,136,75,0.12)",
  text: "#3a3028",
  textDim: "#7a7068",
  textMuted: "#a8a098",
  danger: "#c45c5c",
  dangerBg: "rgba(196,92,92,0.08)",
  white: "#ffffff",
};

// ═══════════════════════════════════════
// DESIGN RULES ENGINE
// ═══════════════════════════════════════
export const DESIGN_RULES = [
  {
    id: "art-height",
    name: "Artwork hanging height",
    check: (el, project) => {
      if (el.category !== "Artwork") return null;
      const centerFromFloor = project.wallHeight - el.y - el.height / 2;
      if (centerFromFloor < 135 || centerFromFloor > 165) {
        return { severity: "warning", message: `Center is ${Math.round(centerFromFloor)}cm from floor. Gallery standard is 145–155cm.`, fix: { y: project.wallHeight - 150 - el.height / 2 } };
      }
      return null;
    },
  },
  {
    id: "ceiling-gap",
    name: "Distance from ceiling",
    check: (el, project) => {
      if (el.category === "Artwork" || el.category === "Decorative") return null;
      if (el.y < 15) {
        return { severity: "warning", message: `Only ${Math.round(el.y)}cm from ceiling. Recommended minimum is 15–25cm.`, fix: { y: 20 } };
      }
      return null;
    },
  },
  {
    id: "edge-gap",
    name: "Distance from wall edge",
    check: (el, project) => {
      const left = el.x;
      const right = project.wallWidth - el.x - el.width;
      if (left < 5 && left > 0) return { severity: "info", message: `Only ${Math.round(left)}cm from left edge. Consider flush (0cm) or at least 10cm gap.` };
      if (right < 5 && right > 0) return { severity: "info", message: `Only ${Math.round(right)}cm from right edge. Consider flush (0cm) or at least 10cm gap.` };
      return null;
    },
  },
  {
    id: "heavy-low",
    name: "Visual weight balance",
    check: (el, project) => {
      if (el.category !== "Cabinet" && el.category !== "Furniture") return null;
      const centerFromFloor = project.wallHeight - el.y - el.height / 2;
      if (centerFromFloor > project.wallHeight * 0.6 && el.width > 40 && el.height > 40) {
        return { severity: "info", message: `Large/heavy items generally look better in the lower portion of the wall.` };
      }
      return null;
    },
  },
  {
    id: "spacing-between",
    name: "Element spacing",
    check: (el, project) => {
      for (const other of project.elements) {
        if (other.id === el.id) continue;
        // Check vertical gap (elements roughly aligned horizontally)
        const hOverlap = !(el.x + el.width < other.x || other.x + other.width < el.x);
        if (hOverlap) {
          const gap1 = other.y - (el.y + el.height);
          const gap2 = el.y - (other.y + other.height);
          const gap = Math.max(gap1, gap2);
          if (gap > 0 && gap < 8) {
            return { severity: "info", message: `Only ${Math.round(gap)}cm gap to "${other.name}". Recommended minimum spacing is 8–15cm.` };
          }
        }
      }
      return null;
    },
  },
  {
    id: "symmetry-hint",
    name: "Symmetry check",
    check: (el, project) => {
      const centerX = el.x + el.width / 2;
      const wallCenter = project.wallWidth / 2;
      const offset = Math.abs(centerX - wallCenter);
      if (offset > 5 && offset < 20) {
        return { severity: "info", message: `${Math.round(offset)}cm off-center. Consider centering for a balanced look, or offset further for intentional asymmetry.` };
      }
      return null;
    },
  },
];

export function runDesignCheck(project) {
  const suggestions = [];
  for (const el of project.elements) {
    for (const rule of DESIGN_RULES) {
      const result = rule.check(el, project);
      if (result) {
        suggestions.push({ ...result, elementId: el.id, elementName: el.name, ruleId: rule.id, ruleName: rule.name });
      }
    }
  }
  return suggestions;
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════
export const uid = () => Math.random().toString(36).slice(2, 10);
export function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
export function darken(hex, amt) {
  const n = parseInt(hex.replace("#", ""), 16);
  const r = clamp(((n >> 16) & 255) - amt, 0, 255);
  const g = clamp(((n >> 8) & 255) - amt, 0, 255);
  const b = clamp((n & 255) - amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

// ═══════════════════════════════════════
// STORAGE (IndexedDB-backed for standalone)
// ═══════════════════════════════════════
const DB_NAME = "totibuilds";
const DB_VERSION = 1;
const STORE_NAME = "data";

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE_NAME); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function storageGet(key) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function storageSet(key, value) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    });
  } catch { return false; }
}
