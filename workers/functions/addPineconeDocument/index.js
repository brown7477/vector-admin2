const { Queue } = require('../../../backend/models/queue');
const {
  Pinecone,
} = require('../../../backend/utils/vectordatabases/providers/pinecone');
const { InngestClient } = require('../../utils/inngest');
const { SystemSettings } = require('../../../backend/models/systemSettings');
const {
  WorkspaceDocument,
} = require('../../../backend/models/workspaceDocument');
const { vectorSpaceMetric } = require('../../utils/telemetryHelpers');

const addPineconeDocuments = InngestClient.createFunction(
  { name: 'Add and Embed documents into PineconeDB' },
  { event: 'pinecone/addDocument' },
  async ({ event, step: _step, logger }) => {
    var result = {};
    // Sometimes the passed in document may have very large pageContent, so we load it from the DB
    // instead of passing it on the event object - which will crash Inngest.
    const { jobId } = event.data;
    const job = await Queue.get({ id: Number(jobId) });

    if (!job) {
      result = {
        message: `No job data found for this operation.`,
      };
      await Queue.updateJob(jobId, Queue.status.failed, result);
      return { result };
    }

    const { documents, organization, workspace, connector } = JSON.parse(
      job.data
    );
    try {
      const openAiSetting = await SystemSettings.get({
        label: 'open_ai_api_key',
      });
      if (!openAiSetting) {
        result = {
          message: `No OpenAI Key set for instance to be used for embedding - aborting`,
        };
        await Queue.updateJob(jobId, Queue.status.failed, result);
        return { result };
      }

      const pineconeClient = new Pinecone(connector);
      const dimensions = await pineconeClient.indexDimensions();
      if (dimensions !== 1536) {
        result = {
          message: `Cannot use OpenAi 1536 embedding on index that is ${dimensions} dimensions - aborting.`,
        };
        await Queue.updateJob(jobId, Queue.status.failed, result);
        return { result };
      }

      const { pineconeIndex } = await pineconeClient.connect();
      for (const document of documents) {
        const exists = await WorkspaceDocument.get({
          name: document.title,
          workspace_id: Number(workspace.id),
        });
        if (exists) {
          result.files = {
            [document.title]: { skipped: true },
          };
          continue;
        }

        const { document: dbDocument, message: dBInsertResponse } =
          await WorkspaceDocument.create({
            id: document.id,
            name: document.title,
            workspaceId: workspace.id,
            organizationId: organization.id,
          });

        if (!dbDocument) {
          result = {
            message: `Failed to create document ${document.id} ${document.title} - aborting`,
            dBInsertResponse,
          };
          await Queue.updateJob(jobId, Queue.status.failed, result);
          return { result };
        }

        const { success, message: insertResponse } =
          await pineconeClient.processDocument(
            workspace.fname,
            document,
            openAiSetting.value,
            dbDocument,
            pineconeIndex
          );

        if (!success)
          await WorkspaceDocument.delete({ id: Number(dbDocument.id) });
        result.files = {
          [document.title]: {
            skipped: false,
            createStatus: success,
            message: insertResponse,
          },
        };
      }

      result = { ...result, message: `Document processing complete` };
      await Queue.updateJob(jobId, Queue.status.complete, result);
      await vectorSpaceMetric();
      return { result };
    } catch (e) {
      const result = {
        message: `Job failed with error`,
        error: e.message,
        details: e,
      };
      await Queue.updateJob(jobId, Queue.status.failed, result);
      return { result };
    }
  }
);

module.exports = {
  addPineconeDocuments,
};
