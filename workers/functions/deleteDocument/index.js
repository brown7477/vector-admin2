const { Queue } = require('../../../backend/models/queue');
const {
  Chroma,
} = require('../../../backend/utils/vectordatabases/providers/chroma');
const { InngestClient } = require('../../utils/inngest');
const {
  WorkspaceDocument,
} = require('../../../backend/models/workspaceDocument');
const { DocumentVectors } = require('../../../backend/models/documentVectors');
const { deleteVectorCacheFile } = require('../../../backend/utils/storage');
const {
  Pinecone,
} = require('../../../backend/utils/vectordatabases/providers/pinecone');
const {
  QDrant,
} = require('../../../backend/utils/vectordatabases/providers/qdrant');
const {
  Weaviate,
} = require('../../../backend/utils/vectordatabases/providers/weaviate');

const deleteChromaDocument = InngestClient.createFunction(
  { name: 'Delete Document From ChromaDB' },
  { event: 'chroma/deleteDocument' },
  async ({ event, step: _step, logger }) => {
    var result = {};
    const { workspace, document, connector, jobId } = event.data;
    try {
      const chromaClient = new Chroma(connector);
      const { client } = await chromaClient.connect();
      const collection = await client.getCollection({ name: workspace.fname });

      const vectors = await DocumentVectors.where({
        document_id: Number(document.id),
      });
      const vectorIds = vectors.map((vector) => vector.vectorId);
      await collection.delete({ ids: vectorIds });
      await WorkspaceDocument.delete({ id: Number(document.id) });
      await deleteVectorCacheFile(WorkspaceDocument.vectorFilename(document));

      result = {
        message: `Document ${document.name} removed from Chroma collection ${workspace.name}.`,
      };
      await Queue.updateJob(jobId, Queue.status.complete, result);
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

const deletePineconeDocument = InngestClient.createFunction(
  { name: 'Delete Document From PineconeDB' },
  { event: 'pinecone/deleteDocument' },
  async ({ event, step: _step, logger }) => {
    var result = {};
    const { workspace, document, connector, jobId } = event.data;
    try {
      const pineconeClient = new Pinecone(connector);
      const { pineconeIndex } = await pineconeClient.connect();
      const hasNamespace = await pineconeClient.namespaceExists(
        pineconeIndex,
        workspace.fname
      );

      if (!hasNamespace) {
        result = {
          message: `No namespace found with name ${workspace.fname} - nothing to do.`,
        };
        await Queue.updateJob(jobId, Queue.status.failed, result);
        return { result };
      }

      const vectors = await DocumentVectors.where({
        document_id: Number(document.id),
      });
      const vectorIds = vectors.map((vector) => vector.vectorId);

      await pineconeIndex.delete1({
        ids: vectorIds,
        namespace: workspace.fname,
      });
      await WorkspaceDocument.delete({ id: Number(document.id) });
      await deleteVectorCacheFile(WorkspaceDocument.vectorFilename(document));

      result = {
        message: `Document ${document.name} removed from ${connector.type} collection ${workspace.name}.`,
      };
      await Queue.updateJob(jobId, Queue.status.complete, result);
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

const deleteQdrantDocument = InngestClient.createFunction(
  { name: 'Delete Document From QDrant' },
  { event: 'qdrant/deleteDocument' },
  async ({ event, step: _step, logger }) => {
    var result = {};
    const { workspace, document, connector, jobId } = event.data;
    try {
      const qdrantClient = new QDrant(connector);
      const { client } = await qdrantClient.connect();
      const hasNamespace = await qdrantClient.namespaceExists(
        client,
        workspace.fname
      );

      if (!hasNamespace) {
        result = {
          message: `No namespace found with name ${workspace.fname} - nothing to do.`,
        };
        await Queue.updateJob(jobId, Queue.status.failed, result);
        return { result };
      }

      const vectors = await DocumentVectors.where({
        document_id: Number(document.id),
      });
      const vectorIds = vectors.map((vector) => vector.vectorId);
      await client.delete(workspace.fname, {
        wait: true,
        points: vectorIds,
      });

      await WorkspaceDocument.delete({ id: Number(document.id) });
      await deleteVectorCacheFile(WorkspaceDocument.vectorFilename(document));

      result = {
        message: `Document ${document.name} removed from ${connector.type} collection ${workspace.name}.`,
      };
      await Queue.updateJob(jobId, Queue.status.complete, result);
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

const deleteWeaviateDocument = InngestClient.createFunction(
  { name: 'Delete Document From Weaviate' },
  { event: 'weaviate/deleteDocument' },
  async ({ event, step: _step, logger }) => {
    var result = {};
    const { workspace, document, connector, jobId } = event.data;
    try {
      const weaviateClient = new Weaviate(connector);
      const { client } = await weaviateClient.connect();
      const className = weaviateClient.camelCase(workspace.fname);
      const hasNamespace = await weaviateClient.namespaceExists(
        client,
        workspace.fname
      );

      if (!hasNamespace) {
        result = {
          message: `No namespace found with name ${workspace.fname} (class: ${className}) - nothing to do.`,
        };
        await Queue.updateJob(jobId, Queue.status.failed, result);
        return { result };
      }

      const vectors = await DocumentVectors.where({
        document_id: Number(document.id),
      });
      const vectorIds = vectors.map((vector) => vector.vectorId);

      await weaviateClient.bulkDeleteIds(client, className, vectorIds);
      await WorkspaceDocument.delete({ id: Number(document.id) });
      await deleteVectorCacheFile(WorkspaceDocument.vectorFilename(document));

      result = {
        message: `Document ${document.name} removed from ${connector.type} collection ${workspace.name}.`,
      };
      await Queue.updateJob(jobId, Queue.status.complete, result);
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
  deleteChromaDocument,
  deletePineconeDocument,
  deleteQdrantDocument,
  deleteWeaviateDocument,
};
