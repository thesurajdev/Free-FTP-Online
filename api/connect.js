const { assertConnection, withFtp, withSftp } = require("./_lib/clients");
const { allowMethod, sendError, sendOk } = require("./_lib/http");

module.exports = async function handler(req, res) {
  if (!allowMethod(req, res)) return;

  try {
    const connection = assertConnection(req.body);

    if (connection.protocol === "sftp") {
      const data = await withSftp(connection, async (sftp) => {
        const cwd = await sftp.cwd().catch(() => "/");
        return { cwd };
      });
      sendOk(res, data);
      return;
    }

    const data = await withFtp(connection, async (client) => {
      const cwd = await client.pwd();
      return { cwd };
    });

    sendOk(res, data);
  } catch (error) {
    sendError(res, error);
  }
};
