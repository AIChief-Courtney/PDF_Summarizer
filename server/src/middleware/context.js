import { db, getDefaultContext } from "../db.js";

export function attachContext(req, res, next) {
  const defaults = getDefaultContext();
  const workspaceId =
    req.headers["x-workspace-id"]?.toString() || defaults.workspaceId;
  const patientId =
    req.headers["x-patient-id"]?.toString() || defaults.patientId;

  const patient = db
    .prepare("SELECT * FROM patients WHERE id = ? AND workspace_id = ?")
    .get(patientId, workspaceId);

  if (!patient) {
    res.status(403).json({
      error: { code: "FORBIDDEN", message: "Invalid workspace or patient." },
    });
    return;
  }

  req.context = { workspaceId, patientId, patient };
  next();
}
