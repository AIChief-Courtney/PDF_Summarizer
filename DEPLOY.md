# Deploy to GitHub + Vercel (AIChief-Courtney)

## Security first

- **Do not commit** `.env` or API keys (already in `.gitignore`).
- Set **`OPENAI_API_KEY`** only in the Vercel project **Environment Variables** UI.
- If credentials were shared in chat, **rotate** your GitHub password and OpenAI API key.

## 1. Push to GitHub

From `pdf-summarizer` (git repo is already initialized with one commit):

```powershell
cd D:\upwork\Sean\Chatbot\pdf-summarizer
gh auth login
```

Sign in as **AIChief-Courtney** (browser or personal access token — GitHub does **not** accept account passwords for `git push`).

Create the remote repo and push:

```powershell
gh repo create pdf-summarizer --public --source=. --remote=origin --push
```

Or create `pdf-summarizer` manually on GitHub, then:

```powershell
git remote add origin https://github.com/AIChief-Courtney/pdf-summarizer.git
git branch -M main
git push -u origin main
```

## 2. Deploy on Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in (GitHub account **AIChief-Courtney**).
2. **Import** `AIChief-Courtney/pdf-summarizer`.
3. Leave **Framework Preset** as Vite (or Other); confirm:
   - **Build Command:** `npm run build --prefix client`
   - **Output Directory:** `client/dist`
   - **Install Command:** `npm install && npm install --prefix client && npm install --prefix server`
4. **Environment variables** (Production):
   - `OPENAI_API_KEY` = your OpenAI key
   - `OPENAI_MODEL` = `gpt-4o-mini` (optional)
5. Click **Deploy**.

## 3. Verify production

- Open the Vercel URL → upload `samples/sample-text.pdf` → **Generate summary**.
- `GET https://YOUR-DEPLOYMENT.vercel.app/api/health` should return `{"ok":true}`.

## CLI alternative (after `vercel login`)

```powershell
cd D:\upwork\Sean\Chatbot\pdf-summarizer
vercel link
vercel env add OPENAI_API_KEY production
vercel deploy --prod
```
