process.env.NODE_ENV === "development"
  ? require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` })
  : require("dotenv").config();
const { userFromSession, validSessionForUser } = require("../../utils/http");
const { documentProcessorEndpoints } = require("./document-processor");
const { documentEndpoints } = require("./documents");
const { jobEndpoints } = require("./jobs");
const { organizationEndpoints } = require("./organizations");
const { toolEndpoints } = require("./tools");
const { userEndpoints } = require("./users");
const { workspaceEndpoints } = require("./workspaces");

function v1Endpoints(app) {
  if (!app) return;
  app.get(
    "/v1/valid-session-token",
    [validSessionForUser],
    async function (request, response) {
      try {
        const user = await userFromSession(request);
        if (!user) {
          response.sendStatus(403).end();
          return;
        }

        response.sendStatus(200).end();
      } catch (e) {
        console.log(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  userEndpoints(app);
  organizationEndpoints(app);
  workspaceEndpoints(app);
  documentEndpoints(app);
  documentProcessorEndpoints(app);
  jobEndpoints(app);
  toolEndpoints(app);
}

module.exports = { v1Endpoints };
