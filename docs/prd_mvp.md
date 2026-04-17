# Master PRD: The Greek Lexical Engine (MVP)

## 1. Executive Summary
**Vision:** A high-precision vocabulary mastery tool for B1 Modern Greek learners.
**Problem:** Mainstream apps fail at the B1 level by ignoring the gap between Recognition (Reading) and Production (Speaking), and by providing generic vocabulary that doesn't fit the learner's specific interests (e.g., Geopolitics).
**Solution:** An "Intent-aware" engine that allows the user to prioritize specific words and tracks mastery across two distinct cognitive tracks: Recognition and Production.

---

## 2. Product Requirements (The "What")

### 2.1 Core Interaction: The "Fluid" Flashcard
- **The Card:** A large, central minimalist card.
- **Gesture:** Clicking or Tapping anywhere on the card flips it. No dedicated "Flip" button.
- **Front View:** Displays the "Prompt" word (Greek or French), the Part of Speech, and the Group name.
- **Back View:** Displays the "Translation" and the original Prompt.
- **Stats Bar (Top):** - **Timer:** MM:SS elapsed since the start of the session.
    - **Progress:** [Mastered Count] / [Total Session Size] (e.g., 12/50).

### 2.2 Intent Management (The "Interest" Scale)
The user can adjust the "Intent" for any word at any time (on the card or in the list view):
- **Favorite (P1):** Absolute priority. These words are forced to the start of every session.
- **Boost (P2):** High frequency; appears more often in the rotation.
- **Standard (P3):** Default frequency based on SRS.
- **Decrease (P4):** Low priority; appears only after higher-tier words are cleared.
- **Archive:** Completely removed from practice rotation but kept in the database.

### 2.3 Session Logic: The "Endless Loop"
- **Mastery Goal:** A session only ends when the queue is empty.
- **Behavior:** If a user marks a card as "Forgot it" or "Unsure," it is moved to the back of the current session queue. It will repeat until marked "Knew it."
- **Initialization:** Sessions gather words based on Priority: Favorites -> Boosted -> Standard.

---

## 3. Linguistic & Data Rules

### 3.1 Data Constraints (B1 Specific)
To ensure grammatical accuracy, the following rules apply:
- **Nouns:** Must include the definite article (e.g., η κυβέρνηση, ο skulos).
- **Verbs:** Must include both Present and Past (Aorist) forms (e.g., ψηφίζω / ψήφισα).
- **Adjectives:** Must be in the Masculine form.
- **CSV Format:** `Greek Word, French Translation, Part of Speech, Date Added, Group`.

---

## 4. Technical Specifications (The "How")

### 4.1 Tech Stack
- **Frontend:** Next.js (App Router), Tailwind CSS.
- **Animation:** Framer Motion (180-degree Y-axis flip).
- **Backend/DB:** Supabase (PostgreSQL).
- **Audio:** Web Speech API (`lang: 'el-GR'`).

### 4.2 Database Schema (Supabase)
```sql
CREATE TYPE priority_level AS ENUM ('favorite', 'boost', 'standard', 'decrease', 'archive');

CREATE TABLE vocabulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  greek_text TEXT NOT NULL,          -- e.g., "ψηφίζω / ψήφισα"
  french_text TEXT NOT NULL,         -- e.g., "voter"
  part_of_speech TEXT,               -- e.g., "Verb"
  group_name TEXT DEFAULT 'General', 
  priority priority_level DEFAULT 'standard',
  
  -- Tracking Recognition (GR -> FR)
  rec_mastery_score INT DEFAULT 0,
  rec_next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Tracking Production (FR -> GR)
  prod_mastery_score INT DEFAULT 0,
  prod_next_review TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 4.3 Core Algorithms

#### A. The "Two-Track" Mastery
Every word has two independent tracking scores.
*   The app randomly chooses mode = recognition or mode = production.
*   If the card shows Greek (Recognition), only rec_mastery_score is updated upon completion.
*   If the card shows French (Production), only prod_mastery_score is updated.
*   **Adaptive Weighting:** If rec_mastery is 50% higher than prod_mastery, the system weights the choice toward production to force active recall.

#### B. SRS & Feedback Logic

*   **Knew it (Green):** mastery_score += 1. Set next_review = NOW() + (mastery * 2 days). Remove from current session queue.
*   **Unsure (Yellow):** mastery_score stays same. Move to end of current session queue.
*   **Forgot it (Red):** mastery_score = 0. Set next_review = NOW(). Move to end of current session queue.

5\. UI/UX Requirements for Cursor
---------------------------------

### 5.1 The "Vault" (Importer.tsx)

*   Use papaparse for client-side CSV processing.
*   Build a table to view all words with a "Quick Toggle" for Priority (Star for Favorite, Trash for Archive).

### 5.2 The "Practice" (PracticeView.tsx)

*   **State Management:** Use a sessionQueue array to handle the endless loop.
*   **Animation:** Card flip must be smooth (Framer Motion animate={{ rotateY: flipped ? 180 : 0 }}).
*   **Typography:** Use large, clear sans-serif fonts for Greek to ensure the 'tonos' (accent) is visible.

6\. Phase 1 Implementation Goals
--------------------------------

1.  **Setup:** Initialize Supabase and Auth.
2.  **Ingestion:** Create the CSV upload and Vault list view.
3.  **Loop:** Build the Practice page with the "Endless Loop" queue logic.
4.  **Mastery:** Connect the Green/Yellow/Red buttons to the "Two-Track" DB fields.