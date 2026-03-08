import { useState, useRef, useEffect, useCallback } from "react";
import { C, clamp, uid, runDesignCheck } from "../utils/constants";
import { Btn, Icon, NumInput, Modal, AssetThumb } from "./UI";
import AssetModal from "./AssetModal";
import ThreeView from "./ThreeView";

export default function ProjectView({ project, assets, onUpdate, onAddAsset }) {
  const canvasRef = useRef(null);
  const contRef = useRef(null);
  const [dragging, setDragging] = useState(null); // { ids:[], ox, oy, startPositions }
  const [resizing, setResizing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  const [selBox, setSelBox] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [showMeas, setShowMeas] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [view, setView] = useState("2d");
  const [wallColor, setWallColor] = useState(project.wallColor || "#f5f0e6");
  const [snapGuides, setSnapGuides] = useState([]);

  // Zoom & pan
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Undo / Redo
  const [history, setHistory] = useState([]);
  const [histIdx, setHistIdx] = useState(-1);
  const ignoreNextUpdate = useRef(false);

  const pushHistory = useCallback((elements) => {
    setHistory(prev => {
      const newH = prev.slice(0, histIdx + 1);
      newH.push(JSON.stringify(elements));
      if (newH.length > 40) newH.shift();
      return newH;
    });
    setHistIdx(prev => Math.min(prev + 1, 39));
  }, [histIdx]);

  // Initialize history with current state
  useEffect(() => {
    if (history.length === 0 && project.elements) {
      setHistory([JSON.stringify(project.elements)]);
      setHistIdx(0);
    }
  }, []);

  const undo = () => {
    if (histIdx <= 0) return;
    const newIdx = histIdx - 1;
    const els = JSON.parse(history[newIdx]);
    ignoreNextUpdate.current = true;
    onUpdate(p => ({ ...p, elements: els }));
    setHistIdx(newIdx);
  };

  const redo = () => {
    if (histIdx >= history.length - 1) return;
    const newIdx = histIdx + 1;
    const els = JSON.parse(history[newIdx]);
    ignoreNextUpdate.current = true;
    onUpdate(p => ({ ...p, elements: els }));
    setHistIdx(newIdx);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") { e.preventDefault(); redo(); }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selected && !e.target.closest("input, textarea, select")) { e.preventDefault(); delEl(selected); }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [histIdx, history, selected]);

  // Groups
  const groups = project.groups || [];
  const getGroup = (elId) => groups.find(g => g.ids.includes(elId));
  const getEffectiveSelection = (elId) => {
    const g = getGroup(elId);
    return g ? g.ids : [elId];
  };

  const createGroup = () => {
    if (multiSel.length < 2) return;
    const gId = uid();
    onUpdate(p => ({ ...p, groups: [...(p.groups || []), { id: gId, ids: [...multiSel] }] }));
  };

  const ungroup = (groupId) => {
    onUpdate(p => ({ ...p, groups: (p.groups || []).filter(g => g.id !== groupId) }));
  };

  // Container size
  const [cSize, setCSize] = useState({ w: 800, h: 500 });
  useEffect(() => {
    const el = contRef.current; if (!el) return;
    const o = new ResizeObserver(e => { const { width, height } = e[0].contentRect; setCSize({ w: width, h: height }); });
    o.observe(el); return () => o.disconnect();
  }, []);

  const pad = 60;
  const baseScale = Math.min((cSize.w - pad * 2) / project.wallWidth, (cSize.h - pad * 2) / project.wallHeight, 2.5);
  const scale = baseScale * zoom;
  const wpW = project.wallWidth * scale, wpH = project.wallHeight * scale;
  const wOX = (cSize.w - wpW) / 2 + panX;
  const wOY = (cSize.h - wpH) / 2 + panY;

  const toWC = useCallback((cx, cy) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (cx - r.left - wOX) / scale, y: (cy - r.top - wOY) / scale };
  }, [wOX, wOY, scale]);

  const updEl = (id, u) => {
    onUpdate(p => {
      const newEls = p.elements.map(el => el.id === id ? { ...el, ...u } : el);
      if (!ignoreNextUpdate.current) pushHistory(newEls);
      else ignoreNextUpdate.current = false;
      return { ...p, elements: newEls };
    });
  };

  const updMultiEl = (updates) => {
    // updates: [{id, changes}]
    onUpdate(p => {
      const newEls = p.elements.map(el => {
        const u = updates.find(x => x.id === el.id);
        return u ? { ...el, ...u.changes } : el;
      });
      pushHistory(newEls);
      return { ...p, elements: newEls };
    });
  };

  const delEl = id => {
    onUpdate(p => {
      const newEls = p.elements.filter(el => el.id !== id);
      pushHistory(newEls);
      return { ...p, elements: newEls, groups: (p.groups || []).map(g => ({ ...g, ids: g.ids.filter(x => x !== id) })).filter(g => g.ids.length > 1) };
    });
    if (selected === id) setSelected(null);
    setMultiSel(m => m.filter(x => x !== id));
  };

  const addAsset = a => {
    onUpdate(p => {
      const newEl = {
        id: uid(), assetId: a.id, name: a.name, category: a.category,
        width: a.width, height: a.height, depth: a.depth || 15,
        bodyColor: a.bodyColor, frontColor: a.frontColor || a.bodyColor,
        bodyMaterial: a.bodyMaterial, description: a.description,
        imageData: a.imageData, legStyle: a.legStyle, drawers: a.drawers || 0,
        doorStyle: a.doorStyle, doorConfig: a.doorConfig,
        frameType: a.frameType, matWidth: a.matWidth,
        x: (project.wallWidth - a.width) / 2, y: (project.wallHeight - a.height) / 2,
      };
      const newEls = [...p.elements, newEl];
      pushHistory(newEls);
      return { ...p, elements: newEls };
    });
    setShowPicker(false);
  };

  // Wall color sync
  useEffect(() => { if (wallColor !== project.wallColor) onUpdate(p => ({ ...p, wallColor })); }, [wallColor]);

  // ─── Snap logic ───
  const SNAP_THRESH = 6;
  const findSnaps = (el, nx, ny) => {
    const snaps = { x: null, y: null, guides: [] };
    const eCx = nx + el.width / 2, eCy = ny + el.height / 2;
    const eR = nx + el.width, eB = ny + el.height;

    // Wall center
    if (Math.abs(eCx - project.wallWidth / 2) < SNAP_THRESH) { snaps.x = project.wallWidth / 2 - el.width / 2; snaps.guides.push({ t: "v", p: project.wallWidth / 2 }); }
    if (Math.abs(eCy - project.wallHeight / 2) < SNAP_THRESH) { snaps.y = project.wallHeight / 2 - el.height / 2; snaps.guides.push({ t: "h", p: project.wallHeight / 2 }); }

    for (const o of project.elements) {
      if (o.id === el.id || (dragging && dragging.ids.includes(o.id))) continue;
      const oR = o.x + o.width, oB = o.y + o.height, oCx = o.x + o.width / 2, oCy = o.y + o.height / 2;
      // Edge snaps
      if (snaps.x === null) {
        if (Math.abs(nx - o.x) < SNAP_THRESH) { snaps.x = o.x; snaps.guides.push({ t: "v", p: o.x }); }
        else if (Math.abs(nx - oR) < SNAP_THRESH) { snaps.x = oR; snaps.guides.push({ t: "v", p: oR }); }
        else if (Math.abs(eR - o.x) < SNAP_THRESH) { snaps.x = o.x - el.width; snaps.guides.push({ t: "v", p: o.x }); }
        else if (Math.abs(eR - oR) < SNAP_THRESH) { snaps.x = oR - el.width; snaps.guides.push({ t: "v", p: oR }); }
        else if (Math.abs(eCx - oCx) < SNAP_THRESH) { snaps.x = oCx - el.width / 2; snaps.guides.push({ t: "v", p: oCx }); }
      }
      if (snaps.y === null) {
        if (Math.abs(ny - o.y) < SNAP_THRESH) { snaps.y = o.y; snaps.guides.push({ t: "h", p: o.y }); }
        else if (Math.abs(ny - oB) < SNAP_THRESH) { snaps.y = oB; snaps.guides.push({ t: "h", p: oB }); }
        else if (Math.abs(eB - o.y) < SNAP_THRESH) { snaps.y = o.y - el.height; snaps.guides.push({ t: "h", p: o.y }); }
        else if (Math.abs(eB - oB) < SNAP_THRESH) { snaps.y = oB - el.height; snaps.guides.push({ t: "h", p: oB }); }
        else if (Math.abs(eCy - oCy) < SNAP_THRESH) { snaps.y = oCy - el.height / 2; snaps.guides.push({ t: "h", p: oCy }); }
      }
    }
    return snaps;
  };

  // ─── Mouse handlers ───
  const onElDown = (e, id) => {
    e.stopPropagation();
    if (e.shiftKey) {
      // Toggle multi-select
      setMultiSel(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
      if (!multiSel.includes(id)) setSelected(id);
      return;
    }

    // Determine what we're moving: the element, its group, or current multi-selection
    let moveIds = [id];
    const g = getGroup(id);
    if (g) moveIds = g.ids;
    if (multiSel.length > 0 && multiSel.includes(id)) moveIds = multiSel;

    setSelected(id);
    if (moveIds.length <= 1) setMultiSel([]);

    const wc = toWC(e.clientX, e.clientY);
    const el = project.elements.find(x => x.id === id);
    if (!el) return;

    const startPositions = {};
    moveIds.forEach(mid => {
      const mel = project.elements.find(x => x.id === mid);
      if (mel) startPositions[mid] = { x: mel.x, y: mel.y };
    });

    setDragging({ ids: moveIds, ox: wc.x - el.x, oy: wc.y - el.y, startPositions });
  };

  const onResizeDown = (e, id, edge) => {
    e.stopPropagation();
    setSelected(id);
    setMultiSel([]);
    setResizing({ id, edge, sx: e.clientX, sy: e.clientY });
  };

  const onCanvasDown = (e) => {
    if (view !== "2d") return;
    const wc = toWC(e.clientX, e.clientY);
    if (wc.x >= 0 && wc.x <= project.wallWidth && wc.y >= 0 && wc.y <= project.wallHeight) {
      setSelBox({ x1: wc.x, y1: wc.y, x2: wc.x, y2: wc.y });
    }
    setSelected(null);
    setMultiSel([]);
  };

  // Wheel: pinch/ctrl+scroll = zoom, regular two-finger = pan
  const onWheel = useCallback(e => {
    if (view !== "2d") return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Pinch zoom
      const delta = e.deltaY > 0 ? 0.92 : 1.08;
      setZoom(z => clamp(z * delta, 0.3, 5));
    } else {
      // Two-finger pan
      setPanX(px => px - e.deltaX);
      setPanY(py => py - e.deltaY);
    }
  }, [view]);

  useEffect(() => {
    const el = contRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [onWheel]);

  // Mouse move/up
  useEffect(() => {
    const mv = e => {
      if (selBox) {
        const wc = toWC(e.clientX, e.clientY);
        setSelBox(prev => prev ? { ...prev, x2: wc.x, y2: wc.y } : null);
        return;
      }
      if (dragging) {
        const wc = toWC(e.clientX, e.clientY);
        const primaryEl = project.elements.find(x => x.id === dragging.ids[0]);
        if (!primaryEl) return;
        const primaryStart = dragging.startPositions[dragging.ids[0]];
        let dx = (wc.x - dragging.ox) - primaryStart.x;
        let dy = (wc.y - dragging.oy) - primaryStart.y;

        // Snap based on primary element
        if (showGuides && dragging.ids.length === 1) {
          const nx = primaryStart.x + dx, ny = primaryStart.y + dy;
          const snaps = findSnaps(primaryEl, nx, ny);
          if (snaps.x !== null) dx = snaps.x - primaryStart.x;
          if (snaps.y !== null) dy = snaps.y - primaryStart.y;
          setSnapGuides(snaps.guides);
        } else {
          setSnapGuides([]);
        }

        const updates = dragging.ids.map(mid => {
          const sp = dragging.startPositions[mid];
          const mel = project.elements.find(x => x.id === mid);
          if (!sp || !mel) return null;
          return {
            id: mid,
            changes: {
              x: Math.round(clamp(sp.x + dx, 0, project.wallWidth - mel.width) * 10) / 10,
              y: Math.round(clamp(sp.y + dy, 0, project.wallHeight - mel.height) * 10) / 10,
            }
          };
        }).filter(Boolean);

        // Direct update without individual history pushes
        onUpdate(p => ({ ...p, elements: p.elements.map(el => {
          const u = updates.find(x => x.id === el.id);
          return u ? { ...el, ...u.changes } : el;
        })}));
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
        onUpdate(p => ({ ...p, elements: p.elements.map(x => x.id === resizing.id ? { ...x, ...u } : x) }));
        setResizing(p => ({ ...p, sx: e.clientX, sy: e.clientY }));
      }
    };
    const up = () => {
      if (dragging) {
        // Push history after drag ends
        pushHistory(project.elements);
      }
      if (resizing) pushHistory(project.elements);
      if (selBox) {
        const x1 = Math.min(selBox.x1, selBox.x2), y1 = Math.min(selBox.y1, selBox.y2);
        const x2 = Math.max(selBox.x1, selBox.x2), y2 = Math.max(selBox.y1, selBox.y2);
        if (Math.abs(x2 - x1) > 2 || Math.abs(y2 - y1) > 2) {
          // Select elements that TOUCH the selection box (not fully enclosed)
          const inside = project.elements.filter(el => {
            const eR = el.x + el.width, eB = el.y + el.height;
            return !(el.x > x2 || eR < x1 || el.y > y2 || eB < y1);
          }).map(el => el.id);
          setMultiSel(inside);
          if (inside.length === 1) setSelected(inside[0]);
        }
        setSelBox(null);
      }
      setDragging(null);
      setResizing(null);
      setSnapGuides([]);
    };
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  });

  const sel = project.elements.find(x => x.id === selected);

  // Distribute
  const distributeV = () => {
    const ids = multiSel.length > 1 ? multiSel : [];
    if (ids.length < 2) return;
    const els = project.elements.filter(e => ids.includes(e.id)).sort((a, b) => a.y - b.y);
    const top = els[0].y;
    const bottom = els[els.length - 1].y + els[els.length - 1].height;
    const totalH = els.reduce((s, e) => s + e.height, 0);
    const gap = (bottom - top - totalH) / (els.length - 1);
    let cy = top;
    const updates = els.map(el => { const u = { id: el.id, changes: { y: Math.round(cy * 10) / 10 } }; cy += el.height + gap; return u; });
    updMultiEl(updates);
  };

  const distributeH = () => {
    const ids = multiSel.length > 1 ? multiSel : [];
    if (ids.length < 2) return;
    const els = project.elements.filter(e => ids.includes(e.id)).sort((a, b) => a.x - b.x);
    const left = els[0].x;
    const right = els[els.length - 1].x + els[els.length - 1].width;
    const totalW = els.reduce((s, e) => s + e.width, 0);
    const gap = (right - left - totalW) / (els.length - 1);
    let cx = left;
    const updates = els.map(el => { const u = { id: el.id, changes: { x: Math.round(cx * 10) / 10 } }; cx += el.width + gap; return u; });
    updMultiEl(updates);
  };

  const distributeAcrossWallH = () => {
    const ids = multiSel.length > 1 ? multiSel : [];
    if (ids.length < 1) return;
    const els = project.elements.filter(e => ids.includes(e.id)).sort((a, b) => a.x - b.x);
    const totalW = els.reduce((s, e) => s + e.width, 0);
    const gap = (project.wallWidth - totalW) / (els.length + 1);
    let cx = gap;
    const updates = els.map(el => { const u = { id: el.id, changes: { x: Math.round(cx * 10) / 10 } }; cx += el.width + gap; return u; });
    updMultiEl(updates);
  };

  // Snapshots
  const saveSnapshot = () => {
    const name = `Snapshot ${(project.snapshots?.length || 0) + 1}`;
    onUpdate(p => ({ ...p, snapshots: [...(p.snapshots || []), { id: uid(), name, date: new Date().toISOString(), elements: JSON.parse(JSON.stringify(p.elements)) }] }));
  };
  const loadSnapshot = (snap) => { onUpdate(p => ({ ...p, elements: JSON.parse(JSON.stringify(snap.elements)) })); pushHistory(snap.elements); setShowSnapshots(false); };
  const deleteSnapshot = (snapId) => { onUpdate(p => ({ ...p, snapshots: (p.snapshots || []).filter(s => s.id !== snapId) })); };

  // Design suggestions
  const suggestions = showSuggestions ? runDesignCheck(project) : [];

  // Object-to-object distances
  const nearDists = [];
  if (sel && showMeas && multiSel.length === 0) {
    for (const o of project.elements) {
      if (o.id === sel.id) continue;
      const hOverlap = !(sel.x + sel.width < o.x || o.x + o.width < sel.x);
      const vOverlap = !(sel.y + sel.height < o.y || o.y + o.height < sel.y);
      if (hOverlap) {
        if (o.y > sel.y + sel.height) { const gap = o.y - (sel.y + sel.height); if (gap < 80) nearDists.push({ x: Math.max(sel.x, o.x) + Math.min(sel.width, o.width) / 2, y1: sel.y + sel.height, y2: o.y, gap: Math.round(gap), dir: "v" }); }
        if (sel.y > o.y + o.height) { const gap = sel.y - (o.y + o.height); if (gap < 80) nearDists.push({ x: Math.max(sel.x, o.x) + Math.min(sel.width, o.width) / 2, y1: o.y + o.height, y2: sel.y, gap: Math.round(gap), dir: "v" }); }
      }
      if (vOverlap) {
        if (o.x > sel.x + sel.width) { const gap = o.x - (sel.x + sel.width); if (gap < 80) nearDists.push({ y: Math.max(sel.y, o.y) + Math.min(sel.height, o.height) / 2, x1: sel.x + sel.width, x2: o.x, gap: Math.round(gap), dir: "h" }); }
        if (sel.x > o.x + o.width) { const gap = sel.x - (o.x + o.width); if (gap < 80) nearDists.push({ y: Math.max(sel.y, o.y) + Math.min(sel.height, o.height) / 2, x1: o.x + o.width, x2: sel.x, gap: Math.round(gap), dir: "h" }); }
      }
    }
  }

  const mono = "'JetBrains Mono', monospace";
  const isMulti = multiSel.length > 1;
  const selGroup = selected ? getGroup(selected) : null;

  // Contextual hints (show once, auto-dismiss)
  const [hint, setHint] = useState(null);
  const shownHints = useRef(new Set());
  useEffect(() => {
    if (view === "2d" && !shownHints.current.has("2d")) {
      shownHints.current.add("2d");
      setHint("Pinch to zoom · Two fingers to pan · Shift+click to multi-select");
      setTimeout(() => setHint(h => h === "Pinch to zoom · Two fingers to pan · Shift+click to multi-select" ? null : h), 5000);
    }
    if (view === "3d" && !shownHints.current.has("3d")) {
      shownHints.current.add("3d");
      setHint("Drag to orbit · Right-drag to pan · Scroll to zoom");
      setTimeout(() => setHint(h => h === "Drag to orbit · Right-drag to pan · Scroll to zoom" ? null : h), 5000);
    }
  }, [view]);

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
        <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Icon type="palette" size={14} color={C.textDim} /><span style={{ fontSize: 11, color: C.textDim }}>Wall</span>
          <input type="color" value={wallColor} onChange={e => setWallColor(e.target.value)} style={{ width: 24, height: 20, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", padding: 0, marginLeft: "auto" }} />
          <div style={{ marginLeft: 8, display: "flex", gap: 3 }}>
            <Btn variant="ghost" small onClick={undo} disabled={histIdx <= 0} title="Undo (Ctrl+Z)">↩</Btn>
            <Btn variant="ghost" small onClick={redo} disabled={histIdx >= history.length - 1} title="Redo (Ctrl+Shift+Z)">↪</Btn>
          </div>
        </div>

        {view === "2d" && <div style={{ padding: "10px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, cursor: "pointer" }}><input type="checkbox" checked={showGuides} onChange={e => setShowGuides(e.target.checked)} /> Snap & Guides</label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, cursor: "pointer" }}><input type="checkbox" checked={showMeas} onChange={e => setShowMeas(e.target.checked)} /> Measurements</label>
          <p style={{ fontSize: 10, color: C.textMuted }}>Pinch to zoom · Two fingers to pan · Shift+click to multi-select</p>
        </div>}

        {/* Multi-select actions */}
        {isMulti && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 6 }}>
          <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{multiSel.length} selected</span>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            <Btn small onClick={distributeH} title="Distribute horizontally within selection"><Icon type="distribute" size={12} /> H</Btn>
            <Btn small onClick={distributeV} title="Distribute vertically within selection"><Icon type="distribute" size={12} /> V</Btn>
            <Btn small onClick={distributeAcrossWallH} title="Distribute across full wall width">↔ Wall</Btn>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <Btn small onClick={createGroup}><Icon type="group" size={12} /> Group</Btn>
            <Btn small variant="ghost" onClick={() => setMultiSel([])}>Deselect</Btn>
          </div>
        </div>}

        {/* Group indicator */}
        {selGroup && !isMulti && <div style={{ padding: "8px 14px", borderBottom: `1px solid ${C.border}`, fontSize: 11, color: C.textDim, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Grouped ({selGroup.ids.length} items)</span>
          <Btn small variant="ghost" onClick={() => ungroup(selGroup.id)}>Ungroup</Btn>
        </div>}

        {sel && !isMulti && <div style={{ padding: 14, borderBottom: `1px solid ${C.border}` }}>
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
                {getGroup(el.id) && <span style={{ fontSize: 9, color: C.textMuted }}>●</span>}
              </div>
              <span style={{ color: C.textMuted, fontSize: 10, fontFamily: mono }}>{el.width}×{el.height}</span>
            </div>
          ))}
        </div>

        <div style={{ padding: 10, borderTop: `1px solid ${C.border}`, display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Btn small onClick={() => setShowExport(true)} title="Hanging Plan"><Icon type="ruler" size={13} /></Btn>
          <Btn small onClick={() => setShowSnapshots(true)} title="Version History"><Icon type="history" size={13} /></Btn>
          <Btn small onClick={saveSnapshot} title="Save Snapshot"><Icon type="save" size={13} /></Btn>
        </div>
      </div>

      {/* Canvas */}
      <div ref={contRef} style={{ flex: 1, position: "relative", overflow: "hidden", background: C.bg }} onMouseDown={onCanvasDown}>
        {view === "3d" ? <ThreeView project={{ ...project, wallColor }} selected={selected} /> : (
          <div ref={canvasRef} style={{ width: "100%", height: "100%", position: "relative" }}>
            <div style={{ position: "absolute", left: wOX, top: wOY, width: wpW, height: wpH, background: wallColor, border: `1px solid ${C.border}`, boxShadow: "0 2px 24px rgba(0,0,0,0.06)" }}>
              <svg width="100%" height="100%" style={{ position: "absolute", top: 0, left: 0, opacity: 0.04 }}>
                <defs><pattern id="g" width={50 * scale} height={50 * scale} patternUnits="userSpaceOnUse"><path d={`M ${50*scale} 0 L 0 0 0 ${50*scale}`} fill="none" stroke="#000" strokeWidth="0.5" /></pattern></defs>
                <rect width="100%" height="100%" fill="url(#g)" />
              </svg>

              {snapGuides.map((g, i) => <div key={i} style={{ position: "absolute", ...(g.t === "v" ? { left: g.p * scale, top: 0, width: 1, height: "100%" } : { top: g.p * scale, left: 0, height: 1, width: "100%" }), background: C.accent, opacity: 0.5 }} />)}

              {project.elements.map(el => {
                const isSel = selected === el.id || multiSel.includes(el.id);
                const isArt = el.category === "Artwork" && el.imageData;
                return (
                  <div key={el.id} onMouseDown={e => onElDown(e, el.id)} onClick={e => e.stopPropagation()}
                    style={{ position: "absolute", left: el.x * scale, top: el.y * scale, width: el.width * scale, height: el.height * scale, border: `${isSel ? 2 : 1}px solid ${isSel ? C.accent : "rgba(0,0,0,0.12)"}`, borderRadius: 3, cursor: dragging?.ids?.includes(el.id) ? "grabbing" : "grab", background: isArt ? "transparent" : (el.frontColor || el.bodyColor || C.accent), overflow: "hidden", zIndex: isSel ? 10 : 1, boxShadow: isSel ? `0 0 0 2px ${C.accent}` : "0 1px 3px rgba(0,0,0,0.08)" }}>
                    {isArt && <img src={el.imageData} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }} />}

                    {isSel && !dragging && multiSel.length <= 1 && ["e", "w", "s", "n", "se", "sw", "ne", "nw"].map(edge => {
                      const ic = edge.length === 2, sz = ic ? 8 : 6;
                      const s = { position: "absolute", width: sz, height: sz, background: C.accent, borderRadius: ic ? 2 : 1, zIndex: 20, border: "1px solid white" };
                      if (edge.includes("e")) { s.right = -sz / 2; s.cursor = "ew-resize"; }
                      if (edge.includes("w")) { s.left = -sz / 2; s.cursor = "ew-resize"; }
                      if (edge.includes("s")) { s.bottom = -sz / 2; s.cursor = "ns-resize"; }
                      if (edge.includes("n")) { s.top = -sz / 2; s.cursor = "ns-resize"; }
                      if (edge === "e" || edge === "w") { s.top = "50%"; s.transform = "translateY(-50%)"; }
                      if (edge === "n" || edge === "s") { s.left = "50%"; s.transform = "translateX(-50%)"; }
                      if (edge === "se") s.cursor = "nwse-resize"; if (edge === "sw") s.cursor = "nesw-resize"; if (edge === "ne") s.cursor = "nesw-resize"; if (edge === "nw") s.cursor = "nwse-resize";
                      return <div key={edge} onMouseDown={e => onResizeDown(e, el.id, edge)} style={s} />;
                    })}

                    {isSel && showMeas && multiSel.length <= 1 && <>
                      <div style={{ position: "absolute", bottom: -17, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accent, fontFamily: mono, whiteSpace: "nowrap", background: wallColor, padding: "0 3px", borderRadius: 3 }}>{el.width}</div>
                      <div style={{ position: "absolute", right: -30, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accent, fontFamily: mono, whiteSpace: "nowrap", background: wallColor, padding: "0 3px", borderRadius: 3 }}>{el.height}</div>
                    </>}
                  </div>
                );
              })}

              {/* Wall edge distances */}
              {sel && showMeas && multiSel.length === 0 && <>
                {sel.x > 5 && <div style={{ position: "absolute", left: 0, top: (sel.y + sel.height / 2) * scale, width: sel.x * scale, borderTop: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(sel.x)}</span></div>}
                {(project.wallWidth - sel.x - sel.width) > 5 && <div style={{ position: "absolute", left: (sel.x + sel.width) * scale, top: (sel.y + sel.height / 2) * scale, width: (project.wallWidth - sel.x - sel.width) * scale, borderTop: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(project.wallWidth - sel.x - sel.width)}</span></div>}
                {sel.y > 5 && <div style={{ position: "absolute", top: 0, left: (sel.x + sel.width / 2) * scale, height: sel.y * scale, borderLeft: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(sel.y)}</span></div>}
                {(project.wallHeight - sel.y - sel.height) > 5 && <div style={{ position: "absolute", top: (sel.y + sel.height) * scale, left: (sel.x + sel.width / 2) * scale, height: (project.wallHeight - sel.y - sel.height) * scale, borderLeft: `1px dashed ${C.accentDark}` }}><span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: C.accentDark, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{Math.round(project.wallHeight - sel.y - sel.height)}</span></div>}
              </>}

              {/* Object-to-object distances */}
              {nearDists.map((nd, i) => nd.dir === "v" ? (
                <div key={i} style={{ position: "absolute", left: nd.x * scale - 0.5, top: nd.y1 * scale, height: (nd.y2 - nd.y1) * scale, borderLeft: `1px dotted ${C.danger}` }}>
                  <span style={{ position: "absolute", left: 4, top: "50%", transform: "translateY(-50%)", fontSize: 9, color: C.danger, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{nd.gap}</span>
                </div>
              ) : (
                <div key={i} style={{ position: "absolute", top: nd.y * scale - 0.5, left: nd.x1 * scale, width: (nd.x2 - nd.x1) * scale, borderTop: `1px dotted ${C.danger}` }}>
                  <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: C.danger, fontFamily: mono, background: wallColor, padding: "0 2px" }}>{nd.gap}</span>
                </div>
              ))}

              {/* Selection box */}
              {selBox && <div style={{ position: "absolute", left: Math.min(selBox.x1, selBox.x2) * scale, top: Math.min(selBox.y1, selBox.y2) * scale, width: Math.abs(selBox.x2 - selBox.x1) * scale, height: Math.abs(selBox.y2 - selBox.y1) * scale, border: `1px dashed ${C.accent}`, background: C.accentGlow, pointerEvents: "none" }} />}
            </div>

            <div style={{ position: "absolute", left: wOX, top: wOY + wpH + 6, width: wpW, textAlign: "center", fontSize: 11, fontFamily: mono, color: C.textMuted }}>{project.wallWidth} cm</div>
            <div style={{ position: "absolute", left: wOX - 8, top: wOY, height: wpH, display: "flex", alignItems: "center", fontSize: 11, fontFamily: mono, color: C.textMuted, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>{project.wallHeight} cm</div>
          </div>
        )}

        {/* Contextual hint */}
        {hint && (
          <div onClick={() => setHint(null)} style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 15, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 16px", fontSize: 12, color: C.textDim, boxShadow: "0 4px 16px rgba(0,0,0,0.1)", cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
            <span>{hint}</span>
            <span style={{ fontSize: 10, color: C.textMuted }}>✕</span>
          </div>
        )}

        {/* Design tips floating button */}
        <div style={{ position: "absolute", bottom: 16, right: 16, zIndex: 20 }}>
          <button onClick={() => setShowSuggestions(!showSuggestions)} style={{
            width: 48, height: 48, borderRadius: 24, border: "none", cursor: "pointer",
            background: showSuggestions ? C.accent : C.surface, color: showSuggestions ? C.white : C.accent,
            boxShadow: "0 3px 12px rgba(0,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
            position: "relative", transition: "all 0.15s",
          }}>
            <Icon type="lightbulb" size={22} color={showSuggestions ? C.white : C.accent} />
            {runDesignCheck(project).length > 0 && <span style={{ position: "absolute", top: -2, right: -2, background: C.danger, color: C.white, fontSize: 10, fontWeight: 700, width: 18, height: 18, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>{runDesignCheck(project).length}</span>}
          </button>
        </div>

        {/* Suggestions panel */}
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position: "absolute", bottom: 72, right: 16, width: 300, maxHeight: "50vh", overflow: "auto", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.1)", zIndex: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Icon type="lightbulb" size={15} color={C.accent} /> Design Tips</h4>
              <Btn small variant="accent" onClick={() => { suggestions.forEach(s => { if (s.fix) updEl(s.elementId, s.fix); }); }}>Fix All</Btn>
            </div>
            {suggestions.map((s, i) => (
              <div key={i} onClick={() => { setSelected(s.elementId); setMultiSel([]); }}
                style={{ padding: 10, background: s.severity === "warning" ? "rgba(184,136,75,0.08)" : C.surfaceAlt, borderRadius: 8, marginBottom: 6, fontSize: 11, color: C.textDim, cursor: "pointer", border: selected === s.elementId ? `1px solid ${C.accent}` : `1px solid transparent` }}>
                <span style={{ fontWeight: 600, color: C.text }}>{s.elementName}</span>
                <p style={{ marginTop: 2 }}>{s.message}</p>
                {s.fix && <Btn small variant="ghost" style={{ marginTop: 4 }} onClick={(e) => { e.stopPropagation(); updEl(s.elementId, s.fix); }}>Auto-fix</Btn>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Asset Picker */}
      {showPicker && <Modal title="Place an Asset" onClose={() => setShowPicker(false)} width={580}>
        <Btn onClick={() => { setShowPicker(false); setShowNewAsset(true); }} style={{ marginBottom: 12, width: "100%" }}><Icon type="plus" size={14} /> Create New Asset</Btn>
        {assets.length === 0 ? <p style={{ color: C.textMuted, textAlign: "center", padding: 20 }}>No assets yet. Create one above.</p> : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
            {assets.map(a => (
              <div key={a.id} onClick={() => addAsset(a)} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", cursor: "pointer", transition: "border-color 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.accent} onMouseLeave={e => e.currentTarget.style.borderColor = C.border}>
                <div style={{ height: 65, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {a.category === "Artwork" && a.imageData ? (
                    <div style={{ width: 50, height: 50, borderRadius: 3, overflow: "hidden", border: `2px solid ${a.bodyColor || "#6b4423"}` }}>
                      <img src={a.imageData} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  ) : (
                    <AssetThumb bodyColor={a.bodyColor || "#8b6b3d"} frontColor={a.frontColor || a.bodyColor || "#8b6b3d"} w={a.width} h={a.height} d={a.depth} size={55} legs={a.legStyle} drawers={a.drawers || 0} doorStyle={a.doorStyle} doorConfig={a.doorConfig} mountType={a.mountType} shelfStyle={a.shelfStyle} shelfCount={a.shelfCount} category={a.category} frameType={a.frameType} matWidth={a.matWidth} imageData={a.imageData} />
                  )}
                </div>
                <div style={{ padding: 6 }}><p style={{ fontSize: 11, fontWeight: 600 }}>{a.name}</p><p style={{ fontSize: 10, color: C.textDim }}>{a.width}×{a.height}</p></div>
              </div>
            ))}
          </div>
        )}
      </Modal>}

      {/* Create asset from project */}
      {showNewAsset && <AssetModal asset={null} onClose={() => setShowNewAsset(false)} onSave={a => {
        if (onAddAsset) onAddAsset(a); // Save to library
        addAsset(a); // Place on wall
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
        {(!project.snapshots || project.snapshots.length === 0) ? <p style={{ color: C.textMuted }}>No snapshots saved yet. Click the save icon to capture your layout.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {project.snapshots.map(s => (
              <div key={s.id} style={{ padding: 10, background: C.surfaceAlt, borderRadius: 8, border: `1px solid ${C.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><p style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</p><p style={{ fontSize: 11, color: C.textMuted }}>{new Date(s.date).toLocaleString()} · {s.elements.length} els</p></div>
                <div style={{ display: "flex", gap: 4 }}><Btn small onClick={() => loadSnapshot(s)}>Load</Btn><Btn small variant="ghost" onClick={() => deleteSnapshot(s.id)}><Icon type="trash" size={12} color={C.danger} /></Btn></div>
              </div>
            ))}
          </div>
        )}
      </Modal>}
    </div>
  );
}
