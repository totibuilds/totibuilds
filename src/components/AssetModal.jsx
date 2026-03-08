import { useState, useRef } from "react";
import { C, CATEGORIES, MOUNT_TYPES, DOOR_STYLES, DOOR_CONFIGS, FRAME_TYPES, SHELF_STYLES, DRAWER_COUNTS, LEG_STYLES, MATERIALS, uid } from "../utils/constants";
import { Btn, NumInput, TextInput, Sel, Modal, MaterialPicker, AssetThumb, Icon } from "./UI";

export default function AssetModal({ asset, onClose, onSave }) {
  const [name, setName] = useState(asset?.name || "");
  const [cat, setCat] = useState(asset?.category || CATEGORIES[0]);
  const [desc, setDesc] = useState(asset?.description || "");
  const [w, setW] = useState(asset?.width || 60);
  const [h, setH] = useState(asset?.height || 30);
  const [d, setD] = useState(asset?.depth || 15);
  const [bodyMat, setBodyMat] = useState(asset?.bodyMaterial || "Wood");
  const [bodyClr, setBodyClr] = useState(asset?.bodyColor || MATERIALS.Wood[0].hex);
  const [frontMat, setFrontMat] = useState(asset?.frontMaterial || "");
  const [frontClr, setFrontClr] = useState(asset?.frontColor || "");
  const [mount, setMount] = useState(asset?.mountType || "");
  const [doorStyle, setDoorStyle] = useState(asset?.doorStyle || DOOR_STYLES[0]);
  const [doorConfig, setDoorConfig] = useState(asset?.doorConfig || DOOR_CONFIGS[0]);
  const [frameType, setFrameType] = useState(asset?.frameType || FRAME_TYPES[0]);
  const [shelfStyle, setShelfStyle] = useState(asset?.shelfStyle || SHELF_STYLES[0]);
  const [shelfCount, setShelfCount] = useState(asset?.shelfCount || 4);
  const [matWidth, setMatWidth] = useState(asset?.matWidth || 0);
  const [drawers, setDrawers] = useState(asset?.drawers || 0);
  const [legStyle, setLegStyle] = useState(asset?.legStyle || "None");
  const [imgData, setImgData] = useState(asset?.imageData || null);
  const fileRef = useRef();
  const useFront = frontMat && frontClr;

  const mounts = MOUNT_TYPES[cat] || [];
  const showDrawers = cat === "Furniture" || cat === "Cabinet";
  const showDoors = cat === "Cabinet";
  const showLegs = cat === "Furniture" || cat === "Standing Shelf" || (cat === "Cabinet" && (mount || "").includes("legs"));
  const showShelves = cat === "Shelf";
  const showStandingShelves = cat === "Standing Shelf";
  const showFrame = cat === "Artwork";

  const handleCatChange = v => {
    setCat(v);
    setMount("");
    setDoorStyle(DOOR_STYLES[0]);
    setDoorConfig(DOOR_CONFIGS[0]);
    setFrameType(FRAME_TYPES[0]);
    setShelfStyle(SHELF_STYLES[0]);
    setDrawers(0);
    setLegStyle("None");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: asset?.id || uid(),
      name: name.trim(),
      category: cat,
      description: desc,
      width: Math.max(1, w),
      height: Math.max(1, h),
      depth: Math.max(1, d),
      bodyMaterial: bodyMat,
      bodyColor: bodyClr,
      frontMaterial: frontMat || "",
      frontColor: frontClr || "",
      mountType: mount || (mounts.length ? mounts[0] : ""),
      doorStyle: showDoors ? doorStyle : "",
      doorConfig: showDoors ? doorConfig : "",
      frameType: showFrame ? frameType : "",
      shelfStyle: showShelves ? shelfStyle : "",
      shelfCount: showStandingShelves ? shelfCount : undefined,
      matWidth: showFrame ? matWidth : 0,
      drawers: showDrawers ? drawers : 0,
      legStyle: showLegs ? legStyle : "None",
      imageData: imgData,
    });
  };

  return (
    <Modal title={asset ? "Edit Asset" : "New Asset"} onClose={onClose} width={580}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <TextInput label="Name" value={name} onChange={setName} placeholder="e.g. IKEA Floating Shelf" />
        <Sel label="Category" value={cat} onChange={handleCatChange} options={CATEGORIES} />
        <TextInput label="Description (optional notes)" value={desc} onChange={setDesc} placeholder="e.g. rounded edges, matte finish" multiline />

        {/* Dimensions */}
        <div style={{ display: "grid", gridTemplateColumns: showStandingShelves ? "1fr 1fr 1fr 1fr" : "1fr 1fr 1fr", gap: 8 }}>
          <NumInput label="Width" value={w} onChange={setW} suffix="cm" min={1} />
          <NumInput label="Height" value={h} onChange={setH} suffix="cm" min={1} />
          <NumInput label="Depth" value={d} onChange={setD} suffix="cm" min={1} />
          {showStandingShelves && <NumInput label="Shelves" value={shelfCount} onChange={v => setShelfCount(Math.max(2, Math.round(v)))} min={2} />}
        </div>

        {/* Category-specific */}
        {mounts.length > 0 && <Sel label="Mounting Type" value={mount || mounts[0]} onChange={setMount} options={mounts} />}
        {showShelves && <Sel label="Shelf Style" value={shelfStyle} onChange={setShelfStyle} options={SHELF_STYLES} />}

        {showDoors && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Sel label="Door Config" value={doorConfig} onChange={setDoorConfig} options={DOOR_CONFIGS} />
            <Sel label="Door/Handle Style" value={doorStyle} onChange={setDoorStyle} options={DOOR_STYLES} />
          </div>
        )}

        {showDrawers && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Sel label="Drawers" value={String(drawers)} onChange={v => setDrawers(parseInt(v))} options={DRAWER_COUNTS.map(String)} />
            {showLegs && <Sel label="Legs" value={legStyle} onChange={setLegStyle} options={LEG_STYLES} />}
          </div>
        )}

        {!showDrawers && showLegs && <Sel label="Legs" value={legStyle} onChange={setLegStyle} options={LEG_STYLES} />}

        {showFrame && (
          <>
            <Sel label="Frame Type" value={frameType} onChange={setFrameType} options={FRAME_TYPES} />
            <NumInput label="Passepartout / Mat Width" value={matWidth} onChange={setMatWidth} suffix="cm" min={0} />
          </>
        )}

        {/* Body Material */}
        <MaterialPicker label="Body Material & Color" materialGroup={bodyMat} shade={bodyClr} onChangeMaterial={setBodyMat} onChangeShade={setBodyClr} />

        {/* Front color toggle */}
        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.textDim, cursor: "pointer", marginBottom: 6 }}>
            <input type="checkbox" checked={!!useFront} onChange={e => { if (e.target.checked) { setFrontMat(bodyMat); setFrontClr(bodyClr); } else { setFrontMat(""); setFrontClr(""); } }} />
            Different front / door color
          </label>
          {useFront && <MaterialPicker label="Front Material & Color" materialGroup={frontMat} shade={frontClr} onChangeMaterial={setFrontMat} onChangeShade={setFrontClr} />}
        </div>

        {/* Image */}
        {(showFrame || cat === "Decorative") && (
          <div>
            <p style={{ fontSize: 11, color: C.textDim, marginBottom: 4, fontWeight: 500 }}>{showFrame ? "Artwork Image" : "Reference Image"}</p>
            <div onClick={() => fileRef.current?.click()} style={{ border: `2px dashed ${C.border}`, borderRadius: 8, padding: imgData ? 0 : 28, textAlign: "center", cursor: "pointer", overflow: "hidden", height: imgData ? 140 : "auto", display: "flex", alignItems: "center", justifyContent: "center", background: C.surfaceAlt }}>
              {imgData ? <img src={imgData} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <div><Icon type="image" size={24} color={C.border} /><p style={{ fontSize: 11, color: C.textMuted, marginTop: 6 }}>Click to upload</p></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = ev => setImgData(ev.target.result); r.readAsDataURL(f); }} style={{ display: "none" }} />
            {imgData && <Btn variant="ghost" small onClick={() => setImgData(null)} style={{ marginTop: 4 }}><Icon type="trash" size={12} color={C.danger} /> Remove</Btn>}
          </div>
        )}

        {/* Preview */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, background: C.surfaceAlt, borderRadius: 8 }}>
          <AssetThumb bodyColor={bodyClr} frontColor={useFront ? frontClr : bodyClr} w={w} h={h} d={d} size={72} legs={showLegs ? legStyle : "None"} drawers={showDrawers ? drawers : 0} doorStyle={doorStyle} doorConfig={doorConfig} mountType={mount} shelfStyle={shelfStyle} shelfCount={shelfCount} category={cat} frameType={frameType} matWidth={matWidth} imageData={imgData} />
          <div style={{ fontSize: 12, color: C.textDim }}>Preview<br /><span style={{ fontSize: 11, color: C.textMuted }}>{w}×{h}×{d} cm</span></div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="accent" disabled={!name.trim()} onClick={handleSave}>{asset ? "Save" : "Add Asset"}</Btn>
        </div>
      </div>
    </Modal>
  );
}
