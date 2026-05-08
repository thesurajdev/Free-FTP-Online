const path = require("node:path");
const { Readable, Writable } = require("node:stream");
const SftpClient = require("ssh2-sftp-client");
const ftp = require("basic-ftp");
const { Client: SSHClient } = require("ssh2");

function normalizeProtocol(protocol) {
  const value = String(protocol || "sftp").toLowerCase();
  if (["ftp", "ftps", "sftp"].includes(value)) return value;
  throw new Error("Unsupported protocol. Use ftp, ftps, or sftp.");
}

function normalizePort(protocol, port) {
  if (port) return Number(port);
  return protocol === "ftp" || protocol === "ftps" ? 21 : 22;
}

function normalizePath(remotePath) {
  const raw = String(remotePath || "/").replace(/\\/g, "/");
  if (raw.includes("\0")) {
    const error = new Error("Invalid path");
    error.statusCode = 400;
    throw error;
  }

  let normalized = path.posix.normalize(raw);
  if (!normalized.startsWith("/")) normalized = `/${normalized}`;
  const parts = normalized.split("/").filter(Boolean);

  if (parts.includes("..")) {
    const error = new Error("Path traversal is not allowed");
    error.statusCode = 400;
    throw error;
  }

  return normalized || "/";
}

function normalizePrivateKey(value) {
  if (!value) return undefined;
  return String(value).replace(/\\n/g, "\n");
}

function assertConnection(connection) {
  if (!connection || typeof connection !== "object") {
    const error = new Error("Connection config is required");
    error.statusCode = 400;
    throw error;
  }

  const protocol = normalizeProtocol(connection.protocol);
  const host = String(connection.host || "").trim();
  const username = String(connection.username || "").trim();

  if (!host || !username) {
    const error = new Error("Host and username are required");
    error.statusCode = 400;
    throw error;
  }

  if (!connection.password && !connection.privateKey) {
    const error = new Error("Password or private key is required");
    error.statusCode = 400;
    throw error;
  }

  return {
    protocol,
    host,
    username,
    password: connection.password || undefined,
    privateKey: normalizePrivateKey(connection.privateKey),
    passphrase: connection.passphrase || undefined,
    port: normalizePort(protocol, connection.port),
  };
}

async function withSftp(connection, callback) {
  const sftp = new SftpClient();

  await sftp.connect({
    host: connection.host,
    port: connection.port,
    username: connection.username,
    password: connection.password,
    privateKey: connection.privateKey,
    passphrase: connection.passphrase,
    readyTimeout: 10000,
  });

  try {
    return await callback(sftp);
  } finally {
    await sftp.end().catch(() => null);
  }
}

async function withFtp(connection, callback) {
  const client = new ftp.Client(10000);
  client.ftp.verbose = false;

  await client.access({
    host: connection.host,
    port: connection.port,
    user: connection.username,
    password: connection.password,
    secure: connection.protocol === "ftps",
  });

  try {
    return await callback(client);
  } finally {
    client.close();
  }
}

async function readFtpFile(client, remotePath) {
  const chunks = [];
  const writer = new Writable({
    write(chunk, _, callback) {
      chunks.push(Buffer.from(chunk));
      callback();
    },
  });

  await client.downloadTo(writer, remotePath);
  return Buffer.concat(chunks);
}

async function saveFtpFile(client, remotePath, contentBuffer) {
  await client.uploadFrom(Readable.from(contentBuffer), remotePath);
}

function mapSftpEntry(parentPath, item) {
  const itemPath = normalizePath(path.posix.join(parentPath, item.name));
  return {
    name: item.name,
    path: itemPath,
    size: Number(item.size || 0),
    modifyTime: item.modifyTime || null,
    type: item.type === "d" ? "directory" : "file",
  };
}

function mapFtpEntry(parentPath, item) {
  const itemPath = normalizePath(path.posix.join(parentPath, item.name));
  return {
    name: item.name,
    path: itemPath,
    size: Number(item.size || 0),
    modifyTime: item.modifiedAt ? item.modifiedAt.toISOString() : null,
    type: item.isDirectory ? "directory" : "file",
  };
}

function sortEntries(entries) {
  return [...entries].sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

async function runSshCommand(connection, command) {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    let stdout = "";
    let stderr = "";

    const timer = setTimeout(() => {
      ssh.end();
      reject(new Error("SSH command timed out"));
    }, 9000);

    ssh
      .on("ready", () => {
        ssh.exec(command, (error, stream) => {
          if (error) {
            clearTimeout(timer);
            ssh.end();
            reject(error);
            return;
          }

          stream
            .on("close", (code) => {
              clearTimeout(timer);
              ssh.end();
              resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
            })
            .on("data", (data) => {
              stdout += data.toString();
            });

          stream.stderr.on("data", (data) => {
            stderr += data.toString();
          });
        });
      })
      .on("error", (error) => {
        clearTimeout(timer);
        reject(error);
      })
      .connect({
        host: connection.host,
        port: connection.port,
        username: connection.username,
        password: connection.password,
        privateKey: connection.privateKey,
        passphrase: connection.passphrase,
        readyTimeout: 10000,
      });
  });
}

module.exports = {
  assertConnection,
  normalizePath,
  withSftp,
  withFtp,
  readFtpFile,
  saveFtpFile,
  mapSftpEntry,
  mapFtpEntry,
  sortEntries,
  runSshCommand,
};
