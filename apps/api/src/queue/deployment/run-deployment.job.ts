// Payload shape for the "run-deployment" BullMQ job.
// Kept intentionally minimal — just a pointer to the Deployment row.
// The processor always reloads the row from Postgres so it never acts
// on stale data (e.g., if the project was renamed between enqueue and
// execution).
export interface RunDeploymentJobData {
  deploymentId: string;
}
