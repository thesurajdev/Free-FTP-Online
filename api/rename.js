const {
  assertConnection,
  normalizePath,
  withFtp,
  withSftp,
} = require("./_lib/clients");
const { allowMethod, sendError, sendOk } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (!allowMethod(req, res)) return;

  try {
    const connection = assertConnection(req.body?.connection);
    const oldPath = normalizePath(req.body?.oldPath);
    const newPath = normalizePath(req.body?.newPath);

    if (connection.protocol === "sftp") {
      await withSftp(connection, async (sftp) => {
        await sftp.rename(oldPath, newPath);
      });
      sendOk(res);
      return;
    }

    await withFtp(connection, async (client) => {
      await client.rename(oldPath, newPath);
    });

    sendOk(res);
  } catch (error) {
    sendError(res, error);
  }
};
