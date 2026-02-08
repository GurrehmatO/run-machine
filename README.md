# Run-Machine

A serverless M3U refresh engine powered by GitHub Actions.

## How it works
1. **GitHub Action**: Runs 3 times a day (00:00, 08:00, 16:00 UTC).
2. **Parser**: Fetches your source URL, scrapes the dynamic parameters, and generates `.m3u` files.
3. **Storage**: Saves files to the `/docs` folder.
4. **Hosting**: GitHub Pages serves these files at `https://<your-username>.github.io/run-machine/playlist_1.m3u`.

## Deployment Walkthrough

I have already initialized the code and local git repository for you. Follow these steps to put it online:

### 1. Create a GitHub Repo
- Go to [GitHub.com/new](https://github.com/new).
- Name your repository: `run-machine`.
- Keep it **Public**.
- **Do NOT** initialize with a README, license, or gitignore (we already have them).
- Click **Create repository**.

### 2. Connect and Push Local Code
Open your terminal (PowerShell) in the `run-machine` folder and run these two commands (copy them from your GitHub page's instructions):
```powershell
git remote add origin https://github.com/YOUR_USERNAME/run-machine.git
git branch -M main
git push -u origin main
```
*(Replace `YOUR_USERNAME` with your actual GitHub username)*

### 3. Enable GitHub Pages
- Go to your repository **Settings** (top tab).
- Click **Pages** on the left sidebar.
- Under **Build and deployment** > **Branch**:
  - Select `main`.
  - Folder: `/docs`.
  - Click **Save**.
- Your M3U files will soon be live at: `https://YOUR_USERNAME.github.io/run-machine/all_channels.m3u`

### 4. Enable Auto-Refresh Action
- The Action is already in the code. To verify:
- Click the **Actions** tab in your repository.
- You should see "Refresh M3U Playlists" on the left.
- Click **Run workflow** (button on the right) to test the first refresh manually.

### 5. (Optional) Custom Channel Additions
To add more channels in the future, just edit `parse.js` directly in GitHub or locally and push.

### 6. Troubleshooting: Permission Denied (403)
If the Action still fails at the "Commit and Push" stage:
1. Go to your repo **Settings** (top tab) > **Actions** > **General**.
2. Scroll down to **Workflow permissions**.
3. Select **Read and write permissions**.
4. Check **Allow GitHub Actions to create and approve pull requests**.
5. Click **Save**.
6. Go back to **Actions** and retry the failed workflow.
