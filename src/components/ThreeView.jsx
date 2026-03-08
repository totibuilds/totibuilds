import { useRef, useEffect } from "react";
import * as THREE from "three";
import { C, clamp } from "../utils/constants";
import { Icon } from "./UI";

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

    mouseRef.current.dist = Math.max(project.wallWidth, project.wallHeight) * 1.4;
    mouseRef.current.targetX = project.wallWidth / 2;
    mouseRef.current.targetY = project.wallHeight / 2;

    const updateCam = () => {
      const m = mouseRef.current;
      m.theta = clamp(m.theta, -Math.PI / 2.2, Math.PI / 2.2);
      m.phi = clamp(m.phi, -0.1, Math.PI / 3);
      camera.position.set(
        m.targetX + m.dist * Math.sin(m.theta) * Math.cos(m.phi),
        m.targetY + m.dist * Math.sin(m.phi),
        m.dist * Math.cos(m.theta) * Math.cos(m.phi)
      );
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
      if (mouseRef.current.btn === 2 || e.shiftKey) {
        mouseRef.current.targetX -= dx * 0.5;
        mouseRef.current.targetY += dy * 0.5;
      } else {
        mouseRef.current.theta -= dx * 0.005;
        mouseRef.current.phi += dy * 0.005;
      }
      updateCam();
    };
    const onWheel = e => { e.preventDefault(); mouseRef.current.dist = clamp(mouseRef.current.dist + e.deltaY * 0.7, 100, 2500); updateCam(); };
    const onCtx = e => e.preventDefault();

    const cv = renderer.domElement;
    cv.addEventListener("mousedown", onDown);
    cv.addEventListener("contextmenu", onCtx);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    cv.addEventListener("wheel", onWheel, { passive: false });

    const ro = new ResizeObserver(() => {
      const nw = mount.clientWidth, nh = mount.clientHeight;
      camera.aspect = nw / nh; camera.updateProjectionMatrix(); renderer.setSize(nw, nh);
    });
    ro.observe(mount);

    return () => {
      cancelAnimationFrame(frameRef.current);
      cv.removeEventListener("mousedown", onDown);
      cv.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      cv.removeEventListener("wheel", onWheel);
      ro.disconnect();
      renderer.dispose();
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

    const wallColor = project.wallColor || "#f5f0e6";
    const wallMesh = new THREE.Mesh(
      new THREE.BoxGeometry(project.wallWidth, project.wallHeight, 2),
      new THREE.MeshStandardMaterial({ color: wallColor, roughness: 0.92 })
    );
    wallMesh.name = "_wall";
    wallMesh.position.set(project.wallWidth / 2, project.wallHeight / 2, -1);
    wallMesh.receiveShadow = true;
    scene.add(wallMesh);

    const floorMesh = new THREE.Mesh(
      new THREE.BoxGeometry(project.wallWidth * 1.8, 1, project.wallWidth),
      new THREE.MeshStandardMaterial({ color: 0x8b4a2b, roughness: 0.55 })
    );
    floorMesh.name = "_floor";
    floorMesh.position.set(project.wallWidth / 2, -0.5, project.wallWidth * 0.4);
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const cur = new Set(project.elements.map(e => e.id));
    Object.keys(meshMap).forEach(id => {
      if (!cur.has(id)) { scene.remove(meshMap[id]); delete meshMap[id]; }
    });

    project.elements.forEach(el => {
      const depth = Math.max(el.depth || 15, 2);
      const bodyHex = el.bodyColor || "#8b6b3d";
      const frontHex = el.frontColor || bodyHex;
      const isSel = el.id === selected;
      const roughness = el.bodyMaterial === "Metal" ? 0.25 : el.bodyMaterial === "Glass" ? 0.1 : 0.7;

      // Always recreate to avoid stale state issues
      if (meshMap[el.id]) {
        scene.remove(meshMap[el.id]);
        delete meshMap[el.id];
      }

      const group = new THREE.Group();
      group.name = el.id;
      // FIX: disable frustum culling on group to prevent disappearing
      group.frustumCulled = false;

      // Main body
      const mats = [];
      for (let i = 0; i < 6; i++) {
        const isFront = i === 4;
        mats.push(new THREE.MeshStandardMaterial({
          color: isFront ? frontHex : bodyHex,
          roughness,
          transparent: el.bodyMaterial === "Glass",
          opacity: el.bodyMaterial === "Glass" ? 0.4 : 1,
        }));
      }

      if (el.imageData && el.category === "Artwork") {
        const loader = new THREE.TextureLoader();
        loader.load(el.imageData, tex => {
          mats[4] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
          body.material = [...mats];
        });
      }

      const body = new THREE.Mesh(new THREE.BoxGeometry(el.width, el.height, depth), mats);
      body.castShadow = true;
      body.receiveShadow = true;
      body.frustumCulled = false;
      group.add(body);

      // Legs
      if (el.legStyle && el.legStyle !== "None") {
        const legH = el.legStyle === "Tall legs" ? 15 : 8;
        const legR = el.legStyle === "Hairpin legs" ? 0.4 : 0.8;
        const legMat = new THREE.MeshStandardMaterial({ color: el.legStyle === "Hairpin legs" ? 0x2a2a2a : bodyHex, roughness: 0.5 });
        [[-el.width / 2 + 3, -el.height / 2 - legH / 2, -depth / 2 + 3],
         [el.width / 2 - 3, -el.height / 2 - legH / 2, -depth / 2 + 3],
         [-el.width / 2 + 3, -el.height / 2 - legH / 2, depth / 2 - 3],
         [el.width / 2 - 3, -el.height / 2 - legH / 2, depth / 2 - 3]
        ].forEach(([lx, ly, lz]) => {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(legR, legR, legH, 8), legMat);
          leg.position.set(lx, ly, lz);
          leg.castShadow = true;
          leg.frustumCulled = false;
          group.add(leg);
        });
      }

      // Drawer lines
      if (el.drawers > 0) {
        const dh = el.height / el.drawers;
        for (let i = 1; i < el.drawers; i++) {
          const line = new THREE.Mesh(
            new THREE.BoxGeometry(el.width - 2, 0.5, 0.3),
            new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.15 })
          );
          line.position.set(0, el.height / 2 - dh * i, depth / 2 + 0.2);
          line.frustumCulled = false;
          group.add(line);
        }
        for (let i = 0; i < el.drawers; i++) {
          const handle = new THREE.Mesh(
            new THREE.BoxGeometry(el.width * 0.25, 0.8, 1),
            new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3 })
          );
          handle.position.set(0, el.height / 2 - dh * i - dh / 2, depth / 2 + 0.8);
          handle.frustumCulled = false;
          group.add(handle);
        }
      }

      // Selection wireframe
      if (isSel) {
        const wire = new THREE.Mesh(
          new THREE.BoxGeometry(el.width + 2, el.height + 2, depth + 2),
          new THREE.MeshBasicMaterial({ color: 0xb8884b, wireframe: true, transparent: true, opacity: 0.6 })
        );
        wire.frustumCulled = false;
        group.add(wire);
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
