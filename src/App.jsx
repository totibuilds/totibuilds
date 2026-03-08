import { useState, useEffect, useRef, useCallback } from "react";
import { C, uid, storageGet, storageSet } from "./utils/constants";
import { Icon, Btn } from "./components/UI";
import { HomeScreen, AssetLibrary, NewProjectModal } from "./components/Screens";
import AssetModal from "./components/AssetModal";
import ProjectView from "./components/ProjectView";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [projects, setProjects] = useState([]);
  const [assets, setAssets] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [showAssetModal, setShowAssetModal] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const p = await storageGet("projects");
      const a = await storageGet("assets");
      if (p) setProjects(p);
      if (a) setAssets(a);
      setLoaded(true);
    })();
  }, []);

  const saveTimer = useRef(null);
  const save = useCallback((p, a) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storageSet("projects", p);
      storageSet("assets", a);
    }, 400);
  }, []);

  // Use refs to avoid stale closures in save
  const projectsRef = useRef(projects);
  const assetsRef = useRef(assets);
  useEffect(() => { projectsRef.current = projects; }, [projects]);
  useEffect(() => { assetsRef.current = assets; }, [assets]);

  const updP = fn => setProjects(prev => { const n = fn(prev); save(n, assetsRef.current); return n; });
  const updA = fn => setAssets(prev => { const n = fn(prev); save(projectsRef.current, n); return n; });

  const activeProject = projects.find(p => p.id === activeProjectId);
  const updAP = fn => updP(prev => prev.map(p => p.id === activeProjectId ? fn(p) : p));

  // Handler for adding asset from within project view
  const handleAddAssetFromProject = useCallback((asset) => {
    updA(prev => [...prev, asset]);
  }, []);

  const [showWelcome, setShowWelcome] = useState(false);

  // Check if first visit
  useEffect(() => {
    if (loaded) {
      storageGet("onboarded").then(val => { if (!val) setShowWelcome(true); });
    }
  }, [loaded]);

  const dismissWelcome = () => {
    setShowWelcome(false);
    storageSet("onboarded", true);
  };

  if (!loaded) {
    return <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim }}>Loading TotiBuilds...</div>;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
      {/* Welcome overlay */}
      {showWelcome && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(58,48,40,0.5)", backdropFilter: "blur(6px)" }}>
          <div style={{ background: C.surface, borderRadius: 20, padding: 40, maxWidth: 460, width: "90vw", textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 20 }}>
              <Icon type="layers" size={28} color={C.accent} />
              <span style={{ fontSize: 24, fontWeight: 700 }}>Toti<span style={{ color: C.accent }}>Builds</span></span>
            </div>
            <p style={{ fontSize: 15, color: C.text, marginBottom: 24, lineHeight: 1.5 }}>Plan your walls and spaces.<br/>Visualize your furniture, shelves, and artwork<br/>before you pick up a drill.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, textAlign: "left", marginBottom: 28, padding: "0 20px" }}>
              {[
                { n: "1", t: "Create your assets", d: "Add your shelves, cabinets, artwork — with real dimensions and colors" },
                { n: "2", t: "Start a project", d: "Set up a wall with your dimensions" },
                { n: "3", t: "Place & arrange", d: "Drag assets onto the wall, snap to guides, check the 3D view" },
                { n: "4", t: "Get design tips", d: "Built-in suggestions for spacing, height, and balance" },
              ].map(s => (
                <div key={s.n} style={{ display: "flex", gap: 12, alignItems: "start" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 14, background: C.accent, color: C.white, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{s.n}</div>
                  <div><p style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{s.t}</p><p style={{ fontSize: 12, color: C.textDim, marginTop: 2 }}>{s.d}</p></div>
                </div>
              ))}
            </div>
            <Btn variant="accent" onClick={dismissWelcome} style={{ padding: "10px 32px", fontSize: 14, borderRadius: 12 }}>Get Started</Btn>
          </div>
        </div>
      )}
      {/* Topbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 24px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        {screen !== "home" && <Btn variant="ghost" small onClick={() => setScreen("home")}><Icon type="back" size={16} /> Back</Btn>}
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => setScreen("home")}>
          <Icon type="layers" size={20} color={C.accent} />
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em", color: C.text }}>
            Toti<span style={{ color: C.accent }}>Builds</span>
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <Btn variant="accent" small onClick={() => setScreen("library")} style={{ borderRadius: 20, padding: "6px 16px" }}>
          <Icon type="grid" size={15} color={C.white} /> Asset Library
          {assets.length > 0 && <span style={{ background: "rgba(255,255,255,0.25)", color: C.white, padding: "1px 6px", borderRadius: 10, fontSize: 11, fontWeight: 600 }}>{assets.length}</span>}
        </Btn>
      </div>

      {screen === "home" && (
        <HomeScreen
          projects={projects}
          onOpen={id => { setActiveProjectId(id); setScreen("project"); }}
          onNew={() => setShowNewProject(true)}
          onDelete={id => updP(p => p.filter(x => x.id !== id))}
          onDuplicate={id => {
            const src = projects.find(p => p.id === id);
            if (src) updP(p => [...p, { ...JSON.parse(JSON.stringify(src)), id: uid(), name: src.name + " (copy)" }]);
          }}
          onRename={(id, name) => updP(p => p.map(x => x.id === id ? { ...x, name } : x))}
        />
      )}

      {screen === "library" && (
        <AssetLibrary
          assets={assets}
          onAdd={() => setShowAssetModal("new")}
          onEdit={a => setShowAssetModal(a)}
          onDelete={id => updA(a => a.filter(x => x.id !== id))}
          onDuplicate={a => updA(prev => [...prev, { ...JSON.parse(JSON.stringify(a)), id: uid(), name: a.name + " (copy)" }])}
        />
      )}

      {screen === "project" && activeProject && (
        <ProjectView
          project={activeProject}
          assets={assets}
          onUpdate={updAP}
          onAddAsset={handleAddAssetFromProject}
        />
      )}

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreate={p => { updP(prev => [...prev, p]); setShowNewProject(false); }}
        />
      )}

      {showAssetModal && (
        <AssetModal
          asset={showAssetModal === "new" ? null : showAssetModal}
          onClose={() => setShowAssetModal(null)}
          onSave={a => {
            if (showAssetModal === "new") updA(prev => [...prev, a]);
            else updA(prev => prev.map(x => x.id === a.id ? a : x));
            setShowAssetModal(null);
          }}
        />
      )}
    </div>
  );
}
