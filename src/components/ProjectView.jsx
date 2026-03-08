import { useState, useRef, useEffect, useCallback } from "react";
import { C, clamp, uid, runDesignCheck } from "../utils/constants";
import { Btn, Icon, NumInput, Modal, AssetThumb } from "./UI";
import AssetModal from "./AssetModal";
import ThreeView from "./ThreeView";

export default function ProjectView({ project, assets, onUpdate }) {
  const canvasRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [resizing, setResizing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [multiSel, setMultiSel] = useState([]); // array of ids
  const [selBox, setSelBox] = useState(null); // {x1,y1,x2,y2} in wall coords
  const [showPicker, setShowPicker] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showMeas, setShowMeas] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [view, setView] = useState("2d");
  const [wallColor, setWallColor] = useState(project.wallColor || "#f5f0e6");

  // Zoom & pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  const contRef = useRef(null);
  const [cSize, setCSize] = useState({ w: 800, h: 500 });
  useEffect(() => { const el = contRef.current; if (!el) return; const o = new ResizeObserver(e => { const { width, height } = e[0].contentRect; setCSize({ w: width, h: height }); }); o.observe(el); return () => o.disconnect(); }, []);

  const pad = 60;
  const baseScale = Math.min((cSize.w - pad * 2) / project.wallWidth, (cSize.h - pad * 2) / project.wallHeight, 2.5);
  const scale = baseScale * zoom;
  const wpW = project.wallWidth * scale, wpH = project.wallHeight * scale;
  const wOX = (cSize.w - wpW) / 2 + panX;
  const wOY = (cSize.h - wpH) / 2 + panY;

  const toWC = (cx, cy) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - wOX) / scale, y: (cy - r.top - wOY) / scale };
  };

  const updEl = (id, u) => onUpdate(p => ({ ...p, elements: p.elements.map(el => el.id === id ? { ...el, ...u } : el) }));
  const delEl = id => { onUpdate(p => ({ ...p, elements: p.elements.filter(el => el.id !== id) })); if (selected === id) setSelected(null); setMultiSel(m => m.filter(x => x !== id)); };

  const addAsset = a => {
    onUpdate(p => ({ ...p, elements: [...p.elements, {
      id: uid(), assetId: a.id, name: a.name, category: a.category,
      width: a.width, height: a.height, depth: a.depth || 15,
      bodyColor: a.bodyColor, frontColor: a.frontColor || a.bodyColor,
      bodyMaterial: a.bodyMaterial, description: a.description,
      imageData: a.imageData, legStyle: a.legStyle, drawers: a.drawers || 0,
      doorStyle: a.doorStyle, doorConfig: a.doorConfig,
      frameType: a.frameType, matWidth: a.matWidth,
      x: (project.wallWidth - a.width) / 2, y: (project.wallHeight - a.height) / 2,
    }] }));
    setShowPicker(false);
  };

  // Wall color sync
  useEffect(() => { if (wallColor !== project.wallColor) onUpdate(p => ({ ...p, wallColor })); }, [wallColor]);

  // ─── Snap logic ───
  const SNAP = 5;
  const findSnaps = (el, nx, ny) => {
    const snaps = { x: null, y: null, guides: [] };
    const eCx = nx + el.width / 2, eCy = ny + el.height / 2;
    const eR = nx + el.width, eB = ny + el.height;
    // Wall center
    if (Math.abs(eCx - project.wallWidth / 2) < SNAP) { snaps.x = project.wallWidth / 2 - el.width / 2; snaps.guides.push({ t: "v", p: project.wallWidth / 2 }); }
    if (Math.abs(eCy - project.wallHeight / 2) < SNAP) { snaps.y = project.wallHeight / 2 - el.height / 2; snaps.guides.push({ t: "h", p: project.wallHeight / 2 }); }
    // Other elements
    for (const o of project.elements) {
      if (o.id === el.id) continue;
      const oR = o.x + o.width, oB = o.y + o.height, oCx = o.x + o.width / 2, oCy = o.y + o.height / 2;
      // Left edge to left/right edge
      if (Math.abs(nx - o.x) < SNAP) { snaps.x = o.x; snaps.guides.push({ t: "v", p: o.x }); }
      if (Math.abs(nx - oR) < SNAP) { snaps.x = oR; snaps.guides.push({ t: "v", p: oR }); }
      // Right edge to left/right edge
      if (Math.abs(eR - o.x) < SNAP) { snaps.x = o.x - el.width; snaps.guides.push({ t: "v", p: o.x }); }
      if (Math.abs(eR - oR) < SNAP) { snaps.x = oR - el.width; snaps.guides.push({ t: "v", p: oR }); }
      // Center to center
      if (Math.abs(eCx - oCx) < SNAP) { snaps.x = oCx - el.width / 2; snaps.guides.push({ t: "v", p: oCx }); }
      // Top/bottom
      if (Math.abs(ny - o.y) < SNAP) { snaps.y = o.y; snaps.guides.push({ t: "h", p: o.y }); }
      if (Math.abs(ny - oB) < SNAP) { snaps.y = oB; snaps.guides.push({ t: "h", p: oB }); }
      if (Math.abs(eB - o.y) < SNAP) { snaps.y = o.y - el.height; snaps.guides.push({ t: "h", p: o.y }); }
      if (Math.abs(eB - oB) < SNAP) { snaps.y = oB - el.height; snaps.guides.push({ t: "h", p: oB }); }
      if (Math.abs(eCy - oCy) < SNAP) { snaps.y = oCy - el.height / 2; snaps.guides.push({ t: "h", p: oCy }); }
    }
    return snaps;
  };

  const [snapGuides, setSnapGuides] = useState([]);

  // ─── Mouse handlers ───
  const onMD = (e, id) => {
    e.stopPropagation();
    if (e.shiftKey && id) {
      // Multi-select toggle
      setMultiSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      return;
    }
    setSelected(id);
    setMultiSel([]);
    const el = project.elements.find(x => x.id === id);
    if (!el) return;
    const wc = toWC(e.clientX, e.clientY);
    setDragging({ id, ox: wc.x - el.x, oy: wc.y - el.y });
  };

  const onRD = (e, id, edge) => { e.stopPropagation(); setSelected(id); setMultiSel([]); setResizing({ id, edge, sx: e.clientX, sy: e.clientY }); };

  const onCanvasDown = (e) => {
    if (view !== "2d") return;
    // Space key = pan mode
    if (e.button === 1 || isPanning) {
      panStart.current = { x: e.clientX, y: e.clientY, px: panX, py: panY };
      setIsPanning(true);
      return;
    }
    // Selection box
    const wc = toWC(e.clientX, e.clientY);
    if (wc.x >= 0 && wc.x <= project.wallWidth && wc.y >= 0 && wc.y <= project.wallHeight) {
      setSelBox({ x1: wc.x, y1: wc.y, x2: wc.x, y2: wc.y });
    }
    setSelected(null);
    setMultiSel([]);
  };

  useEffect(() => {
    const mv = e => {
      if (isPanning) {
        setPanX(panStart.current.px + e.clientX - panStart.current.x);
        setPanY(panStart.current.py + e.clientY - panStart.current.y);
        return;
      }
      if (selBox) {
        const wc = toWC(e.clientX, e.clientY);
        setSelBox(prev => prev ? { ...prev, x2: wc.x, y2: wc.y } : null);
        return;
      }
      if (dragging) {
        const wc = toWC(e.clientX, e.clientY);
        const el = project.elements.find(x => x.id === dragging.id);
        if (!el) return;
        let nx = clamp(wc.x - dragging.ox, 0, project.wallWidth - el.width);
        let ny = clamp(wc.y - dragging.oy, 0, project.wallHeight - el.height);
        if (showGuides) {
          const snaps = findSnaps(el, nx, ny);
          if (snaps.x !== null) nx = snaps.x;
          if (snaps.y !== null) ny = snaps.y;
          setSnapGuides(snaps.guides);
        }
        updEl(dragging.id, { x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 });
      }
      if (resizing) {
        const el = project.elements.find(x => x.id === resizing.id);
        if (!el) return;
        const dx = (e.clientX - resizing.sx) / scale, dy = (e.clientY - resizing.sy) / scale;
        let u = {};
        if (resizing.edge.includes("e")) u.width = clamp(el.width + dx, 5, project.wallWidth - el.x);
        if (resizing.edge.includes("s")) u.height = clamp(el.height + dy, 5, project.wallHeight - el.y);
        if (resizing.edge.includes("w")) { const nw = clamp(el.width - dx, 5, el.x + el.width); u.x = el.x + el.width - nw; u.width = nw; }
        if (resizing.edge.includes("n")) { const nh = clamp(el.height - dy, 5, el.y + el.height); u.y = el.y + el.height - nh; u.height = nh; }
        Object.keys(u).forEach(k => u[k] = Math.round(u[k] * 10) / 10);
        updEl(resizing.id, u); setResizing(p => ({ ...p, sx: e.clientX, sy: e.clientY }));
      }
    };
    const up = () => {
      if (selBox) {
        // Find elements inside selection box
        const x1 = Math.min(selBox.x1, selBox.x2), y1 = Math.min(selBox.y1, selBox.y2);
        const x2 = Math.max(selBox.x1, selBox.x2), y2 = Math.max(selBox.y1, selBox.y2);
        if (Math.abs(x2 - x1) > 3 && Math.abs(y2 - y1) > 3) {
          const inside = project.elements.filter(el =>
            el.x >= x1 - 2 && el.x + el.width <= x2 + 2 && el.y >= y1 - 2 && el.y + el.height <= y2 + 2
          ).map(el => el.id);
          setMultiSel(inside);
          if (inside.length === 1) setSelected(inside[0]);
        }
        setSelBox(null);
      }
      setDragging(null);
      setResizing(null);
      setIsPanning(false);
      setSnapGuides([]);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  });

  // Zoom with scroll
  const onWheel = useCallback(e => {
    if (view !== "2d") return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => clamp(z * delta, 0.3, 5));
  }, [view]);

  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Space key for pan mode
  useEffect(() => {
    const down = e => { if (e.code === "Space" && !e.repeat) { e.preventDefault(); setIsPanning(true); } };
    const up = e => { if (e.code === "Space") setIsPanning(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const sel = project.elements.find(x => x.id === selected);
  const allGuides = [...snapGuides];

  // Design suggestions
  const suggestions = showSuggestions ? runDesignCheck(project) : [];

  // Snapshots
  const saveSnapshot = () => {
    const name = `Snapshot ${(project.snapshots?.length || 0) + 1}`;
    onUpdate(p => ({ ...p, snapshots: [...(p.snapshots || []), { id: uid(), name, date: new Date().toISOString(), elements: JSON.parse(JSON.stringify(p.elements)) }] }));
  };
  const loadSnapshot = (snap) => {
    onUpdate(p => ({ ...p, elements: JSON.parse(JSON.stringify(snap.elements)) }));
    setShowSnapshots(false);
  };
  const deleteSnapshot = (snapId) => {
    onUpdate(p => ({ ...p, snapshots: (p.snapshots || []).filter(s => s.id !== snapId) }));
  };

  // Distribute evenly
  const distributeV = () => {
    if (multiSel.length < 2) return;
    const els = project.elements.filter(e => multiSel.includes(e.id)).sort((a, b) => a.y - b.y);
    const top = els[0].y, bottom = els[els.length - 1].y + els[els.length - 1].height;
    const totalH = els.reduce((s, e) => s + e.height, 0);
    const gap = (bottom - top - totalH) / (els.length - 1);
    let cy = top;
    els.forEach(el => { updEl(el.id, { y: Math.round(cy * 10) / 10 }); cy += el.height + gap; });
  };

  const distributeH = () => {
    if (multiSel.length < 2) return;
    const els = project.elements.filter(e => multiSel.includes(e.id)).sort((a, b) => a.x - b.x);
    const left = els[0].x, right = els[els.length - 1].x + els[els.length - 1].width;
    const totalW = els.reduce((s, e) => s + e.width, 0);
    const gap = (right - left - totalW) / (els.length - 1);
    let cx = left;
    els.forEach(el => { updEl(el.id, { x: Math.round(cx * 10) / 10 }); cx += el.width + gap; });
  };

  // Object-to-object distances for selected element
  const nearDists = [];
  if (sel && showMeas) {
    for (const o of project.elements) {
      if (o.id === sel.id) continue;
      // Below
      if (o.y > sel.y + sel.height && Math.abs((o.x + o.width / 2) - (sel.x + sel.width / 2)) < Math.max(sel.width, o.width)) {
        const gap = o.y - (sel.y + sel.height);
        if (gap < 100) nearDists.push({ dir: "below", gap: Math.round(gap), x: sel.x + sel.width / 2, y1: sel.y + sel.height, y2: o.y });
      }
      // Above
      if (o.y + o.height < sel.y && Math.abs((o.x + o.width / 2) - (sel.x + sel.width / 2)) < Math.max(sel.width, o.width)) {
        const gap = sel.y - (o.y + o.height);
        if (gap < 100) nearDists.push({ dir: "above", gap: Math.round(gap), x: sel.x + sel.width / 2, y1: o.y + o.height, y2: sel.y });
      }
    }
  }

  const mono = "'JetBrains Mono', monospace";

  return (
    <div style={{ display: "flex", height: "calc(100vh - 45px)" }}>
      {/* Sidebar */}
      <div style={{ width: 256, minWidth: 256, background: C.surface, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", overflow: "auto" }}>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
          <h3 style={{ fontSize: 14, fontWeight: 600 }}>{project.name}</h3>
          <p style={{ fontSize: 12, color: C.textDim }}>{project.wallWidth}×{project.wallHeight} cm</p>
        </div>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
          <Btn variant="accent" onClick={() => setShowPicker(true)} style={{ width: "100%" }}><Icon type="plus" size={14} color={C.white} /> Place Asset</Btn>
        </div>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", gap: 5 }}>
          <Btn small variant={view === "2d" ? "accent" : "default"} onClick={() => setView("2d")} style={{ flex: 1 }}><Icon type="ruler" size={13} color={view === "2d" ? C.white : C.textDim} /> 2D</Btn>
          <Btn small variant={view === "3d" ? "accent" : "default"} onClick={() => setView("3d")} style={{ flex: 1 }}><Icon type="cube" size={13} color={view === "3d" ? C.white : C.textDim} /> 3D</Btn>
        </div>
        <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon type="palette" size={14} color={C.textDim} /><span style={{ fontSize: 11, color: C.textDim }}>Wall</span>
          <input type="color" value={wallColor} onChange={e => setWallColor(e.target.value)} style={{ width: 24, height: 20, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", padding: 0, marginLeft: "auto" }} />
        </div>

        {view === "2d" && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, cursor: "pointer" }}><input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} /> Snap & Guides</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, cursor: "pointer" }}><input type="checkbox" checked={showMeas} onChange={e => setShowMeas(e.target.checked)} /> Measurements</label>
          <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>Zoom: {Math.round(zoom * 100)}% · Space+drag to pan</div>
        </div>}

        {/* Multi-select actions */}
        {multiSel.length > 1 && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 4 }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 600 }}>{multiSel.length} selected</span>
          <div style={{ display: "flex", gap: 4 }}>
            <Btn small onClick={distributeH} title="Distribute horizontally"><Icon type="distribute" size={12} /> H</Btn>
            <Btn small onClick={distributeV} title="Distribute vertically"><Icon type="distribute" size={12} /> V</Btn>
          </div>
        </div>}

        {sel && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
          <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 5 }}><Icon type="move" size={14} color={C.accent} /> {sel.name}</h4>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <NumInput label="X" value={sel.x} onChange={v => updEl(selected, { x: clamp(v, 0, project.wallWidth - sel.width) })} suffix="cm" />
            <NumInput label="Y" value={sel.y} onChange={v => updEl(selected, { y: clamp(v, 0, project.wallHeight - sel.height) })} suffix="cm" />
            <NumInput label="W" value={sel.width} onChange={v => updEl(selected, { width: clamp(v, 5, project.wallWidth - sel.x) })} suffix="cm" />
            <NumInput label="H" value={sel.height} onChange={v => updEl(selected, { height: clamp(v, 5, project.wallHeight - sel.y) })} suffix="cm" />
          </div>
          <div style={{ marginTop: 6, fontSize: 11, color: C.textMuted, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
            <span>↑ {Math.round(sel.y)}</span><span>↓ {Math.round(project.wallHeight - sel.y - sel.height)}</span>
            <span>← {Math.round(sel.x)}</span><span>→ {Math.round(project.wallWidth - sel.x - sel.width)}</span>
          </div>
          <Btn variant="danger" small onClick={() => delEl(selected)} style={{ marginTop: 8, width: "100%" }}><Icon type="trash" size={12} /> Remove</Btn>
        </div>}

        <div style={{ padding: 14, flex: 1, overflow: "auto" }}>
          <h4 style={{ fontSize: 11, fontWeight: 600, color: C.textMuted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Elements ({project.elements.length})</h4>
          {project.elements.map(el => (
            <div key={el.id} onClick={() => { setSelected(el.id); setMultiSel([]); }} style={{ padding: "6px 8px", borderRadius: 6, marginBottom: 3, cursor: "pointer", background: (selected === el.id || multiSel.includes(el.id)) ? C.accentGlow : "transparent", border: `1px solid ${(selected === el.id || multiSel.includes(el.id)) ? C.accent : "transparent"}`, fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: el.frontColor || el.bodyColor || C.accent }} />
                <span style={{ fontWeight: selected === el.id ? 600 : 400 }}>{el.name}</span>
              </div>
              <span style={{ color: C.textMuted, fontSize: 10, fontFamily: mono }}>{el.width}×{el.height}</span>
            </div>
          ))}
        </div>

        {/* Bottom toolbar */}
        <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Btn small onClick={() => setShowExport(true)} title="Hanging Plan"><Icon type="ruler" size={13} /></Btn>
          <Btn small onClick={() => setShowSuggestions(!showSuggestions)} title="Design Tips" style={showSuggestions ? { borderColor: C.accent, background: C.accentGlow } : {}}>
            <Icon type="lightbulb" size={13} color={showSuggestions ? C.accent : C.textDim} />
            {runDesignCheck(project).length > 0 && <span style={{ background: C.accent, color: C.white, fontSize: 9, padding: "1px 4px", borderRadius: 8, fontWeight: 700 }}>{runDesignCheck(project).length}</span>}
          </Btn>
          <Btn small onClick={() => setShowSnapshots(true)} title="Version History"><Icon type="history" size={13} /></Btn>
          <Btn small onClick={saveSnapshot} title="Save Snapshot"><Icon type="save" size={13} /></Btn>
        </div>
      </div>

      {/* Canvas */}
      <div ref={contRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg, cursor: isPanning ? "grab" : "default" }} onMouseDown={onCanvasDown}>
        {view === "3d" ? <ThreeView project={{ ...project, wallColor }} selected={selected} /> : (
          <div ref={canvasRef} style={{ width: "100%", height: "100%", position: "relative" }}>
            <div style={{ position: "absolute", left: wOX, top: wOY, width: wpW, height: wpH, background: wallColor, border: `1px solid ${C.border}`, boxShadow: "0 2px 24px rgba(0,0,0,0.06)" }}>
              <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, opacity: 0.04 }}>
                <defs><pattern id="g" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse"><path d={`M ${50 * scale} 0 L 0 0 0 ${50 * scale}`} fill="none" stroke="#000" strokeWidth="0.5" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#g)" />
              </svg>

              {/* Snap guides */}
              {allGuides.map((g, i) => <div key={i} style={{ position: "absolute", ...(g.t === "v" ? { left: g.p * scale, top: 0, width: 1, height: "100%" } : { top: g.p * scale, left: 0, height: 1, width: "100%" }), background: C.accent, opacity: 0.45 }} />)}

              {/* Elements */}
              {project.elements.map(el => {
                const isSel = selected === el.id || multiSel.includes(el.id);
                return (
                  <div key={el.id} onMouseDown={e => onMD(e, el.id)} onClick={e => e.stopPropagation()}
                    style={{ position: "absolute", left: el.x * scale, top: el.y * scale, width: el.width * scale, height: el.height * scale, border: `${isSel ? 2 : 1}px solid ${isSel ? C.accent : "rgba(0,0,0,0.12)"}`, borderRadius: 3, cursor: dragging?.id === el.id ? "grabbing" : "grab", background: el.frontColor || el.bodyColor || C.accent, overflow: "hidden", zIndex: isSel ? 10 : 1, boxShadow: isSel ? `0 0 0 2px ${C.accent}` : "0 1px 3px rgba(0,0,0,0.08)", transition: dragging ? "none" : "box-shadow 0.12s" }}>
                    {el.imageData && <img src={el.imageData} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />}

                    {isSel && !dragging && !multiSel.length && ["e", "w", "s", "n", "se", "sw", "ne", "nw"].map(edge => {
                      const ic = edge.length === 2, sz = ic ? 8 : 6;
                      const s = { position: "absolute", width: sz, height: sz, background: C.accent, borderRadius: ic ? 2 : 1, zIndex: 20, border: "1px solid white" };
                      if (edge.includes("e")) { s.right = -sz / 2; s.cursor = "ew-resize"; }
                      if (edge.includes("w")) { s.left = -sz / 2; s.cursor = "ew-resize"; }
                      if (edge.includes("s")) { s.bottom = -sz / 2; s.cursor = "ns-resize"; }
                      if (edge.includes("n")) { s.top = -sz / 2; s.cursor = "ns-resize"; }
                      if (edge === "e" || edge === "w") { s.top = "50%"; s.transform = "translateY(-50%)"; }
                      if (edge === "n" || edge === "s") { s.left = "50%"; s.transform = "translateX(-50%)"; }
                      if (edge === "se") s.cursor = "nwse-resize"; if (edge === "sw") s.cursor = "nesw-resize"; if (edge === "ne") s.cursor = "nesw-resize"; if (edge === "nw") s.cursor = "nwse-resize";
                      return <div key={edge} onMouseDown={e => onRD(e, el.id, edge)} style={s} />;
                    })}

                    {isSel && showMeas && !multiSel.length && <>
                      <div style={{ position: "absolute", bottom: -17, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accent, fontFamily: mono, whiteSpace: "nowrap", background: wallColor, padding: "0 3px", borderRadius: 3 }}>{el.width}</div>
                      <div style={{ position: "absolute", right: -30, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accent, fontFamily: mono, whiteSpace: "nowrap", background: wallColor, padding: "0 3px", borderRadius: 3 }}>{el.height}</div>
                    </>}
                  </div>
                );
              })}

              {/* Wall edge distances */}
              {sel && showMeas && !multiSel.length && <>
                {sel.x > 5 && <div style={{ position: "absolute", left: 0, top: (sel.y + sel.height / 2) * scale, width: sel.x * scale, borderTop: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(sel.x)}</span></div>}
                {(project.wallWidth - sel.x - sel.width) > 5 && <div style={{ position: "absolute", left: (sel.x + sel.width) * scale, top: (sel.y + sel.height / 2) * scale, width: (project.wallWidth - sel.x - sel.width) * scale, borderTop: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(project.wallWidth - sel.x - sel.width)}</span></div>}
                {sel.y > 5 && <div style={{ position: "absolute", top: 0, left: (sel.x + sel.width / 2) * scale, height: sel.y * scale, borderLeft: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(sel.y)}</span></div>}
                {(project.wallHeight - sel.y - sel.height) > 5 && <div style={{ position: "absolute", top: (sel.y + sel.height) * scale, left: (sel.x + sel.width / 2) * scale, height: (project.wallHeight - sel.y - sel.height) * scale, borderLeft: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(project.wallHeight - sel.y - sel.height)}</span></div>}
              </>}

              {/* Object-to-object distances */}
              {nearDists.map((nd, i) => (
                <div key={i} style={{ position: "absolute", left: nd.x * scale - 0.5, top: nd.y1 * scale, height: (nd.y2 - nd.y1) * scale, borderLeft: `1px dotted ${C.danger}` }}>
                  <span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.danger, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{nd.gap}</span>
                </div>
              ))}

              {/* Selection box */}
              {selBox && <div style={{ position: "absolute", left: Math.min(selBox.x1, selBox.x2) * scale, top: Math.min(selBox.y1, selBox.y2) * scale, width: Math.abs(selBox.x2 - selBox.x1) * scale, height: Math.abs(selBox.y2 - selBox.y1) * scale, border: `1px dashed ${C.accent}`, background: C.accentGlow, pointerEvents: "none" }} />}
            </div>

            <div style={{ position: "absolute", left: wOX, top: wOY + wpH + 6, width: wpW, textAlign: "center", fontSize: 11, fontFamily: mono, color: C.textMuted }}>{project.wallWidth} cm</div>
            <div style={{ position: "absolute", left: wOX - 8, top: wOY, height: wpH, display: "flex", alignItems: "center", fontSize: 11, fontFamily: mono, color: C.textMuted, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{project.wallHeight} cm</div>
          </div>
        )}

        {/* Design suggestions panel */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", top: 12, right: 12, width: 280, maxHeight: "60vh", overflow: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}><Icon type="lightbulb" size={15} color={C.accent} /> Design Tips</h4>
            {suggestions.map((s, i) => (
              <div key={i} style={{ padding: 8, background: s.severity === "warning" ? "rgba(184,136,75,0.08)" : C.surfaceAlt, borderRadius: 8, marginBottom: 6, fontSize: 11, color: C.textDim }}>
                <span style={{ fontWeight: 600, color: C.text }}>{s.elementName}</span>
                <p style={{ marginTop: 2 }}>{s.message}</p>
                {s.fix && <Btn small variant="ghost" style={{ marginTop: 4 }} onClick={() => updEl(s.elementId, s.fix)}>Auto-fix</Btn>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset Picker */}
      {showPicker && <Modal title="Place an Asset" onClose={() => setShowPicker(false)} width={580}>
        <Btn variant="ghost" onClick={() => { setShowPicker(false); setShowNewAsset(true); }} style={{ marginBottom: 12 }}><Icon type="plus" size={14} /> Create New Asset</Btn>
        {assets.length === 0 ? <p style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No assets yet.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {assets.map(a => (
              <div key={a.id} onClick={() => addAsset(a)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ height: 65, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <AssetThumb bodyColor={a.bodyColor || "#8b6b3d"} frontColor={a.frontColor || a.bodyColor || "#8b6b3d"} w={a.width} h={a.height} d={a.depth} size={55} legs={a.legStyle} drawers={a.drawers || 0} />
                </div>
                <div style={{ padding: 6 }}><p style={{ fontSize: 11, fontWeight: 600 }}>{a.name}</p><p style={{ fontSize: 10, color: C.textDim }}>{a.width}×{a.height}</p></div>
              </div>
            ))}
          </div>
        )}
      </Modal>}

      {/* Inline asset creation */}
      {showNewAsset && <AssetModal asset={null} onClose={() => setShowNewAsset(false)} onSave={a => {
        // Add to library AND place on wall
        addAsset(a);
        setShowNewAsset(false);
      }} />}

      {/* Export */}
      {showExport && <Modal title="Hanging Plan" onClose={() => setShowExport(false)} width={520}>
        {project.elements.length === 0 ? <p style={{ color: C.textMuted }}>No elements yet.</p> : <div>
          <p style={{ fontSize: 12, color: C.textDim, marginBottom: 14 }}>Wall: {project.wallWidth}×{project.wallHeight} cm</p>
          {project.elements.map((el, i) => { const fl = Math.round(el.x * 10) / 10, fr = Math.round((project.wallWidth - el.x - el.width) * 10) / 10, ft = Math.round(el.y * 10) / 10, fb = Math.round((project.wallHeight - el.y - el.height) * 10) / 10; return (
            <div key={i} style={{ padding: 10, background: C.surfaceAlt, borderRadius: 8, marginBottom: 6, border: `1px solid ${C.border}`, fontFamily: mono, fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: C.accent, fontFamily: "'DM Sans'", fontSize: 13, marginBottom: 4 }}>{el.name}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, color: C.textDim }}>
                <span>← {fl} cm</span><span>→ {fr} cm</span><span>↑ {ft} cm</span><span>↓ {fb} cm</span>
              </div>
            </div>); })}
          <Btn variant="ghost" onClick={() => { const t = project.elements.map(el => `${el.name}: ←${Math.round(el.x)}cm →${Math.round(project.wallWidth - el.x - el.width)}cm ↑${Math.round(el.y)}cm ↓${Math.round(project.wallHeight - el.y - el.height)}cm`).join("\n"); navigator.clipboard?.writeText(t); }} style={{ marginTop: 10 }}><Icon type="copy" size={13} /> Copy</Btn>
        </div>}
      </Modal>}

      {/* Snapshots */}
      {showSnapshots && <Modal title="Version History" onClose={() => setShowSnapshots(false)} width={440}>
        {(!project.snapshots || project.snapshots.length === 0) ? <p style={{ color: C.textMuted }}>No snapshots saved yet. Click the save icon to capture your current layout.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {project.snapshots.map(s => (
              <div key={s.id} style={{ padding: 10, background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</p>
                  <p style={{ fontSize: 11, color: C.textMuted }}>{new Date(s.date).toLocaleString()} · {s.elements.length} elements</p>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <Btn small onClick={() => loadSnapshot(s)}>Load</Btn>
                  <Btn small variant="ghost" onClick={() => deleteSnapshot(s.id)}><Icon type="trash" size={12} color={C.danger} /></Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>}
    </div>
  );
}
