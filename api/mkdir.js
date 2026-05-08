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
    const targetPath = normalizePath(req.body?.path);

    if (connection.protocol === "sftp") {
      await withSftp(connection, async (sftp) => {
        await sftp.mkdir(targetPath, true);
      });
      sendOk(res);
      return;
    }

    await withFtp(connection, async (client) => {
      await client.ensureDir(targetPath);
    });

    sendOk(res);
  } catch (error) {
    sendError(res, error);
  }
};
