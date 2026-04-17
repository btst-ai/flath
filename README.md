# Flath: The Greek Lexical Engine

Flath is a high-precision vocabulary mastery tool designed for B1 Modern Greek learners. It focuses on Intent and Two-Track recall (Production and Recognition) and adapts to your performance using spaced repetition and interest-based algorithms.

## Project Structure

The repository is organized into the following main directories:

- **`greek-app/`**: The core Next.js web application containing the frontend components, pages, hooks, and server actions.
- **`docs/`**: Product Requirements Documents (PRDs) containing the specs, database schemas, and design philosophy behind Flath.
- **`data_processing/`**: Python scripts used to process, scrape, and categorize raw Greek vocabulary data before importing it into the app.
- **`datasets/`**: Raw vocabulary data files (`.csv`, `.txt`) used for testing and batch-importing words.

## Features

- **Advanced Word Vault**: Manage your vocabulary with rich filtering (Theme, POS, Status), sorting (Smart Rank, Success, Heat, Difficulty), and batch-editing capabilities.
- **Spaced Repetition Practice**: Practice words with adaptive weighting based on your Production (French -> Greek) and Recognition (Greek -> French) success rates.
- **Interest Axis**: Tag words with "Fav", "Up" (boost), or "Down" (decrease) to influence how often they appear in sessions.
- **Smart Packs**: Dynamically generate flashcard packs based on specific themes, difficulty levels, last played times, or parts of speech.
- **Live CSV Import**: Quickly ingest lists of words (with translations and themes) with immediate statistics reporting and conflict resolution.

## Tech Stack

- **Frontend**: Next.js (App Router), React, Tailwind CSS, Framer Motion
- **Backend/Database**: Supabase (PostgreSQL, Auth, Row Level Security)
- **Deployment**: Vercel (recommended) / Supabase

## Setup Instructions

### 1. Supabase Setup
You need a Supabase project to run this app. Ensure your database is initialized with the schema defined in `docs/v2_prd.md` (which includes `words_dim`, `user_word_settings`, `attempts_history`, `word_packs`, and `word_pack_items`).

### 2. Environment Variables
Create a `.env.local` file at the root of the project with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

*(Note: Never commit your `.env.local` to GitHub! It is ignored by default in the `.gitignore`.)*

### 3. Running Locally

Navigate into the application folder:
```bash
cd greek-app
```

Install dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The application will run on `http://localhost:3000` (or `3001` if port 3000 is taken).

## Contributing / Data Operations

Make sure to run your data manipulation scripts in the `data_processing/` folder if you wish to generate or re-categorize new sets of words. The main web application solely relies on what is stored in the Supabase database.