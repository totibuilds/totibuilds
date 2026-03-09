import { useRef, useEffect } from "react";
import * as THREE from "three";
import { C, clamp } from "../utils/constants";

function makeMesh(geo, mat, pos, group) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos[0], pos[1], pos[2]);
  m.castShadow = true;
  m.receiveShadow = true;
  m.frustumCulled = false;
  group.add(m);
  return m;
}

export default function ThreeView({ project, selected }) {
  const mountRef = useRef(null);
  const stRef = useRef({ ready: false });
  const frameRef = useRef(null);
  const mouseRef = useRef({ down: false, btn: 0, x: 0, y: 0, theta: 0, phi: Math.PI / 8, dist: 0, tx: 0, ty: 0 });

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const w = mount.clientWidth, h = mount.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf7f3ed);
    scene.add(new THREE.AmbientLight(0xfff5e6, 0.55));
    const ceil = new THREE.PointLight(0xffe4c4, 0.85, 1500);
    ceil.position.set(project.wallWidth / 2, project.wallHeight + 80, project.wallWidth * 0.3);
    ceil.castShadow = true;
    scene.add(ceil);
    const fill = new THREE.DirectionalLight(0xfff0dd, 0.3);
    fill.position.set(-150, 100, 300);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(42, w / h, 1, 8000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const m = mouseRef.current;
    m.dist = Math.max(project.wallWidth, project.wallHeight) * 1.4;
    m.tx = project.wallWidth / 2;
    m.ty = project.wallHeight / 2;

    const updateCam = () => {
      const m = mouseRef.current;
      m.theta = clamp(m.theta, -Math.PI / 2.2, Math.PI / 2.2);
      m.phi = clamp(m.phi, -0.1, Math.PI / 3);
      camera.position.set(
        m.tx + m.dist * Math.sin(m.theta) * Math.cos(m.phi),
        m.ty + m.dist * Math.sin(m.phi),
        m.dist * Math.cos(m.theta) * Math.cos(m.phi)
      );
      camera.lookAt(m.tx, m.ty, 0);
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
      if (mouseRef.current.btn === 2 || e.shiftKey) { mouseRef.current.tx -= dx * 0.5; mouseRef.current.ty += dy * 0.5; }
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

  // Sync elements
  useEffect(() => {
    const st = stRef.current;
    if (!st.ready) return;
    const { scene, meshMap } = st;

    ["_wall", "_floor"].forEach(n => { const o = scene.getObjectByName(n); if (o) scene.remove(o); });
    const wc = project.wallColor || "#f5f0e6";
    makeMesh(new THREE.BoxGeometry(project.wallWidth, project.wallHeight, 2), new THREE.MeshStandardMaterial({ color: wc, roughness: 0.92 }), [project.wallWidth / 2, project.wallHeight / 2, -1], scene).name = "_wall";
    makeMesh(new THREE.BoxGeometry(project.wallWidth * 1.8, 1, project.wallWidth), new THREE.MeshStandardMaterial({ color: 0x8b4a2b, roughness: 0.55 }), [project.wallWidth / 2, -0.5, project.wallWidth * 0.4], scene).name = "_floor";

    const cur = new Set(project.elements.map(e => e.id));
    Object.keys(meshMap).forEach(id => { if (!cur.has(id)) { scene.remove(meshMap[id]); delete meshMap[id]; } });

    project.elements.forEach(el => {
      if (meshMap[el.id]) { scene.remove(meshMap[el.id]); delete meshMap[el.id]; }

      const dp = Math.max(el.depth || 15, 2);
      const bHex = el.bodyColor || "#8b6b3d";
      const fHex = el.frontColor || bHex;
      const isSel = el.id === selected;
      const rough = el.bodyMaterial === "Metal" ? 0.25 : el.bodyMaterial === "Glass" ? 0.1 : 0.7;
      const bMat = () => new THREE.MeshStandardMaterial({ color: bHex, roughness: rough });
      const fMat = () => new THREE.MeshStandardMaterial({ color: fHex, roughness: rough });
      const metalM = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3 });

      const g = new THREE.Group();
      g.name = el.id;
      g.frustumCulled = false;

      const isOpen = el.category === "Cabinet" && (el.doorConfig === "No door" || el.doorStyle === "Open / no door");
      const isSS = el.category === "Standing Shelf";

      if (isOpen || isSS) {
        // Open frame with shelves
        const t = 1.5;
        const cnt = isSS ? (el.shelfCount || 4) : 3;
        makeMesh(new THREE.BoxGeometry(t, el.height, dp), bMat(), [-el.width / 2 + t / 2, 0, 0], g);
        makeMesh(new THREE.BoxGeometry(t, el.height, dp), bMat(), [el.width / 2 - t / 2, 0, 0], g);
        makeMesh(new THREE.BoxGeometry(el.width, t, dp), bMat(), [0, el.height / 2 - t / 2, 0], g);
        makeMesh(new THREE.BoxGeometry(el.width, t, dp), bMat(), [0, -el.height / 2 + t / 2, 0], g);
        makeMesh(new THREE.BoxGeometry(el.width - t * 2, el.height - t * 2, 0.5), new THREE.MeshStandardMaterial({ color: bHex, roughness: 0.9 }), [0, 0, -dp / 2 + 0.25], g);
        const secH = el.height / cnt;
        for (let i = 1; i < cnt; i++) {
          makeMesh(new THREE.BoxGeometry(el.width - t * 2, t, dp - 1), bMat(), [0, el.height / 2 - secH * i, 0], g);
        }
      } else if (el.category === "Artwork") {
        const fw = el.frameType === "Thick traditional frame" ? 4 : (el.frameType === "Thin modern frame" || el.frameType === "Floating frame") ? 2 : 0;
        const mw = el.matWidth || 0;
        const frameMat = new THREE.MeshStandardMaterial({ color: bHex, roughness: 0.6 });

        if (fw > 0) {
          makeMesh(new THREE.BoxGeometry(el.width, fw, dp), frameMat, [0, el.height / 2 - fw / 2, 0], g);
          makeMesh(new THREE.BoxGeometry(el.width, fw, dp), frameMat, [0, -el.height / 2 + fw / 2, 0], g);
          makeMesh(new THREE.BoxGeometry(fw, el.height - fw * 2, dp), frameMat, [-el.width / 2 + fw / 2, 0, 0], g);
          makeMesh(new THREE.BoxGeometry(fw, el.height - fw * 2, dp), frameMat, [el.width / 2 - fw / 2, 0, 0], g);
        }

        if (mw > 0) {
          makeMesh(new THREE.BoxGeometry(el.width - fw * 2, el.height - fw * 2, dp * 0.3), new THREE.MeshStandardMaterial({ color: 0xf5f2eb, roughness: 0.9 }), [0, 0, dp * 0.05], g);
          const artW = el.width - fw * 2 - mw * 2, artH = el.height - fw * 2 - mw * 2;
          if (artW > 0 && artH > 0) {
            const am = new THREE.MeshStandardMaterial({ color: el.imageData ? 0xffffff : fHex, roughness: 0.8 });
            if (el.imageData) { new THREE.TextureLoader().load(el.imageData, tex => { am.map = tex; am.needsUpdate = true; }); }
            makeMesh(new THREE.BoxGeometry(artW, artH, 1), am, [0, 0, dp * 0.25], g);
          }
        } else {
          const am = new THREE.MeshStandardMaterial({ color: el.imageData ? 0xffffff : fHex, roughness: 0.8 });
          if (el.imageData) { new THREE.TextureLoader().load(el.imageData, tex => { am.map = tex; am.needsUpdate = true; }); }
          makeMesh(new THREE.BoxGeometry(el.width - fw * 2, el.height - fw * 2, dp * 0.8), am, [0, 0, fw > 0 ? dp * 0.05 : 0], g);
        }
      } else {
        // Standard box
        const mats = [];
        for (let i = 0; i < 6; i++) mats.push(new THREE.MeshStandardMaterial({ color: i === 4 ? fHex : bHex, roughness: rough, transparent: el.bodyMaterial === "Glass", opacity: el.bodyMaterial === "Glass" ? 0.4 : 1 }));
        const body = new THREE.Mesh(new THREE.BoxGeometry(el.width, el.height, dp), mats);
        body.castShadow = true; body.receiveShadow = true; body.frustumCulled = false;
        g.add(body);

        // Double door line
        if (el.category === "Cabinet" && el.doorConfig === "Double doors") {
          makeMesh(new THREE.BoxGeometry(0.3, el.height - 2, 0.3), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.12 }), [0, 0, dp / 2 + 0.2], g);
        }

        // Handles
        if (el.category === "Cabinet" && el.doorStyle && el.doorStyle !== "Plain / handleless" && el.doorStyle !== "Open / no door") {
          const dbl = el.doorConfig === "Double doors";
          const hZ = dp / 2 + 1.2;

          if (el.doorStyle === "Knob") {
            const kg = new THREE.SphereGeometry(1.2, 8, 8);
            if (dbl) {
              makeMesh(kg, metalM, [-4, 0, hZ], g);
              makeMesh(kg, metalM, [4, 0, hZ], g);
            } else {
              makeMesh(kg, metalM, [el.width * 0.35, 0, hZ], g);
            }
          } else if (el.doorStyle === "Bar handle") {
            const bg = new THREE.CylinderGeometry(0.4, 0.4, el.height * 0.3, 8);
            if (dbl) {
              makeMesh(bg, metalM, [-4, 0, hZ], g);
              makeMesh(bg, metalM, [4, 0, hZ], g);
            } else {
              makeMesh(bg, metalM, [el.width * 0.35, 0, hZ], g);
            }
          } else if (el.doorStyle === "Recessed grip") {
            const rg = new THREE.BoxGeometry(dbl ? 1.5 : 1.5, el.height * 0.12, 1);
            const darkM = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5 });
            if (dbl) {
              makeMesh(rg, darkM, [-0.5, el.height / 2 - el.height * 0.08, dp / 2], g);
              makeMesh(rg, darkM, [0.5, el.height / 2 - el.height * 0.08, dp / 2], g);
            } else {
              makeMesh(rg, darkM, [el.width / 2 - 2, el.height / 2 - el.height * 0.08, dp / 2], g);
            }
          }
        }
      }

      // Legs
      if (el.legStyle && el.legStyle !== "None" && !isOpen && !isSS) {
        const lH = el.legStyle === "Tall legs" ? 15 : 8;
        const lR = el.legStyle === "Hairpin legs" ? 0.4 : 0.8;
        const lM = new THREE.MeshStandardMaterial({ color: el.legStyle === "Hairpin legs" ? 0x2a2a2a : bHex, roughness: 0.5 });
        const lg = new THREE.CylinderGeometry(lR, lR, lH, 8);
        [[-el.width / 2 + 3, -el.height / 2 - lH / 2, -dp / 2 + 3],
         [el.width / 2 - 3, -el.height / 2 - lH / 2, -dp / 2 + 3],
         [-el.width / 2 + 3, -el.height / 2 - lH / 2, dp / 2 - 3],
         [el.width / 2 - 3, -el.height / 2 - lH / 2, dp / 2 - 3]
        ].forEach(p => makeMesh(lg, lM, p, g));
      }
      if (isSS && el.legStyle && el.legStyle !== "None") {
        const lH = el.legStyle === "Tall legs" ? 15 : 8;
        const lM = new THREE.MeshStandardMaterial({ color: bHex, roughness: 0.5 });
        const lg = new THREE.CylinderGeometry(0.8, 0.8, lH, 8);
        [[-el.width / 2 + 2, -el.height / 2 - lH / 2, -dp / 2 + 2],
         [el.width / 2 - 2, -el.height / 2 - lH / 2, -dp / 2 + 2],
         [-el.width / 2 + 2, -el.height / 2 - lH / 2, dp / 2 - 2],
         [el.width / 2 - 2, -el.height / 2 - lH / 2, dp / 2 - 2]
        ].forEach(p => makeMesh(lg, lM, p, g));
      }

      // Brackets
      if (el.category === "Shelf" && el.mountType === "Bracket-mounted") {
        const bh = Math.min(12, el.height * 3);
        const bracketM = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.4 });
        [-el.width / 3, el.width / 3].forEach(bx => {
          makeMesh(new THREE.BoxGeometry(1, bh, 1), bracketM, [bx, -el.height / 2 - bh / 2, -dp / 3], g);
          makeMesh(new THREE.BoxGeometry(1, 1, dp * 0.8), bracketM, [bx, -el.height / 2 - 0.5, 0], g);
        });
      }

      // Drawers
      if (el.drawers > 0 && !isOpen && !isSS) {
        const dh = el.height / el.drawers;
        for (let i = 1; i < el.drawers; i++) {
          makeMesh(new THREE.BoxGeometry(el.width - 2, 0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.15 }), [0, el.height / 2 - dh * i, dp / 2 + 0.2], g);
        }
        for (let i = 0; i < el.drawers; i++) {
          makeMesh(new THREE.BoxGeometry(el.width * 0.25, 0.8, 1), metalM, [0, el.height / 2 - dh * i - dh / 2, dp / 2 + 0.8], g);
        }
      }

      // Selection
      if (isSel) {
        makeMesh(new THREE.BoxGeometry(el.width + 2, el.height + 2, dp + 2), new THREE.MeshBasicMaterial({ color: 0xb8884b, wireframe: true, transparent: true, opacity: 0.6 }), [0, 0, 0], g);
      }

      g.position.set(el.x + el.width / 2, project.wallHeight - el.y - el.height / 2, dp / 2 + 0.5);
      scene.add(g);
      meshMap[el.id] = g;
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
