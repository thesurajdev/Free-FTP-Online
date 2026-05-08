# Free FTP Online

Browser-based FTP/FTPS/SFTP code editor with Vercel serverless APIs.

## Features

- Connect to `FTP`, `FTPS`, and `SFTP` servers from browser UI.
- Browse remote folders and open files.
- Edit files with Monaco editor (syntax highlighting, line numbers, tabs).
- Save updates directly to remote server.
- Upload files (drag/drop or picker).
- Download files.
- Create folders, rename files/folders, delete files/folders.
- Optional SSH command panel (`ls`, `pwd`, `npm`, `git`, etc.) for SFTP/SSH connections.

## Stack

- Frontend: React + Vite + Monaco Editor
- Backend: Vercel Serverless Functions (`api/*.js`)
- Protocols:
	- `ssh2-sftp-client` for SFTP
	- `ssh2` for SSH commands
	- `basic-ftp` for FTP/FTPS
- Storage: browser memory (no database)

## Local Development

```bash
npm install
npm run dev
```

Open: `http://localhost:5173`

`npm run dev` also serves `api/*.js` endpoints locally through Vite middleware, so the app can connect to FTP/SFTP/SSH without needing `vercel dev` during development.

## Build

```bash
npm run build
```

## API Endpoints

- `POST /api/connect`
- `POST /api/list`
- `POST /api/read`
- `POST /api/save`
- `POST /api/upload`
- `POST /api/download`
- `POST /api/delete`
- `POST /api/rename`
- `POST /api/mkdir`
- `POST /api/ssh`

Each endpoint expects a `connection` object (except `/api/connect`, where connection fields are in body):

```json
{
	"protocol": "sftp",
	"host": "example.com",
	"port": 22,
	"username": "deploy",
	"password": "secret",
	"privateKey": "-----BEGIN OPENSSH PRIVATE KEY-----...",
	"passphrase": "optional"
}
```

## Deploy To Vercel

1. Push repository to GitHub.
2. Import repository in Vercel.
3. Deploy with default settings.

`vercel.json` already configures serverless function memory/duration and SPA routing.

## Security Notes

- No credentials are stored on the server.
- Credentials are sent per request from frontend session.
- Avoid logging request payloads in production.
- SSH command endpoint only allows a limited command set.