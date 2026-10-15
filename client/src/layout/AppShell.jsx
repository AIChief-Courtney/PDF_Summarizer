import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar.jsx";
import { EvidenceDrawer } from "./EvidenceDrawer.jsx";
import { useEvidence } from "../state/EvidenceContext.jsx";
import "../styles/shell.css";

export function AppShell() {
  const { evidence, closeEvidence, drawerOpen } = useEvidence();

  return (
    <div className="shell">
      <Sidebar />
      <div className={`shell__main${drawerOpen ? " shell__main--drawer" : ""}`}>
        <Outlet />
      </div>
      <EvidenceDrawer open={drawerOpen} evidence={evidence} onClose={closeEvidence} />
    </div>
  );
}
