const {
  assertConnection,
  mapFtpEntry,
  mapSftpEntry,
  normalizePath,
  sortEntries,
  withFtp,
  withSftp,
} = require("./_lib/clients");
const { allowMethod, sendError, sendOk } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (!allowMethod(req, res)) return;

  try {
    const connection = assertConnection(req.body?.connection);
    const targetPath = normalizePath(req.body?.path || "/");

    if (connection.protocol === "sftp") {
      const entries = await withSftp(connection, async (sftp) => {
        const list = await sftp.list(targetPath);
        return sortEntries(list.map((item) => mapSftpEntry(targetPath, item)));
      });

      sendOk(res, { path: targetPath, entries });
      return;
    }

    const entries = await withFtp(connection, async (client) => {
      const list = await client.list(targetPath);
      return sortEntries(list.map((item) => mapFtpEntry(targetPath, item)));
    });

    sendOk(res, { path: targetPath, entries });
  } catch (error) {
    sendError(res, error);
  }
};
