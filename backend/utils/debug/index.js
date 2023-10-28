const dbAdmin = require("express-admin");
const path = require("path");
const { SystemSettings } = require("../../models/systemSettings");

function generatePwd(length = 10) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

async function saveDebug(username, password) {
  await SystemSettings.updateSettings({
    debug_username: username,
    debug_pwd: password,
  });
  return true;
}

// Docs: https://github.com/simov/express-admin
function setupDebugger(app) {
  const username = generatePwd(12);
  const password = generatePwd(24);

  app.use(
    "/debug/vdbms",
    dbAdmin({
      config: {
        pg: {
          connectionString: process.env.DATABASE_CONNECTION_STRING,
        },
        admin: {
          settings: path.resolve(__dirname, "../../storage/settings.json"),
          layouts: false,
          languages: false,
          root: "/api/debug/vdbms",
          footer: {
            text: "Mintplex Labs Inc | Vector Admin",
            url: "https://github.com/Mintplex-Labs/vector-admin",
          },
        },
      },
      users: {
        [username]: {
          name: username,
          pass: password,
        },
      },
      custom: {
        // ensurePragma: {
        //   events: path.resolve(__dirname, "dbevents.js"),
        // },
      },
    })
  );

  saveDebug(username, password);
}
module.exports.setupDebugger = setupDebugger;
