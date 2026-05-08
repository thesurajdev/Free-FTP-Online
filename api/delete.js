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
    const kind = req.body?.kind === "directory" ? "directory" : "file";

    if (connection.protocol === "sftp") {
      await withSftp(connection, async (sftp) => {
        if (kind === "directory") {
          await sftp.rmdir(targetPath, true);
          return;
        }
        await sftp.delete(targetPath);
      });
      sendOk(res);
      return;
    }

    await withFtp(connection, async (client) => {
      if (kind === "directory") {
        await client.removeDir(targetPath);
        return;
      }
      await client.remove(targetPath);
    });

    sendOk(res);
  } catch (error) {
    sendError(res, error);
  }
};
