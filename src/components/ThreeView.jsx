import { useRef, useEffect } from "react";
import * as THREE from "three";
import { C, clamp } from "../utils/constants";

export default function ThreeView({ project, selected }) {
  const mountRef = useRef(null);
  const stRef = useRef({ ready: false });
  const frameRef = useRef(null);
  const mouseRef = useRef({ down: false, btn: 0, x: 0, y: 0, theta: 0, phi: Math.PI / 8, dist: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f3ed);
    scene.add(new THREE.AmbientLight(0xfff5e6, 0.55));
    const ceil = new THREE.PointLight(0xffe4c4, 0.85, 1500);
    ceil.position.set(project.wallWidth / 2, project.wallHeight + 80, project.wallWidth * 0.3);
    ceil.castShadow = true; scene.add(ceil);
    scene.add(Object.assign(new THREE.DirectionalLight(0xfff0dd, 0.3), { position: new THREE.Vector3(-150, 100, 300) }));

    const camera = new THREE.PerspectiveCamera(42, w / h, 1, 8000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h); renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    mouseRef.current.dist = Math.max(project.wallWidth, project.wallHeight) * 1.4;
    mouseRef.current.targetX = project.wallWidth / 2;
    mouseRef.current.targetY = project.wallHeight / 2;

    const updateCam = () => {
      const m = mouseRef.current;
      m.theta = clamp(m.theta, -Math.PI / 2.2, Math.PI / 2.2);
      m.phi = clamp(m.phi, -0.1, Math.PI / 3);
      camera.position.set(m.targetX + m.dist * Math.sin(m.theta) * Math.cos(m.phi), m.targetY + m.dist * Math.sin(m.phi), m.dist * Math.cos(m.theta) * Math.cos(m.phi));
      camera.lookAt(m.targetX, m.targetY, 0);
    };
    updateCam();
    stRef.current = { ready: true, scene, camera, renderer, meshMap: {}, updateCam };

    const animate = () => { frameRef.current = requestAnimationFrame(animate); renderer.render(scene, camera); };
    animate();

    const onDown = e => { e.preventDefault(); mouseRef.current.down = true; mouseRef.current.btn = e.button; mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY; };
    const onUp = () => { mouseRef.current.down = false; };
    const onMove = e => {
      if (!mouseRef.current.down) return;
      const dx = e.clientX - mouseRef.current.x, dy = e.clientY - mouseRef.current.y;
      mouseRef.current.x = e.clientX; mouseRef.current.y = e.clientY;
      if (mouseRef.current.btn === 2 || e.shiftKey) { mouseRef.current.targetX -= dx * 0.5; mouseRef.current.targetY += dy * 0.5; }
      else { mouseRef.current.theta -= dx * 0.005; mouseRef.current.phi += dy * 0.005; }
      updateCam();
    };
    const onWheel = e => { e.preventDefault(); mouseRef.current.dist = clamp(mouseRef.current.dist + e.deltaY * 0.7, 100, 2500); updateCam(); };
    const onCtx = e => e.preventDefault();

    const cv = renderer.domElement;
    cv.addEventListener("mousedown", onDown); cv.addEventListener("contextmenu", onCtx);
    window.addEventListener("mouseup", onUp); window.addEventListener("mousemove", onMove);
    cv.addEventListener("wheel", onWheel, { passive: false });
    const ro = new ResizeObserver(() => { camera.aspect = mount.clientWidth / mount.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(mount.clientWidth, mount.clientHeight); });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frameRef.current);
      cv.removeEventListener("mousedown", onDown); cv.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("mouseup", onUp); window.removeEventListener("mousemove", onMove);
      cv.removeEventListener("wheel", onWheel); ro.disconnect(); renderer.dispose();
      stRef.current = { ready: false };
      if (mount.contains(cv)) mount.removeChild(cv);
    };
  }, []);

  useEffect(() => {
    const st = stRef.current;
    if (!st.ready) return;
    const { scene, meshMap } = st;

    ["_wall", "_floor"].forEach(n => { const o = scene.getObjectByName(n); if (o) scene.remove(o); });
    const wallColor = project.wallColor || "#f5f0e6";
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(project.wallWidth, project.wallHeight, 2), new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92 }));
    wallMesh.name = "_wall"; wallMesh.position.set(project.wallWidth / 2, project.wallHeight / 2, -1); wallMesh.receiveShadow = true; scene.add(wallMesh);
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(project.wallWidth * 1.8, 1, project.wallWidth), new THREE.MeshStandardMaterial({ color: 0x8b4a2b, roughness: 0.55 }));
    floorMesh.name = "_floor"; floorMesh.position.set(project.wallWidth / 2, -0.5, project.wallWidth * 0.4); floorMesh.receiveShadow = true; scene.add(floorMesh);

    const cur = new Set(project.elements.map(e => e.id));
    Object.keys(meshMap).forEach(id => { if (!cur.has(id)) { scene.remove(meshMap[id]); delete meshMap[id]; } });

    const metalMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });

    project.elements.forEach(el => {
      if (meshMap[el.id]) { scene.remove(meshMap[el.id]); delete meshMap[el.id]; }

      const depth = Math.max(el.depth || 15, 2);
      const bodyHex = el.bodyColor || "#8b6b3d";
      const frontHex = el.frontColor || bodyHex;
      const isSel = el.id === selected;
      const roughness = el.bodyMaterial === "Metal" ? 0.25 : el.bodyMaterial === "Glass" ? 0.1 : 0.7;
      const bodyMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness });
      const frontMat = new THREE.MeshStandardMaterial({ color: frontHex, roughness });

      const group = new THREE.Group();
      group.name = el.id;
      group.frustumCulled = false;

      const addBox = (gw, gh, gd, mat, pos, fc = false) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(gw, gh, gd), mat);
        m.position.set(...pos); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = fc; group.add(m); return m;
      };

      const isOpenCab = el.category === "Cabinet" && (el.doorConfig === "No door" || el.doorStyle === "Open / no door");
      const isStandingShelf = el.category === "Standing Shelf";

      if (isOpenCab || isStandingShelf) {
        // Render as open frame with shelves
        const thick = 1.5;
        const shelfCnt = isStandingShelf ? (el.shelfCount || 4) : 3;
        // Side panels
        addBox(thick, el.height, depth, bodyMat, [-el.width / 2 + thick / 2, 0, 0]);
        addBox(thick, el.height, depth, bodyMat, [el.width / 2 - thick / 2, 0, 0]);
        // Top & bottom
        addBox(el.width, thick, depth, bodyMat, [0, el.height / 2 - thick / 2, 0]);
        addBox(el.width, thick, depth, bodyMat, [0, -el.height / 2 + thick / 2, 0]);
        // Back panel
        addBox(el.width - thick * 2, el.height - thick * 2, 0.5, new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.9 }), [0, 0, -depth / 2 + 0.25]);
        // Internal shelves
        const secH = el.height / shelfCnt;
        for (let i = 1; i < shelfCnt; i++) {
          addBox(el.width - thick * 2, thick, depth - 1, bodyMat, [0, el.height / 2 - secH * i, 0]);
        }
      } else if (el.category === "Artwork") {
        // Frame + passepartout + artwork image
        const fw = el.frameType === "Thick traditional frame" ? 4 : el.frameType === "Thin modern frame" || el.frameType === "Floating frame" ? 2 : 0;
        const mw = el.matWidth || 0;
        const frameMat = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.6 });

        if (fw > 0) {
          // Frame - 4 bars
          addBox(el.width, fw, depth, frameMat, [0, el.height / 2 - fw / 2, 0]); // top
          addBox(el.width, fw, depth, frameMat, [0, -el.height / 2 + fw / 2, 0]); // bottom
          addBox(fw, el.height - fw * 2, depth, frameMat, [-el.width / 2 + fw / 2, 0, 0]); // left
          addBox(fw, el.height - fw * 2, depth, frameMat, [el.width / 2 - fw / 2, 0, 0]); // right
        }

        // Mat (white border)
        if (mw > 0) {
          const matMesh = addBox(el.width - fw * 2, el.height - fw * 2, depth * 0.5, new THREE.MeshStandardMaterial({ color: 0xf5f2eb, roughness: 0.9 }), [0, 0, depth * 0.15]);
          // Artwork inside mat
          const artW = el.width - fw * 2 - mw * 2;
          const artH = el.height - fw * 2 - mw * 2;
          if (artW > 0 && artH > 0) {
            const artMats = el.imageData ? frontMat : new THREE.MeshStandardMaterial({ color: frontHex, roughness: 0.8 });
            if (el.imageData) {
              new THREE.TextureLoader().load(el.imageData, tex => { artMats.map = tex; artMats.needsUpdate = true; });
            }
            addBox(artW, artH, depth * 0.3, artMats, [0, 0, depth * 0.2]);
          }
        } else {
          // No mat, just artwork
          const artMats = new THREE.MeshStandardMaterial({ color: frontHex, roughness: 0.8 });
          if (el.imageData) {
            new THREE.TextureLoader().load(el.imageData, tex => { artMats.map = tex; artMats.needsUpdate = true; });
          }
          addBox(el.width - fw * 2, el.height - fw * 2, depth * 0.8, artMats, [0, 0, fw > 0 ? depth * 0.05 : 0]);
        }
      } else {
        // Standard box body
        const mats = [];
        for (let i = 0; i < 6; i++) mats.push(new THREE.MeshStandardMaterial({ color: i === 4 ? frontHex : bodyHex, roughness, transparent: el.bodyMaterial === "Glass", opacity: el.bodyMaterial === "Glass" ? 0.4 : 1 }));
        const body = new THREE.Mesh(new THREE.BoxGeometry(el.width, el.height, depth), mats);
        body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
        group.add(body);

        // Double door line
        if (el.category === "Cabinet" && el.doorConfig === "Double doors") {
          addBox(0.3, el.height - 2, 0.3, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }), [0, 0, depth / 2 + 0.2]);
        }

        // Handles
        if (el.category === "Cabinet" && el.doorStyle && el.doorStyle !== "Plain / handleless" && el.doorStyle !== "Open / no door") {
          const isDouble = el.doorConfig === "Double doors";
          if (el.doorStyle === "Knob") {
            const knobGeo = new THREE.SphereGeometry(1.2, 8, 8);
            if (isDouble) {
              group.add(Object.assign(new THREE.Mesh(knobGeo, metalMat), { position: new THREE.Vector3(-4, 0, depth / 2 + 1.5), frustumCulled: false }));
              group.add(Object.assign(new THREE.Mesh(knobGeo, metalMat), { position: new THREE.Vector3(4, 0, depth / 2 + 1.5), frustumCulled: false }));
            } else {
              group.add(Object.assign(new THREE.Mesh(knobGeo, metalMat), { position: new THREE.Vector3(el.width * 0.35, 0, depth / 2 + 1.5), frustumCulled: false }));
            }
          } else if (el.doorStyle === "Bar handle") {
            const barGeo = new THREE.CylinderGeometry(0.4, 0.4, el.height * 0.3, 8);
            if (isDouble) {
              group.add(Object.assign(new THREE.Mesh(barGeo, metalMat), { position: new THREE.Vector3(-4, 0, depth / 2 + 1), frustumCulled: false }));
              group.add(Object.assign(new THREE.Mesh(barGeo, metalMat), { position: new THREE.Vector3(4, 0, depth / 2 + 1), frustumCulled: false }));
            } else {
              group.add(Object.assign(new THREE.Mesh(barGeo, metalMat), { position: new THREE.Vector3(el.width * 0.35, 0, depth / 2 + 1), frustumCulled: false }));
            }
          } else if (el.doorStyle === "Recessed grip") {
            const gripGeo = new THREE.BoxGeometry(isDouble ? 2 : 1.5, el.height * 0.12, 1.5);
            if (isDouble) {
              addBox(1.5, el.height * 0.12, 1, darkMat, [-0.5, el.height / 2 - el.height * 0.08, depth / 2]);
              addBox(1.5, el.height * 0.12, 1, darkMat, [0.5, el.height / 2 - el.height * 0.08, depth / 2]);
            } else {
              addBox(1.5, el.height * 0.12, 1, darkMat, [el.width / 2 - 2, el.height / 2 - el.height * 0.08, depth / 2]);
            }
          }
        }
      }

      // Legs (for non-open-frame items)
      if (el.legStyle && el.legStyle !== "None" && !isOpenCab && !isStandingShelf) {
        const legH = el.legStyle === "Tall legs" ? 15 : 8;
        const legR = el.legStyle === "Hairpin legs" ? 0.4 : 0.8;
        const legMat2 = new THREE.MeshStandardMaterial({ color: el.legStyle === "Hairpin legs" ? 0x2a2a2a : bodyHex, roughness: 0.5 });
        [[-el.width / 2 + 3, -el.height / 2 - legH / 2, -depth / 2 + 3],
         [el.width / 2 - 3, -el.height / 2 - legH / 2, -depth / 2 + 3],
         [-el.width / 2 + 3, -el.height / 2 - legH / 2, depth / 2 - 3],
         [el.width / 2 - 3, -el.height / 2 - legH / 2, depth / 2 - 3]
        ].forEach(([lx, ly, lz]) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 8), legMat2);
          leg.position.set(lx, ly, lz); leg.castShadow = true; leg.frustumCulled = false; group.add(leg);
        });
      }

      // Legs for standing shelf
      if (isStandingShelf && el.legStyle && el.legStyle !== "None") {
        const legH = el.legStyle === "Tall legs" ? 15 : 8;
        const legR = 0.8;
        const legMat2 = new THREE.MeshStandardMaterial({ color: bodyHex, roughness: 0.5 });
        [[-el.width / 2 + 2, -el.height / 2 - legH / 2, -depth / 2 + 2],
         [el.width / 2 - 2, -el.height / 2 - legH / 2, -depth / 2 + 2],
         [-el.width / 2 + 2, -el.height / 2 - legH / 2, depth / 2 - 2],
         [el.width / 2 - 2, -el.height / 2 - legH / 2, depth / 2 - 2]
        ].forEach(([lx, ly, lz]) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 8), legMat2);
          leg.position.set(lx, ly, lz); leg.castShadow = true; leg.frustumCulled = false; group.add(leg);
        });
      }

      // Brackets for shelves
      if (el.category === "Shelf" && el.mountType === "Bracket-mounted") {
        const bh = Math.min(12, el.height * 3);
        const bd = depth * 0.8;
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4 });
        [-el.width / 3, el.width / 3].forEach(bx => {
          // Vertical part
          addBox(1, bh, 1, bracketMat, [bx, -el.height / 2 - bh / 2, -depth / 3]);
          // Horizontal part
          addBox(1, 1, bd, bracketMat, [bx, -el.height / 2 - 0.5, -depth / 3 + bd / 2 - depth / 2]);
        });
      }

      // Drawer lines + handles
      if (el.drawers > 0 && !isOpenCab && !isStandingShelf) {
        const dh = el.height / el.drawers;
        for (let i = 1; i < el.drawers; i++) {
          addBox(el.width - 2, 0.5, 0.3, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 }), [0, el.height / 2 - dh * i, depth / 2 + 0.2]);
        }
        for (let i = 0; i < el.drawers; i++) {
          const handle = new THREE.Mesh(new THREE.BoxGeometry(el.width * 0.25, 0.8, 1), metalMat);
          handle.position.set(0, el.height / 2 - dh * i - dh / 2, depth / 2 + 0.8);
          handle.frustumCulled = false; group.add(handle);
        }
      }

      // Selection wireframe
      if (isSel) {
        const wire = new THREE.Mesh(new THREE.BoxGeometry(el.width + 2, el.height + 2, depth + 2), new THREE.MeshBasicMaterial({ color: 0xb8884b, wireframe: true, transparent: true, opacity: 0.6 }));
        wire.frustumCulled = false; group.add(wire);
      }

      group.position.set(el.x + el.width / 2, project.wallHeight - el.y - el.height / 2, depth / 2 + 0.5);
      scene.add(group);
      meshMap[el.id] = group;
    });
  }, [project, selected]);

  return (
    <div ref={mountRef} style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{ position: "absolute", bottom: 12, left: 12, fontSize: 11, color: C.textMuted, background: "rgba(255,255,255,0.85)", padding: "5px 10px", borderRadius: 6, pointerEvents: "none" }}>
        Drag to orbit · Right-drag to pan · Scroll to zoom
      </div>
    </div>
  );
}
