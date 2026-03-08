import { useState } from "react";
import { C, CATEGORIES, uid } from "../utils/constants";
import { Btn, Icon, AssetThumb, Modal, TextInput, NumInput } from "./UI";

// ═══════════════════════════════════════
// HOME SCREEN
// ═══════════════════════════════════════
export function HomeScreen({ projects, onOpen, onNew, onDelete, onDuplicate, onRename }) {
  const [renaming, setRenaming] = useState(null);
  const [newName, setNewName] = useState("");

  return (
    <div style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700 }}>Projects</h1><p style={{ fontSize: 13, color: C.textDim, marginTop: 3 }}>Plan your walls and spaces</p></div>
        {projects.length > 0 && <Btn variant="accent" onClick={onNew}><Icon type="plus" size={15} color={C.white} /> New Project</Btn>}
      </div>
      {projects.length === 0 ? (
        <div style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: 56, textAlign: "center", color: C.textMuted }}>
          <Icon type="folder" size={36} color={C.border} />
          <p style={{ marginTop: 12, fontSize: 14 }}>No projects yet</p>
          <p style={{ fontSize: 12, marginTop: 4, color: C.textMuted }}>Create a project to start planning your wall</p>
          <Btn variant="accent" onClick={onNew} style={{ marginTop: 14 }}><Icon type="plus" size={14} color={C.white} /> Create Project</Btn>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {projects.map(p => (
            <div key={p.id} onClick={() => onOpen(p.id)} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.boxShadow = `0 2px 12px ${C.accentGlow}`; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <div><h3 style={{ fontSize: 15, fontWeight: 600 }}>{p.name}</h3><p style={{ fontSize: 12, color: C.textDim, marginTop: 3 }}>{p.wallWidth}×{p.wallHeight} cm</p></div>
                <div style={{ display: "flex", gap: 2 }} onClick={e => e.stopPropagation()}>
                  <Btn variant="ghost" small onClick={() => { setRenaming(p.id); setNewName(p.name); }} title="Rename"><Icon type="edit" size={13} /></Btn>
                  <Btn variant="ghost" small onClick={() => onDuplicate(p.id)} title="Duplicate"><Icon type="dup" size={13} /></Btn>
                  <Btn variant="ghost" small onClick={() => onDelete(p.id)} title="Delete"><Icon type="trash" size={13} color={C.danger} /></Btn>
                </div>
              </div>
              <div style={{ marginTop: 10, fontSize: 12, color: C.textMuted }}>{p.elements?.length || 0} elements</div>
              <div style={{ marginTop: 10, background: p.wallColor || "#f5f0e6", borderRadius: 8, height: 64, border: `1px solid ${C.border}`, position: "relative", overflow: "hidden" }}>
                {(p.elements || []).map(el => { const s = Math.min(240 / p.wallWidth, 64 / p.wallHeight) * 0.8; return <div key={el.id} style={{ position: "absolute", left: el.x * s + 3, top: el.y * s + 3, width: el.width * s, height: el.height * s, background: el.frontColor || el.bodyColor || C.accent, borderRadius: 1, opacity: 0.7 }} />; })}
              </div>
            </div>
          ))}
        </div>
      )}

      {renaming && (
        <Modal title="Rename Project" onClose={() => setRenaming(null)} width={400}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <TextInput label="Project Name" value={newName} onChange={setNewName} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <Btn onClick={() => setRenaming(null)}>Cancel</Btn>
              <Btn variant="accent" disabled={!newName.trim()} onClick={() => { onRename(renaming, newName.trim()); setRenaming(null); }}>Save</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// ASSET LIBRARY
// ═══════════════════════════════════════
export function AssetLibrary({ assets, onAdd, onEdit, onDelete, onDuplicate }) {
  const [filter, setFilter] = useState("All");
  const filtered = filter === "All" ? assets : assets.filter(a => a.category === filter);
  return (
    <div style={{ padding: 32, maxWidth: 960, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div><h1 style={{ fontSize: 22, fontWeight: 700 }}>Asset Library</h1><p style={{ fontSize: 13, color: C.textDim, marginTop: 3 }}>Shared across all projects</p></div>
        <Btn variant="accent" onClick={onAdd}><Icon type="plus" size={15} color={C.white} /> Add Asset</Btn>
      </div>
      <div style={{ display: "flex", gap: 5, marginBottom: 18, flexWrap: "wrap" }}>
        {["All", ...CATEGORIES].map(c => <Btn key={c} small variant={filter === c ? "accent" : "default"} onClick={() => setFilter(c)}>{c}</Btn>)}
      </div>
      {filtered.length === 0 ? (
        <div style={{ border: `2px dashed ${C.border}`, borderRadius: 14, padding: 56, textAlign: "center", color: C.textMuted }}>
          <Icon type="image" size={36} color={C.border} /><p style={{ marginTop: 12 }}>No assets {filter !== "All" ? `in "${filter}"` : "yet"}</p>
          <Btn variant="accent" onClick={onAdd} style={{ marginTop: 14 }}><Icon type="plus" size={14} color={C.white} /> Add</Btn>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
          {filtered.map(a => (
            <div key={a.id} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
              <div style={{ height: 100, display: "flex", alignItems: "center", justifyContent: "center", background: C.surfaceAlt }}>
                {a.category === "Artwork" && a.imageData ? (
                  <div style={{ width: 80, height: 80, borderRadius: 4, overflow: "hidden", border: a.frameType && a.frameType !== "No frame / canvas wrap" ? `3px solid ${a.bodyColor || "#6b4423"}` : "none" }}>
                    <img src={a.imageData} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <AssetThumb bodyColor={a.bodyColor || "#8b6b3d"} frontColor={a.frontColor || a.bodyColor || "#8b6b3d"} w={a.width} h={a.height} d={a.depth || 15} size={90} legs={a.legStyle} drawers={a.drawers || 0} />
                )}
              </div>
              <div style={{ padding: 10 }}>
                <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 3 }}>{a.name}</h4>
                <p style={{ fontSize: 11, color: C.textDim }}>{a.category} · {a.width}×{a.height}×{a.depth || "?"}</p>
                {a.description && <p style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>{a.description}</p>}
                <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                  <Btn variant="ghost" small onClick={() => onEdit(a)}><Icon type="edit" size={12} /></Btn>
                  <Btn variant="ghost" small onClick={() => onDuplicate(a)}><Icon type="dup" size={12} /></Btn>
                  <Btn variant="ghost" small onClick={() => onDelete(a.id)}><Icon type="trash" size={12} color={C.danger} /></Btn>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════
// NEW PROJECT MODAL
// ═══════════════════════════════════════
export function NewProjectModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [wwText, setWwText] = useState("300");
  const [whText, setWhText] = useState("260");
  const [wallColor, setWallColor] = useState("#f5f0e6");

  const ww = Math.max(50, parseInt(wwText) || 300);
  const wh = Math.max(50, parseInt(whText) || 260);

  return (
    <Modal title="New Project" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextInput label="Project Name" value={name} onChange={setName} placeholder="e.g. Living Room — Main Wall" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: C.textDim, fontWeight: 500 }}>
            Wall Width
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="text" inputMode="numeric" value={wwText} onFocus={e => e.target.select()}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setWwText(e.target.value); }}
                style={{ flex: 1, padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <span style={{ fontSize: 11, color: C.textMuted }}>cm</span>
            </div>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11, color: C.textDim, fontWeight: 500 }}>
            Wall Height
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="text" inputMode="numeric" value={whText} onFocus={e => e.target.select()}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setWhText(e.target.value); }}
                style={{ flex: 1, padding: "6px 8px", background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 6, color: C.text, fontSize: 13, fontFamily: "inherit", outline: "none" }} />
              <span style={{ fontSize: 11, color: C.textMuted }}>cm</span>
            </div>
          </label>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: C.textDim, fontWeight: 500 }}>Wall Color</span>
          <input type="color" value={wallColor} onChange={e => setWallColor(e.target.value)} style={{ width: 32, height: 24, border: `1px solid ${C.border}`, borderRadius: 4, cursor: "pointer", padding: 0 }} />
          <span style={{ fontSize: 11, color: C.textMuted }}>{wallColor}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" disabled={!name.trim()} onClick={() => onCreate({ id: uid(), name: name.trim(), wallWidth: ww, wallHeight: wh, wallColor, elements: [], snapshots: [], groups: [] })}>Create</Btn>
        </div>
      </div>
    </Modal>
  );
}
