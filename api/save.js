const {
  assertConnection,
  normalizePath,
  saveFtpFile,
  withFtp,
  withSftp,
} = require("./_lib/clients");
const { allowMethod, sendError, sendOk } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (!allowMethod(req, res)) return;

  try {
    const connection = assertConnection(req.body?.connection);
    const targetPath = normalizePath(req.body?.path);
    const content = String(req.body?.content || "");
    const buffer = Buffer.from(content, "utf8");

    if (connection.protocol === "sftp") {
      await withSftp(connection, async (sftp) => {
        await sftp.put(buffer, targetPath);
      });
      sendOk(res);
      return;
    }

    await withFtp(connection, async (client) => {
      await saveFtpFile(client, targetPath, buffer);
    });

    sendOk(res);
  } catch (error) {
    sendError(res, error);
  }
};
