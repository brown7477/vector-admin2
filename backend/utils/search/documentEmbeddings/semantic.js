const { DocumentVectors } = require("../../../models/documentVectors");
const {
  OrganizationConnection,
} = require("../../../models/organizationConnection");
const {
  OrganizationWorkspace,
} = require("../../../models/organizationWorkspace");
const { SystemSettings } = require("../../../models/systemSettings");
const { OpenAi } = require("../../openAi");
const { selectConnector } = require("../../vectordatabases/providers");

async function semanticSearch(document, query) {
  const workspace = await OrganizationWorkspace.get({
    id: Number(document.workspace_id),
  });
  const connector = await OrganizationConnection.get({
    organization_id: Number(document.organization_id),
  });
  if (!connector)
    return { fragments: [], error: "No connector found for org." };

  const openAiKey = (await SystemSettings.get({ label: "open_ai_api_key" }))
    ?.value;
  if (!openAiKey)
    return { fragments: [], error: "No OpenAI key available to embed query." };

  const vectorDb = selectConnector(connector);
  const openai = new OpenAi(openAiKey);

  const queryVector = await openai.embedTextChunk(query);
  if (!queryVector) return { fragments: [], error: "Failed to embed query." };

  // Execute Similarity search for vector DB provider so we can find inferred documents.
  const searchResults = await vectorDb.similarityResponse(
    workspace.fname,
    queryVector
  );

  // From similarity search we can find all document vector DB items to infer their associated
  // document record.
  const fragments = await DocumentVectors.where(
    {
      vectorId: { in: searchResults?.vectorIds || [] },
      document_id: Number(document.id),
    },
    100
  );
  return { fragments, error: null };
}

module.exports = {
  semanticSearch,
};
