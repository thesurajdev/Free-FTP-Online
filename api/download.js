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
      const data = await withSftp(connection, async (sftp) => {
        return sftp.get(targetPath);
      });

      sendOk(res, {
        fileName: targetPath.split("/").pop() || "download.bin",
        contentBase64: Buffer.from(data).toString("base64"),
      });
      return;
    }

    const data = await withFtp(connection, async (client) => {
      return readFtpFile(client, targetPath);
    });

    sendOk(res, {
      fileName: targetPath.split("/").pop() || "download.bin",
      contentBase64: data.toString("base64"),
    });
  } catch (error) {
    sendError(res, error);
  }
};
