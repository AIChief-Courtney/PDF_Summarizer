import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/documents", label: "Documents" },
  { to: "/summaries", label: "Summaries" },
  { to: "/ask", label: "Ask AI" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar__brand">
        <span className="sidebar__logo">Clinical Docs</span>
        <span className="sidebar__tag">Summarizer</span>
      </div>
      <nav className="sidebar__nav">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `sidebar__link${isActive ? " sidebar__link--active" : ""}`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
      <div className="sidebar__patient">
        <span className="sidebar__patient-label">Patient workspace</span>
        <strong>{localStorage.getItem("patientLabel") || "Primary record"}</strong>
      </div>
    </aside>
  );
}
