const {
  assertConnection,
  normalizePath,
  readFtpFile,
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
      const content = await withSftp(connection, async (sftp) => {
        const data = await sftp.get(targetPath);
        return Buffer.from(data).toString("utf8");
      });
      sendOk(res, { content });
      return;
    }

    const content = await withFtp(connection, async (client) => {
      const data = await readFtpFile(client, targetPath);
      return data.toString("utf8");
    });

    sendOk(res, { content });
  } catch (error) {
    sendError(res, error);
  }
};
