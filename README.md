# Run-Machine

A serverless M3U refresh engine powered by GitHub Actions.

## How it works
1. **GitHub Action**: Runs 3 times a day (00:00, 08:00, 16:00 UTC).
2. **Parser**: Fetches your source URL, scrapes the dynamic parameters, and generates `.m3u` files.
3. **Storage**: Saves files to the `/docs` folder.
4. **Hosting**: GitHub Pages serves these files at `https://<your-username>.github.io/run-machine/playlist_1.m3u`.

## Setup Instructions

### 1. GitHub Secrets
To keep your source URL private (if needed), add it as a secret:
- Go to your repo **Settings** > **Secrets and variables** > **Actions**.
- Add a **New repository secret**.
- Name: `SOURCE_URL`
- Value: `(Your source HTML URL)`

### 2. Enable GitHub Pages
- Go to your repo **Settings** > **Pages**.
- Look for **Build and deployment**.
- Source: **Deploy from a branch**.
- Branch: `main` (or your default branch).
- Folder: `/docs`.
- Click **Save**.

### 3. Customize Parsing
Edit `parse.js` to match your source HTML structure. I can help with this if you provide the URL or a snippet of the HTML!

## Local Testing
```bash
npm install
# Set temporary env var
$env:SOURCE_URL="https://example.com" 
node parse.js
```
