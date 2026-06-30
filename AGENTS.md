<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## GitHub API sync for this repo

Use the existing GitHub API setup instead of asking the user to create or paste a new token.

- Repository: `w4336040/nextjs-boilerplate`
- Local sync script: `.\sync_to_github_api.ps1`
- The script first uses `GITHUB_TOKEN` if it exists.
- If `GITHUB_TOKEN` is not set, the script reads the already configured GitHub credential from Windows Git Credential Manager.
- Never print, save, or commit the token/password returned by Git Credential Manager.
- Normal `git fetch` / `git push` may fail from this machine when `github.com:443` is blocked or slow. In that case, use the GitHub REST API sync script.
- Before syncing, run the relevant checks, usually `npm run lint` and `npm run build` for app changes.
- Do not commit local log files such as `dev-3000.err.log` or `dev-3000.out.log`.

Standard sync command:

```powershell
.\sync_to_github_api.ps1 -Owner "w4336040" -Repo "nextjs-boilerplate" -Branch "main" -BaseRef "origin/main" -Message "Your commit message"
```

After syncing, verify the remote branch through the GitHub API. The local `origin/main` ref may remain stale if normal Git network access is unavailable.
