PRD V2: The Greek Lexical Engine (Advanced Edition)
===================================================

1\. System Architecture (Data Model 2.0)
----------------------------------------

To support multi-user scaling and personal stats, we are shifting to a **Relational Overlay Model**.

### 1.1 words\_dim (The Global Dictionary)

*   **Unique Key:** greek\_text (Case-sensitive, normalized).
    
*   **Fields:** id, french\_text, part\_of\_speech, theme, frequency\_rank (1-10000, default -1), created\_by\_user\_id, ts\_created.
    
*   **Duplicate Logic:** If a user attempts to add a Greek word that already exists:
    
    *   System catches the unique constraint error.
        
    *   **Conflict UI:** "This word already exists. Keep existing translation ('\[Existing FR\]') or overwrite with yours ('\[New FR\]')? (Same for Theme)."
        

### 1.2 user\_word\_settings (The Personal Overlay)

*   **Fields:** user\_id, word\_id, is\_fav (bool), is\_archived (bool), last\_reviewed, average\_success\_rate, word\_heat
    

### 1.3 attempts\_history (The Event Fact Table)

*   **Fields:** user\_id, word\_id, timestamp, mode (Prod/Rec), outcome (Know/Meh/Forgot), interest\_toggle (Fav/Up/None/Down/Archive).
    

### 1.4 word\_packs (Grouping)

*   **Fields:** id, name, author\_id, description, is\_smart (bool), filter\_criteria (JSON), word\_count, ts\_created, ts\_last\_modified.
    

2\. Business Logic & Scoring Parameters
---------------------------------------

All scoring is derived from the attempts\_history table. These values must be defined in a config.ts or similar file for easy adjustment.

### 2.1 Success Rate Calculation

Every attempt is weighted:

*   **Know it:** $1.0$ (100%)
    
*   **Meh:** $0.3$ (30%)
    
*   **Forgot:** $0.0$ (0%)
    

**Success Rate Formula:**

$$\\text{Success Rate} = \\frac{\\sum (\\text{Attempt Weights})}{\\text{Total Attempts}} \\times 100$$

### 2.2 Interest Score (-30 to +30)

This represents the user's _expressed_ interest over time.

*   **Favorite:** $+30$ (Fav is the max state)
*   **Up:** $+5$
*   **Down:** $-5$
*   **Archive/Down:** $-30$ (Archive is the min state)
    
*   **Interest Value:** Calculated as a moving average of the last $N$ interactions (exclude interactions with no interest expressed) to show the "Word Heat" of the word.
    

3\. Feature Set V2
------------------

### 3.1 The Advanced Word Vault

*   **Tabs:**
    
    *   **My Library:** Words you have interacted with or added.
        
    *   **Added by Others:** Words in words\_dim not yet in your user\_word\_settings. Features an "Add to My Library" button.
        
*   **Personal Stats:** Each row shows % Success, Total Attempts, and the Interest Heat-map.
    
*   **Batch Actions:** Tick multiple words $\\rightarrow$ "Add to Pack" (Manual) or "Bulk Update Priority."
    

### 3.2 The Word Pack Engine

**A. Static Packs:** A fixed snapshot of words (e.g., "Geopolitics - May 2026").

**B. Smart Packs (Live):** Dynamic lists based on criteria:

*   **Filters:** Theme, Part of Speech, Fav Only, Exclude Archived.
    
*   **Sorts:** Top X by Interest, Bottom X by Success, Longest time since reviewed (excluding "Known" words).
    
*   **Batch UI:** Before creating a pack from filters, show the list with checkboxes. All are "Ticked" by default; user can untick specific words before finalization.
    

### 3.3 The Session Loop & Summary

*   **The Loop:** Endless cycle of the chosen Pack/Random set. After each "pass," words marked as "Knew it" are removed from the _current session memory_ only.
    
*   **Order:**
    
    1.  Favorites
        
    2.  Interest Score (Highest first)
        
    3.  Success Rate (Lowest first)
        
    4.  Frequency Rank (Most frequent first)
        
*   **The Exit:** A prominent "End Session" button.
    
*   **The Summary Page:** - Time elapsed.
    
    *   Total cards seen.
        
    *   "New Masteries" (Words that hit 100% success today).
        
    *   Accuracy % for this specific session.

Update values of user\_word\_settings at the end of the session 
        

4\. Technical Requirements
--------------------------

*   **Frequency JSON:** A pre-loaded 10,000-entry JSON file mapping Greek lemmas to rank.
    
*   **Duplicate Handling:** Implement a custom hook useAddWord that handles the words\_dim check and triggers the Conflict Resolution Modal.


Table definitions:

-- 1. EXTENSIONS & TYPES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Define the outcome types for history
CREATE TYPE attempt_outcome AS ENUM ('know', 'meh', 'forgot');
CREATE TYPE interest_toggle AS ENUM ('fav', 'up', 'none', 'down', 'archive');

-- 2. GLOBAL DICTIONARY (dim_words)
CREATE TABLE words_dim (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    greek_text TEXT NOT NULL UNIQUE, -- The "Unique Greek Word" constraint
    french_text TEXT NOT NULL,
    part_of_speech TEXT,
    theme TEXT,
    frequency_rank INT DEFAULT -1,
    created_by_user_id UUID REFERENCES auth.users(id),
    ts_created TIMESTAMPTZ DEFAULT NOW()
);

-- 3. USER PERSONAL SETTINGS (user_word_settings)
-- This table stores your personal stats and flags for each word
CREATE TABLE user_word_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    word_id UUID REFERENCES words_dim(id) ON DELETE CASCADE,
    is_fav BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    last_reviewed TIMESTAMPTZ,
    avg_success_rate_prod FLOAT DEFAULT 0.0, -- Calculated performance
    avg_success_rate_rec FLOAT DEFAULT 0.0, -- Calculated performance
    interest_score INT DEFAULT 0,       -- Calculated "heat" (-30 to +30)
    PRIMARY KEY (user_id, word_id)
);

-- 4. ATTEMPTS HISTORY (attempts_history)
-- The "Event Store" for every flashcard interaction
CREATE TABLE attempts_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    word_id UUID REFERENCES words_dim(id) ON DELETE CASCADE,
    mode TEXT CHECK (mode IN ('prod', 'rec')),
    outcome attempt_outcome NOT NULL,
    interest_interaction interest_toggle DEFAULT 'none',
    ts TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. WORD PACKS (word_packs)
CREATE TABLE word_packs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_smart BOOLEAN DEFAULT FALSE, -- Static vs Live
    filter_criteria JSONB DEFAULT '{}'::jsonb, -- Store the Smart Pack filters here
    ts_created TIMESTAMPTZ DEFAULT NOW(),
    ts_last_modified TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for Manual Word Packs
CREATE TABLE word_pack_items (
    pack_id UUID REFERENCES word_packs(id) ON DELETE CASCADE,
    word_id UUID REFERENCES words_dim(id) ON DELETE CASCADE,
    PRIMARY KEY (pack_id, word_id)
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX idx_attempts_user_word ON attempts_history(user_id, word_id);
CREATE INDEX idx_words_greek ON words_dim(greek_text);
CREATE INDEX idx_word_packs_author ON word_packs(author_id);

-- 7. ROW LEVEL SECURITY (RLS)
ALTER TABLE words_dim ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_pack_items ENABLE ROW LEVEL SECURITY;

-- Policies: Words are viewable by all, but settings/history are private
CREATE POLICY "Words are readable by all" ON words_dim FOR SELECT USING (true);
CREATE POLICY "Users can add words" ON words_dim FOR INSERT WITH CHECK (auth.uid() = created_by_user_id);

CREATE POLICY "Settings are private" ON user_word_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "History is private" ON attempts_history FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Packs are private" ON word_packs FOR ALL USING (auth.uid() = author_id);
CREATE POLICY "Pack items are private" ON word_pack_items FOR ALL USING (
    EXISTS (SELECT 1 FROM word_packs WHERE id = pack_id AND author_id = auth.uid())
);



7\. Iteration 2: Functional & Technical Updates
-----------------------------------------------

### 7.1 Database & Schema Evolution

*   **Table user\_word\_settings:** Added review\_count (INT, default 0) to track total exposure to a word.
    
*   **Trigger Logic:** Every successful or failed attempt logged in attempts\_history must increment the review\_count for that specific user\_id and word\_id.
    

### 7.2 Word Vault Enhancements

*   **New Columns:** - Frequency Rank: Displays global rank from words\_dim.
    
    *   Review Count: Displays personal interaction count.
        
    *   Interest Heat: A dedicated column for the -30 to +30 calculated score.
        
    *   Success %: A dedicated column for mastery (100/30/0 weight).
        
*   **UI Interaction:**
    
    *   **Sortable Headers:** All columns now feature toggleable sort arrows (Asc/Desc).
        
    *   **Advanced Filtering:** A multi-filter bar allowing cumulative filtering by Theme, Success (Range), Frequency (Range), Heat (Range), Review Count (Range), and Status (Faved/Archived).
        
    *   **Batch Actions:** Checkbox multi-select allows users to select a group of words and click "Create/Add to Word Pack."
        

### 7.3 Practice Entry & Flashcard UI

*   **Practice Entry Modal:** Users now choose between:
    
    1.  **Word Packs:** Selecting from manually created or "Smart" packs.
        
    2.  **Smart Shuffle (Default):** A dynamic session of the top 50 words based on priority logic (Favorites > Boosted > Standard).
        
*   **The "Interest Axis":** The back of the flashcard now features a secondary row of buttons to update personal interest in real-time:
    
    *   **Actions:** Fav (+30), Up (+5), None (0), Down (-5), Archive (-30).
        
    *   **Impact:** These interactions update user\_word\_settings and are logged as events in attempts\_history.
        

### 7.4 Refined Session Logic

*   **Endless Loop 2.0:** The session queue is dynamic. If a word is marked "Known," it is removed from the _current session memory_. If marked "Meh" or "Forgot," it remains in the loop.
    
*   **Session Order:** 1. is\_fav = true.2. interest\_score (Descending).3. avg\_success\_rate (Ascending - show hardest first).4. frequency\_rank (Ascending - show most common first).
    
*   **Session Summary:** An explicit "End Session" button triggers a summary showing time spent, total cards seen, and new masteries achieved.