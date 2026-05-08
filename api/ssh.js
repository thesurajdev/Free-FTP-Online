const { assertConnection, runSshCommand } = require("./_lib/clients");
const { allowMethod, sendError, sendOk } = require("./_lib/http");

const ALLOWED_COMMANDS = new Set([
  "ls",
  "pwd",
  "whoami",
  "npm",
  "git",
  "node",
  "php",
  "composer",
]);

function validateCommand(command) {
  const value = String(command || "").trim();
  if (!value) {
    const error = new Error("Command is required");
    error.statusCode = 400;
    throw error;
  }

  const executable = value.split(/\s+/)[0];
  if (!ALLOWED_COMMANDS.has(executable)) {
    const error = new Error(`Command not allowed: ${executable}`);
    error.statusCode = 400;
    throw error;
  }

  return value;
}

module.exports = async function handler(req, res) {
  if (!allowMethod(req, res)) return;

  try {
    const connection = assertConnection(req.body?.connection);

    if (connection.protocol !== "sftp") {
      const error = new Error("SSH command panel requires SFTP/SSH protocol");
      error.statusCode = 400;
      throw error;
    }

    const command = validateCommand(req.body?.command);
    const result = await runSshCommand(connection, command);

    sendOk(res, result);
  } catch (error) {
    sendError(res, error);
  }
};
