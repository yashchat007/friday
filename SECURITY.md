# Security

FRIDAY runs automation on your Windows machine. Treat it like privileged local software.

## Secrets and API keys

- **Never commit** `.env`, `friday.json` (electron-store), `friday-memory.json`, or any file containing API keys, tokens, or passwords.
- Optional **Gemini** and **OpenWeather** keys are stored only in your local Electron user data folder via `electron-store`, not in this repository.
- The renderer receives **redacted** settings over IPC (`geminiApiKey` / `weatherApiKey` values are blank; use `geminiApiKeyConfigured` to show that a key is saved).
- Keys are sent to Google only when you enable the Gemini provider and the agent makes a request.

## Safe development

1. Copy `.env.example` to `.env` for local debug flags only (no keys required for Ollama).
2. Keep `allowedPaths` narrow; widening file-tool roots increases blast radius.
3. Review **approval prompts** before allowing sensitive or destructive tools (`run_powershell`, file delete, browser clicks, WhatsApp send).
4. Chrome CDP mode can automate tabs where you are already logged in—use a dedicated debug Chrome profile when possible.

## Reporting issues

If you find a vulnerability in this project, open a private security advisory on GitHub for [yashchat007/friday](https://github.com/yashchat007/friday) or contact the maintainer through GitHub. Please do not post exploit details in public issues.

## Out of scope for this repo

Runtime chat history and user facts live on disk under your OS user profile. Back up or wipe that data before sharing your machine or disk images.
