import { useState, useRef, useEffect } from "react";
import { C, MATERIALS, clamp, darken } from "../utils/constants";

// ═══════════════════════════════════════
// ICONS
// ═══════════════════════════════════════
export const Icon = ({ type, size = 18, color = C.textDim }) => {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    plus: <svg {...p}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    folder: <svg {...p}><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
    image: <svg {...p}><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
    grid: <svg {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
    back: <svg {...p}><polyline points="15 18 9 12 15 6"/></svg>,
    trash: <svg {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>,
    edit: <svg {...p}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
    move: <svg {...p}><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>,
    ruler: <svg {...p}><path d="M21.3 15.3a2.4 2.4 0 010 3.4l-2.6 2.6a2.4 2.4 0 01-3.4 0L2.7 8.7a2.4 2.4 0 010-3.4l2.6-2.6a2.4 2.4 0 013.4 0z"/></svg>,
    layers: <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
    copy: <svg {...p}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>,
    cube: <svg {...p}><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
    dup: <svg {...p}><rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16V4a2 2 0 012-2h12"/></svg>,
    palette: <svg {...p}><circle cx="13.5" cy="6.5" r="1.5" fill={color} stroke="none"/><circle cx="17.5" cy="10.5" r="1.5" fill={color} stroke="none"/><circle cx="8.5" cy="7.5" r="1.5" fill={color} stroke="none"/><circle cx="6.5" cy="12" r="1.5" fill={color} stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.5-.67 1.5-1.5 0-.4-.13-.73-.38-1-.24-.26-.37-.6-.37-1 0-.83.67-1.5 1.5-1.5H16c3.31 0 6-2.69 6-6 0-5.52-4.48-9-10-9z"/></svg>,
    lightbulb: <svg {...p}><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z"/></svg>,
    zoomIn: <svg {...p}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>,
    save: <svg {...p}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>,
    distribute: <svg {...p}><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="7" x2="22" y2="7"/><line x1="2" y1="17" x2="22" y2="17"/></svg>,
    group: <svg {...p}><rect x="1" y="1" width="10" height="10" rx="1"/><rect x="13" y="1" width="10" height="10" rx="1"/><rect x="1" y="13" width="10" height="10" rx="1"/><rect x="13" y="13" width="10" height="10" rx="1"/></svg>,
    history: <svg {...p}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  };
  return icons[type] || null;
};

// ═══════════════════════════════════════
// BUTTON
// ═══════════════════════════════════════
export const Btn = ({ children, onClick, variant = "default", small, style, disabled, title }) => {
  const base = { display: "inline-flex", alignItems: "center", gap: 6, padding: small ? "5px 10px" : "8px 14px", fontSize: small ? 12 : 13, fontWeight: 500, border: "1px solid", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer", transition: "all 0.15s", fontFamily: "inherit", opacity: disabled ? 0.4 : 1 };
  const v = {
    default: { background: C.white, borderColor: C.border, color: C.text },
    accent: { background: C.accent, borderColor: C.accent, color: C.white, fontWeight: 600 },
    danger: { background: C.dangerBg, borderColor: C.danger, color: C.danger },
    ghost: { background: "transparent", borderColor: "transparent", color: C.textDim },
  };
  return <button onClick={disabled ? undefined : onClick} title={title} style={{ ...base, ...v[variant], ...style }}>{children}</button>;
};

// ═══════════════════════════════════════
// INPUTS
// ═══════════════════════════════════════
export const NumInput = ({ label, value, onChange, suffix, style, min = 0 }) => {
  const [t, setT] = useState(String(value));
  useEffect(() => { setT(String(value)); }, [value]);
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: C.textDim, fontWeight: 500, ...style }}>
      {label}
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <input type="text" inputMode="decimal" value={t} onFocus={e => e.target.select()}
          onChange={e => { const r = e.target.value; if (r === "" || r === "-") { setT(r); return; } if (/^-?\d*\.?\d*$/.test(r)) { setT(r); const n = parseFloat(r); if (!isNaN(n)) onChange(Math.max(min, n)); } }}
          onBlur={() => { const n = parseFloat(t); setT(String(isNaN(n) ? min : Math.max(min, n))); if (isNaN(n)) onChange(min); }}
          style={{ flex: 1, padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", minWidth: 0 }} />
        {suffix && <span style={{ fontSize: 11, color: C.textMuted }}>{suffix}</span>}
      </div>
    </label>
  );
};

export const TextInput = ({ label, value, onChange, placeholder, multiline }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: C.textDim, fontWeight: 500 }}>
    {label}
    {multiline
      ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={2} style={{ padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }} />
      : <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
    }
  </label>
);

export const Sel = ({ label, value, onChange, options }) => (
  <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: C.textDim, fontWeight: 500 }}>
    {label}
    <select value={value} onChange={e => onChange(e.target.value)} style={{ padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </label>
);

// ═══════════════════════════════════════
// MODAL
// ═══════════════════════════════════════
export const Modal = ({ children, onClose, title, width = 520 }) => (
  <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,48,40,0.4)", backdropFilter: "blur(4px)" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, width, maxWidth: "92vw", maxHeight: "88vh", overflow: "auto", padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: C.text, fontWeight: 700 }}>{title}</h3>
        <Btn variant="ghost" small onClick={onClose}>✕</Btn>
      </div>
      {children}
    </div>
  </div>
);

// ═══════════════════════════════════════
// MATERIAL PICKER
// ═══════════════════════════════════════
export const MaterialPicker = ({ label, materialGroup, shade, onChangeMaterial, onChangeShade }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>{label}</span>
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {Object.keys(MATERIALS).map(g => (
        <Btn key={g} small variant={materialGroup === g ? "accent" : "default"} onClick={() => { onChangeMaterial(g); onChangeShade(MATERIALS[g][0].hex); }}>{g}</Btn>
      ))}
    </div>
    {materialGroup && (
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 2 }}>
        {MATERIALS[materialGroup].map(s => (
          <div key={s.hex} onClick={() => onChangeShade(s.hex)} title={s.name}
            style={{ width: 28, height: 28, borderRadius: 6, background: s.hex, cursor: "pointer", border: shade === s.hex ? `2px solid ${C.accent}` : `2px solid ${C.border}`, boxShadow: shade === s.hex ? `0 0 0 2px ${C.accentGlow}` : "none", transition: "all 0.12s" }} />
        ))}
      </div>
    )}
  </div>
);

// ═══════════════════════════════════════
// ISOMETRIC ASSET THUMBNAIL
// ═══════════════════════════════════════
export const AssetThumb = ({ bodyColor, frontColor, w = 60, h = 40, d = 20, size = 80, legs, drawers = 0 }) => {
  const sc = size / Math.max(w + d * 0.5, h + d * 0.3 + (legs && legs !== "None" ? 12 : 0)) * 0.65;
  const sw = w * sc, sh = h * sc, sd = d * sc * 0.5;
  const legH = legs === "Tall legs" ? 14 : legs === "Short legs" || legs === "Hairpin legs" ? 8 : 0;
  const ox = (size - sw) / 2 - sd * 0.3;
  const oy = (size - sh - legH) / 2 + sd * 0.3;

  const drawerLines = [];
  if (drawers > 0) {
    const dh = sh / drawers;
    for (let i = 1; i < drawers; i++) {
      const ly = oy + sd + dh * i;
      drawerLines.push(<line key={i} x1={ox + 1} y1={ly} x2={ox + sw - 1} y2={ly} stroke="rgba(0,0,0,0.15)" strokeWidth="1" />);
    }
    // Handles
    for (let i = 0; i < drawers; i++) {
      const cy = oy + sd + dh * i + dh / 2;
      drawerLines.push(<line key={`h${i}`} x1={ox + sw * 0.35} y1={cy} x2={ox + sw * 0.65} y2={cy} stroke="rgba(0,0,0,0.2)" strokeWidth="1.5" strokeLinecap="round" />);
    }
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Legs */}
      {legH > 0 && <>
        <line x1={ox + 3} y1={oy + sd + sh} x2={ox + 3} y2={oy + sd + sh + legH} stroke={darken(bodyColor, 20)} strokeWidth="2" />
        <line x1={ox + sw - 3} y1={oy + sd + sh} x2={ox + sw - 3} y2={oy + sd + sh + legH} stroke={darken(bodyColor, 20)} strokeWidth="2" />
      </>}
      {/* Top face */}
      <polygon points={`${ox + sd},${oy} ${ox + sd + sw},${oy} ${ox + sw},${oy + sd} ${ox},${oy + sd}`} fill={darken(bodyColor, -15)} />
      {/* Front face */}
      <rect x={ox} y={oy + sd} width={sw} height={sh} fill={frontColor} rx="1" />
      {/* Right face */}
      <polygon points={`${ox + sw},${oy + sd} ${ox + sw + sd},${oy} ${ox + sw + sd},${oy + sh} ${ox + sw},${oy + sd + sh}`} fill={darken(bodyColor, 30)} />
      {/* Drawer lines */}
      {drawerLines}
    </svg>
  );
};
