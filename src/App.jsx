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

  if (!loaded) {
    return <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.textDim }}>Loading TotiBuilds...</div>;
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: C.bg, color: C.text, minHeight: "100vh" }}>
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
