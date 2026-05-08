function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function callApi(endpoint, payload) {
  const response = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await response.text();
  const data = parseJsonSafe(text);

  if (!response.ok || !data?.success) {
    const message = data?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return data;
}

export function connectApi(connection) {
  return callApi("connect", connection);
}

export function listApi(connection, path) {
  return callApi("list", { connection, path });
}

export function readApi(connection, path) {
  return callApi("read", { connection, path });
}

export function saveApi(connection, path, content) {
  return callApi("save", { connection, path, content });
}

export function mkdirApi(connection, path) {
  return callApi("mkdir", { connection, path });
}

export function renameApi(connection, oldPath, newPath) {
  return callApi("rename", { connection, oldPath, newPath });
}

export function deleteApi(connection, path, kind) {
  return callApi("delete", { connection, path, kind });
}

export function sshApi(connection, command) {
  return callApi("ssh", { connection, command });
}

export async function uploadApi(connection, path, file) {
  const base64 = await fileToBase64(file);
  return callApi("upload", {
    connection,
    path,
    fileName: file.name,
    contentBase64: base64,
  });
}

export function downloadApi(connection, path) {
  return callApi("download", { connection, path });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const [, base64 = ""] = result.split(",");
      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}
