import { db } from "../server/src/db.js";
import { kickJobQueue } from "../server/src/services/jobRunner.js";

const r = db
  .prepare(
    "UPDATE jobs SET status = 'queued', progress = 0, error_message = NULL WHERE status = 'running'"
  )
  .run();
console.log("Requeued running jobs:", r.changes);
kickJobQueue();
