# Discord Activity Bot

This bot posts match invitations in a #gaming channel and lets users join via reactions.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with your Discord token:
   ```env
   DISCORD_TOKEN=your_token_here
   ```
3. Run the bot locally:
   ```bash
   node index.js
   ```

## Deployment on Railway

1. Initialize a git repository and push your code to GitHub.
2. Create a new project on Railway and link your GitHub repo.
3. Add the `DISCORD_TOKEN` variable in Railway's **Variables** panel.
4. Deploy. Railway uses the provided `Procfile` to start the bot.
