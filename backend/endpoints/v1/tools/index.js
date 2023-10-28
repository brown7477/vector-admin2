const { Organization } = require("../../../models/organization");
const {
  OrganizationConnection,
} = require("../../../models/organizationConnection");
const { Queue } = require("../../../models/queue");
const {
  userFromSession,
  validSessionForUser,
  reqBody,
} = require("../../../utils/http");
const {
  organizationMigrationJob,
} = require("../../../utils/jobs/organizationMigrationJob");
const {
  organizationResetJob,
} = require("../../../utils/jobs/organizationResetJob");
const {
  workspaceSimilaritySearch,
} = require("../../../utils/toolHelpers/workspaceSimilaritySearch");
const { ragTestingEndpoints } = require("./ragTesting");

process.env.NODE_ENV === "development"
  ? require("dotenv").config({ path: `.env.${process.env.NODE_ENV}` })
  : require("dotenv").config();

function toolEndpoints(app) {
  if (!app) return;
  ragTestingEndpoints(app);

  app.post(
    "/v1/tools/org/:orgSlug/migrate",
    [validSessionForUser],
    async function (request, response) {
      try {
        const { orgSlug } = request.params;
        const { destinationOrgId } = reqBody(request);
        const user = await userFromSession(request);
        if (!user || user.role !== "admin") {
          response.sendStatus(403).end();
          return;
        }

        const organization = await Organization.getWithOwner(user.id, {
          slug: orgSlug,
        });
        if (!organization) {
          response
            .status(200)
            .json({ success: false, message: "No org found." });
          return;
        }

        if (organization.id === Number(destinationOrgId)) {
          response.status(200).json({
            success: false,
            message:
              "Destination organization cannot be the same as originating organization.",
          });
          return;
        }

        const originalConnector = await OrganizationConnection.get({
          organization_id: Number(organization.id),
        });
        if (!originalConnector) {
          response.status(200).json({
            success: false,
            message:
              "No vector database is connected to the original organization.",
          });
          return;
        }

        const destinationOrg = await Organization.get({
          id: Number(destinationOrgId),
        });
        if (!destinationOrg) {
          response.status(200).json({
            success: false,
            message: "Destination org does not exit.",
          });
          return;
        }

        const destinationConnector = await OrganizationConnection.get({
          organization_id: Number(destinationOrg.id),
        });
        if (!destinationConnector) {
          response.status(200).json({
            success: false,
            message:
              "No vector database is connected to the destination organization.",
          });
          return;
        }

        const existingJobForOrg = await Queue.get({
          taskName: "workspace/migrate",
          status: "pending",
          organization_id: organization.id,
        });
        const existingJobForDestinationOrg = await Queue.get({
          taskName: "workspace/migrate",
          status: "pending",
          organization_id: destinationOrg.id,
        });
        if (!!existingJobForOrg || !!existingJobForDestinationOrg) {
          response.status(200).json({
            success: false,
            message:
              "There is an existing migration job already running for these organizations.",
          });
          return;
        }

        await organizationMigrationJob(organization, destinationOrg, user);
        response
          .status(200)
          .json({ success: true, message: "Migration job queued." });
      } catch (e) {
        console.log(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/v1/tools/org/:orgSlug/reset",
    [validSessionForUser],
    async function (request, response) {
      try {
        const { orgSlug } = request.params;
        const user = await userFromSession(request);
        if (!user || user.role !== "admin") {
          response.sendStatus(403).end();
          return;
        }

        const organization = await Organization.getWithOwner(user.id, {
          slug: orgSlug,
        });
        if (!organization) {
          response
            .status(200)
            .json({ success: false, message: "No org found." });
          return;
        }

        const connector = await OrganizationConnection.get({
          organization_id: Number(organization.id),
        });
        if (!connector) {
          response.status(200).json({
            success: false,
            message: "No vector database is connected to this organization.",
          });
          return;
        }

        const pendingJobs = await Queue.where({
          status: "pending",
          organization_id: organization.id,
        });
        if (pendingJobs.length > 0) {
          response.status(200).json({
            success: false,
            message:
              "There are pending jobs for this organization - you cannot reset it at this time.",
          });
          return;
        }

        await organizationResetJob(organization, user);
        response
          .status(200)
          .json({ success: true, message: "Migration job queued." });
      } catch (e) {
        console.log(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post(
    "/v1/tools/org/:orgSlug/workspace-similarity-search",
    [validSessionForUser],
    async function (request, response) {
      try {
        const user = await userFromSession(request);
        if (!user || user.role !== "admin") {
          response.sendStatus(403).end();
          return;
        }
        return await workspaceSimilaritySearch(user, request, response);
      } catch (e) {
        console.log(e.message, e);
        response.sendStatus(500).end();
      }
    }
  );
}

module.exports = { toolEndpoints };
