import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export function Settings() {
  const [workspace, setWorkspace] = useState(null);

  useEffect(() => {
    api.workspace().then(setWorkspace).catch(() => {});
  }, []);

  return (
    <div className="page">
      <h1 className="page__title">Settings</h1>
      <div className="panel">
        <h2 className="panel__title">Workspace</h2>
        <p>Workspace ID: {workspace?.workspaceId}</p>
        <p>Active patient: {workspace?.patientId}</p>
        <p>{workspace?.services?.ai}</p>
        <p>Web search: {workspace?.services?.web}</p>
        <p className="page__lede">
          Authentication and multi-tenant RBAC are not yet enabled in this
          build; headers select the demo workspace/patient.
        </p>
      </div>
    </div>
  );
}
