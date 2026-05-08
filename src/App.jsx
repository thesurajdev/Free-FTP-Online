import { useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import {
  FiChevronRight,
  FiCode,
  FiDownload,
  FiFile,
  FiFolder,
  FiFolderPlus,
  FiRefreshCw,
  FiSave,
  FiServer,
  FiTerminal,
  FiTrash2,
  FiUpload,
} from "react-icons/fi";
import toast from "react-hot-toast";
import {
  connectApi,
  deleteApi,
  downloadApi,
  listApi,
  mkdirApi,
  readApi,
  renameApi,
  saveApi,
  sshApi,
  uploadApi,
} from "./utils/api";
import {
  basename,
  dirname,
  joinPath,
  languageFromPath,
} from "./utils/file";

const DEFAULT_FORM = {
  protocol: "sftp",
  host: "",
  port: "22",
  username: "",
  password: "",
  privateKey: "",
  passphrase: "",
};

function normalizePort(protocol) {
  if (protocol === "ftp" || protocol === "ftps") return "21";
  return "22";
}

function entryIcon(entry) {
  if (entry.type === "directory") return <FiFolder className="icon folder" />;
  const lang = languageFromPath(entry.path);
  return lang !== "plaintext" ? (
    <FiCode className="icon code" />
  ) : (
    <FiFile className="icon file" />
  );
}

export default function App() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [connection, setConnection] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [entries, setEntries] = useState([]);
  const [currentPath, setCurrentPath] = useState("/");
  const [loadingList, setLoadingList] = useState(false);
  const [tabs, setTabs] = useState([]);
  const [activeTabPath, setActiveTabPath] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [command, setCommand] = useState("pwd");
  const [commandOutput, setCommandOutput] = useState("");
  const [runningCommand, setRunningCommand] = useState(false);
  const [autoSave, setAutoSave] = useState(false);
  const fileInputRef = useRef(null);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.path === activeTabPath) || null,
    [tabs, activeTabPath]
  );

  const breadcrumbs = useMemo(() => {
    const parts = currentPath.split("/").filter(Boolean);
    const list = [{ label: "/", path: "/" }];
    let cumulative = "";
    for (const part of parts) {
      cumulative = joinPath(cumulative, part);
      list.push({ label: part, path: cumulative });
    }
    return list;
  }, [currentPath]);

  useEffect(() => {
    function closeMenu() {
      setContextMenu(null);
    }
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  async function connect() {
    if (!form.host || !form.username) {
      toast.error("Host and username are required");
      return;
    }

    setIsConnecting(true);
    try {
      const result = await connectApi(form);
      setConnection({ ...form });
      toast.success("Connected");
      await refreshList(result?.cwd || "/");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setIsConnecting(false);
    }
  }

  async function refreshList(path = currentPath) {
    if (!connection && !isConnecting) return;
    const currentConnection = connection || form;

    setLoadingList(true);
    try {
      const result = await listApi(currentConnection, path);
      setEntries(result.entries || []);
      setCurrentPath(result.path || path);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoadingList(false);
    }
  }

  async function openFile(filePath) {
    const existing = tabs.find((tab) => tab.path === filePath);
    if (existing) {
      setActiveTabPath(existing.path);
      return;
    }

    try {
      const result = await readApi(connection, filePath);
      const tab = {
        path: filePath,
        name: basename(filePath),
        language: languageFromPath(filePath),
        content: result.content || "",
        dirty: false,
      };
      setTabs((prev) => [...prev, tab]);
      setActiveTabPath(filePath);
    } catch (error) {
      toast.error(error.message);
    }
  }

  function updateActiveContent(value) {
    setTabs((prev) =>
      prev.map((tab) =>
        tab.path === activeTabPath ? { ...tab, content: value ?? "", dirty: true } : tab
      )
    );
  }

  async function saveTab(path = activeTabPath) {
    const tab = tabs.find((item) => item.path === path);
    if (!tab || !tab.dirty) return;

    try {
      await saveApi(connection, tab.path, tab.content);
      setTabs((prev) =>
        prev.map((item) => (item.path === tab.path ? { ...item, dirty: false } : item))
      );
      toast.success(`Saved ${tab.name}`);
    } catch (error) {
      toast.error(error.message);
    }
  }

  useEffect(() => {
    if (!autoSave || !activeTab?.dirty) return;
    const id = setTimeout(() => saveTab(activeTab.path), 1200);
    return () => clearTimeout(id);
  }, [autoSave, activeTab?.content]);

  async function handleEntry(entry) {
    if (entry.type === "directory") {
      await refreshList(entry.path);
      return;
    }
    await openFile(entry.path);
  }

  async function uploadFiles(files) {
    if (!connection) return;

    for (const file of files) {
      try {
        const remotePath = joinPath(currentPath, file.name);
        await uploadApi(connection, remotePath, file);
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        toast.error(`Upload failed: ${error.message}`);
      }
    }

    await refreshList(currentPath);
  }

  async function runCommand() {
    if (!connection) return;
    setRunningCommand(true);

    try {
      const result = await sshApi(connection, command);
      setCommandOutput(result.stdout || result.stderr || "No output");
      toast.success("Command finished");
    } catch (error) {
      setCommandOutput(error.message);
      toast.error(error.message);
    } finally {
      setRunningCommand(false);
    }
  }

  async function actionDelete(path, kind) {
    if (!window.confirm(`Delete ${path}?`)) return;
    try {
      await deleteApi(connection, path, kind);
      setTabs((prev) => prev.filter((tab) => tab.path !== path));
      if (activeTabPath === path) setActiveTabPath(null);
      await refreshList(currentPath);
      toast.success("Deleted");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function actionRename(path) {
    const nextName = window.prompt("New name", basename(path));
    if (!nextName || nextName === basename(path)) return;

    const target = joinPath(dirname(path), nextName);
    try {
      await renameApi(connection, path, target);
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === path ? { ...tab, path: target, name: basename(target) } : tab
        )
      );
      if (activeTabPath === path) setActiveTabPath(target);
      await refreshList(currentPath);
      toast.success("Renamed");
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function actionDownload(path) {
    try {
      const result = await downloadApi(connection, path);
      const binary = atob(result.contentBase64 || "");
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const blob = new Blob([bytes]);
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = result.fileName || basename(path);
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function actionNewFolder() {
    const name = window.prompt("Folder name");
    if (!name) return;

    try {
      await mkdirApi(connection, joinPath(currentPath, name));
      await refreshList(currentPath);
      toast.success("Folder created");
    } catch (error) {
      toast.error(error.message);
    }
  }

  function closeTab(path) {
    const next = tabs.filter((tab) => tab.path !== path);
    setTabs(next);
    if (activeTabPath === path) {
      setActiveTabPath(next[next.length - 1]?.path || null);
    }
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <FiServer />
          <strong>Free FTP Online</strong>
        </div>

        <div className="connection-grid">
          <select
            value={form.protocol}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                protocol: event.target.value,
                port: normalizePort(event.target.value),
              }))
            }
          >
            <option value="sftp">SFTP</option>
            <option value="ftp">FTP</option>
            <option value="ftps">FTPS</option>
          </select>

          <input
            placeholder="Host"
            value={form.host}
            onChange={(event) => setForm((prev) => ({ ...prev, host: event.target.value }))}
          />
          <input
            placeholder="Port"
            value={form.port}
            onChange={(event) => setForm((prev) => ({ ...prev, port: event.target.value }))}
          />
          <input
            placeholder="Username"
            value={form.username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, username: event.target.value }))
            }
          />
          <input
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
          />
          <button className="btn primary" onClick={connect} disabled={isConnecting}>
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </header>

      <main className="layout">
        <aside
          className="sidebar"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            uploadFiles(Array.from(event.dataTransfer.files));
          }}
        >
          <div className="toolbar">
            <button className="btn" onClick={() => refreshList(currentPath)}>
              <FiRefreshCw />
              Refresh
            </button>
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              <FiUpload />
              Upload
            </button>
            <button className="btn" onClick={actionNewFolder}>
              <FiFolderPlus />
              New Folder
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={(event) => uploadFiles(Array.from(event.target.files || []))}
            />
          </div>

          <div className="breadcrumbs">
            {breadcrumbs.map((crumb) => (
              <button key={crumb.path} className="crumb" onClick={() => refreshList(crumb.path)}>
                {crumb.label}
              </button>
            ))}
          </div>

          <div className="file-list">
            {loadingList && <div className="empty">Loading...</div>}
            {!loadingList && entries.length === 0 && (
              <div className="empty">No files in this folder</div>
            )}

            {entries.map((entry) => (
              <button
                key={entry.path}
                className="file-row"
                onDoubleClick={() => handleEntry(entry)}
                onClick={() => entry.type !== "directory" && openFile(entry.path)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  setContextMenu({
                    x: event.clientX,
                    y: event.clientY,
                    path: entry.path,
                    kind: entry.type,
                  });
                }}
              >
                {entryIcon(entry)}
                <span className="name">{entry.name}</span>
                <span className="meta">{entry.type === "directory" ? "dir" : `${entry.size}b`}</span>
                <FiChevronRight className="go" />
              </button>
            ))}
          </div>
        </aside>

        <section className="editor-pane">
          <div className="editor-toolbar">
            <div className="tabs">
              {tabs.map((tab) => (
                <button
                  key={tab.path}
                  className={`tab ${tab.path === activeTabPath ? "active" : ""}`}
                  onClick={() => setActiveTabPath(tab.path)}
                >
                  {tab.name}
                  {tab.dirty ? "*" : ""}
                  <span
                    className="tab-close"
                    onClick={(event) => {
                      event.stopPropagation();
                      closeTab(tab.path);
                    }}
                  >
                    x
                  </span>
                </button>
              ))}
            </div>

            <div className="actions">
              <label className="autosave">
                <input
                  type="checkbox"
                  checked={autoSave}
                  onChange={(event) => setAutoSave(event.target.checked)}
                />
                Auto Save
              </label>
              <button className="btn" onClick={() => saveTab()} disabled={!activeTab?.dirty}>
                <FiSave />
                Save
              </button>
              {activeTab && (
                <button className="btn" onClick={() => actionDownload(activeTab.path)}>
                  <FiDownload />
                  Download
                </button>
              )}
              {activeTab && (
                <button className="btn danger" onClick={() => actionDelete(activeTab.path, "file")}>
                  <FiTrash2 />
                  Delete
                </button>
              )}
            </div>
          </div>

          <div className="editor-wrap">
            {activeTab ? (
              <Editor
                path={activeTab.path}
                language={activeTab.language}
                value={activeTab.content}
                onChange={(value) => updateActiveContent(value)}
                theme="vs-dark"
                options={{
                  fontSize: 14,
                  automaticLayout: true,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  lineNumbers: "on",
                }}
              />
            ) : (
              <div className="empty-editor">Open a file from the explorer to start editing.</div>
            )}
          </div>

          <div className="command-panel">
            <div className="command-head">
              <FiTerminal />
              <strong>SSH Command Panel</strong>
            </div>
            <div className="command-row">
              <input
                value={command}
                onChange={(event) => setCommand(event.target.value)}
                placeholder="pwd"
              />
              <button className="btn" onClick={runCommand} disabled={runningCommand}>
                {runningCommand ? "Running..." : "Run"}
              </button>
            </div>
            <pre className="command-output">{commandOutput || "No output yet"}</pre>
          </div>
        </section>
      </main>

      <footer className="status-bar">
        <span>{connection ? `Connected: ${connection.username}@${connection.host}` : "Disconnected"}</span>
        <span className="footer-center">Built by <a href="https://surajdev.com" target="_blank" rel="noopener noreferrer">surajdev.com</a></span>
        <span>{currentPath}</span>
      </footer>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <button onClick={() => actionRename(contextMenu.path)}>Rename</button>
          <button onClick={() => actionDownload(contextMenu.path)}>Download</button>
          <button onClick={() => actionDelete(contextMenu.path, contextMenu.kind)}>Delete</button>
        </div>
      )}
    </div>
  );
}
