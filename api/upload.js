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
    const contentBase64 = String(req.body?.contentBase64 || "");

    if (!contentBase64) {
      throw new Error("contentBase64 is required");
    }

    const buffer = Buffer.from(contentBase64, "base64");

    if (connection.protocol === "sftp") {
      await withSftp(connection, async (sftp) => {
        await sftp.put(buffer, targetPath);
      });
      sendOk(res, { bytes: buffer.length });
      return;
    }

    await withFtp(connection, async (client) => {
      await saveFtpFile(client, targetPath, buffer);
    });

    sendOk(res, { bytes: buffer.length });
  } catch (error) {
    sendError(res, error);
  }
};
