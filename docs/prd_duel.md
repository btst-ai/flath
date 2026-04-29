teration 3 Supplement: The Duel (Final Spec)
============================================

1\. The Lobby (Setup)
---------------------

Before the session starts, a Lobby UI allows for the following configuration:

*   2\. **Smart Shuffle:** Dynamically picks words based on priority.3. **Word Pack:** Select a manually created list.
    
*   **Smart Shuffle Data Source (If selected):**
    
    *   Options: \[Player 1 Ranks\] | \[Player 2 Ranks\] | \[Average of Both (Default)\].
        
*   **Player 2 Config:**
    
    *   Email input (to sync P2 progress). No password required.
        
    *   Name/Flag toggles: P1 (Baptiste/🇫🇷), P2 (Efi/🇬🇷).
        

2\. Competitive Logic & State Machine
-------------------------------------

### 2.1 The "First Player" (Winner) Tie-Break

When both players have entered their claims (ZXC/BNM), the "Winner" (the one who must speak) is determined by:

1.  **Confidence Level:** "I Know" (B/Z) > "Meh" (X/N) > "Don't Know" (M).
    
2.  **Speed:** If Confidence is equal, the faster timestamp wins.
    

*   _Example:_ If P1 hits "Meh" at 100ms, but P2 hits "I Know" at 400ms, **P2 wins** because of higher confidence.
*   Players can change their inputs as long as the next one hasn't type its 
    

### 2.2 The Dual-Confirmation Grading Loop

To move from one card to the next, a strict confirmation sequence is required:

1.  **Execution:** The Winner speaks the answer.
    
2.  **Reveal:** Any key flips the card to the back.
    
3.  **Grading:**
    
    *   **P2 grades P1's speech:** Was the spoken answer Right/Meh/Wrong? (Uses BNM).
        
    *   **P1 grades P2's claim:** Since P2 didn't speak, P1 "confirms" if P2 likely knew it or was bluffing. (Uses ZXC).
        
4.  **Lock-In (Confirmation):**
    
    *   The "Next" step is only available once **both** players confirm the grades.
        
    *   **P1 must type 'q'** and **P2 must type 'p'** to confirm.
        
5.  **Score & Countdown:** Once confirmed, the score updates. **Any keyboard stroke** starts the 3, 2, 1 countdown to the next card.
    

3\. Scoring & The "Roast"
-------------------------

### 3.1 Scoring Matrix

*   **Speed Multiplier:** The "Winner" (determined in 2.1) has their points **doubled** ($x2$).
    

**ClaimPeer-Validated: RIGHTPeer-Validated: MEHPeer-Validated: WRONGI Know**+20-3**Meh**+1+0.5-0.5**Don't Know**+0.5+0.50

### 3.2 The Roast Mechanic

If a player’s score is negative ($< 0$), the UI displays a "Roast" message that gets more aggressive as the score drops.

*   _0 to -5:_ "Is your brain in 'Airplane Mode'?"
    
*   _\-5 to -15:_ "Maybe stick to French for a while?"
    
*   _Below -15:_ "The Greek gods are literally laughing at you right now."
    

4\. Post-Game Analytics
-----------------------

*   **Victory Screen:** Displays the winner, final scores, and total session time.
    
*   **Evolution Chart:** A line graph showing the score gap widening/closing over the 50 cards.
    
*   **Syncing:** P1 attempts are saved to attempts\_history. If P2 is a synced email, their progress is also saved to their account.
    

### PM Strategic Advice for the Build

1.  **Keyboard Conflicts:** Ensure Cursor uses a keydown event listener that can handle simultaneous presses. Browsers sometimes struggle if two keys hit the exact same millisecond.
    
2.  **UI Cues:** During the "Lock-In" phase, show two small lights (Red/Green). When P1 hits 'q', P1's light turns green. When P2 hits 'p', P2's light turns green. This makes the confirmation feel like a "ready check" in a video game.
    
3.  **The "Average" Shuffle:** For the Smart Shuffle "Average," tell Cursor to take the avg\_success\_rate of both users and sort ascending (showing words that _both_ struggle with).