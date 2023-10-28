const { Queue } = require("../../../models/queue");

async function createDeleteEmbeddingJob(
  documentVector,
  workspace,
  organization,
  connector,
  user
) {
  const taskName = `${connector.type}/deleteFragment`;
  const jobData = { documentVector, workspace, organization, connector };
  const { job, error } = await Queue.create(
    taskName,
    jobData,
    user.id,
    organization.id
  );
  if (!!error) return { job, error };
  await Queue.sendJob({
    name: taskName,
    data: {
      jobId: job.id,
      ...jobData,
    },
  });
  return { job, error: null };
}

module.exports = {
  createDeleteEmbeddingJob,
};
