# Cricket Scoring App - Architecture & Workflow Plan

## 1. Overview
The application is a real-time cricket scoring platform divided into two main interfaces:
1. **Scorer Interface (Admin/Umpire):** An interactive dashboard used by the official scorer on the ground to update match events ball-by-ball.
2. **Public Interface (Viewer):** A read-only, real-time scorecard view for fans and players to track the match progress, statistics, and fall of wickets.

## 2. User Roles
* **Scorer:** Creates matches, selects teams, adds players, and inputs ball-by-ball data (runs, wickets, extras, etc.).
* **Public User:** Views the live scorecard, detailed player statistics, and match analysis without any edit permissions.

---

## 3. Working Flow: Scorer Interface (Based on Video)
This flow is designed for quick, one-handed operation during a live match.

### Step 3.1: Match Initialization
* **Setup Teams:** Enter/select the Host Team and Visitor Team.
* **Toss Details:** Select which team won the toss and their decision (Bat or Bowl).
* **Match Configuration:** Specify the number of overs for the match.
* **Opening Setup:** Select the opening Striker, Non-striker, and the Opening Bowler.

### Step 3.2: Main Scoring Dashboard
The scorer uses a dashboard with several sections:
* **Match Status:** Shows current score, wickets, overs, and Current Run Rate (CRR).
* **Active Players:** Real-time stats for the two active batsmen (Runs, Balls, 4s, 6s, Strike Rate) and the current bowler (Overs, Maidens, Runs, Wickets, Economy Rate).
* **Current Over Timeline:** A visual representation of balls bowled in the current over (e.g., `0`, `1`, `W`, `4`).
* **Event Controls:** 
    * **Runs:** Quick buttons for `0`, `1`, `2`, `3`, `4`, `5`, `6`, and `...` (custom runs).
    * **Extras:** Checkboxes for `Wide`, `No Ball`, `Byes`, `Leg Byes`.
    * **Wicket:** A checkbox/button to record a fall of wicket.
    * **Management:** Buttons to `Undo` the last ball, `Swap Batsman` (strike change), or `Retire` a player.

### Step 3.3: Handling Special Events
* **Wicket Fall:** Opens a prompt to select the dismissal type (Bowled, Caught, Run Out, etc.) and enter the incoming batsman's name.
* **Over Complete:** Prompts the scorer to select a new bowler for the next over.
* **Retire:** Allows the scorer to retire an active batsman and select a replacement.

---

## 4. Working Flow: Public Interface (Based on Photo)
This flow focuses on displaying comprehensive match data clearly.

### Step 4.1: Live Scoreboard View
* **Match Header:** Shows team names and the toss result.
* **Current Score:** Prominent display of runs, wickets, and overs (e.g., `Royal CIT 8-2 (1.1)`).
* **Batting Card:** 
    * Lists all batsmen who have batted or are currently batting.
    * Shows dismissal status (e.g., "b Divya" for bowled by Divya) or "not out".
    * Columns: Runs (R), Balls (B), Fours (4s), Sixes (6s), Strike Rate (SR).
* **Extras & Total:** A breakdown of extras (Byes, Leg Byes, Wides, No Balls, Penalties) and the total team score.
* **Bowling Card:** 
    * Lists all bowlers who have bowled.
    * Columns: Overs (O), Maidens (M), Runs (R), Wickets (W), Economy Rate (ER).
* **Fall of Wickets:** A timeline showing at what score and over each batsman was dismissed (e.g., `Darshna 7/1 (1.0)`).

---

## 5. System Architecture & Data Model

To support real-time updates from the Scorer to the Public Users, the system should use a real-time database (like Firebase Realtime Database, Firestore, or a WebSocket-based backend with Node.js/Socket.io).

### 5.1. Database Collections / Tables
1. **Matches:**
    * `match_id`, `team_a_id`, `team_b_id`, `toss_winner_id`, `toss_decision`, `total_overs`, `status` (live, completed).
2. **Innings:**
    * `inning_id`, `match_id`, `batting_team_id`, `bowling_team_id`, `total_runs`, `total_wickets`, `overs_bowled`.
3. **Players:**
    * `player_id`, `name`, `team_id`.
4. **Deliveries (Ball-by-Ball):** This is the most crucial table for generating the scorecard.
    * `delivery_id`, `inning_id`, `over_number`, `ball_number`.
    * `bowler_id`, `striker_id`, `non_striker_id`.
    * `runs_scored` (off the bat).
    * `extras_type` (none, wide, no_ball, bye, leg_bye), `extras_runs`.
    * `is_wicket` (boolean), `wicket_type` (bowled, caught, etc.), `dismissed_player_id`, `fielder_id` (if applicable).
    * `timestamp`.

### 5.2. Backend Logic
* **Score Aggregation:** Instead of updating the total score manually, the backend should calculate the total score, player stats, and over timelines dynamically by aggregating the `Deliveries` data for the specific `inning_id`.
* **Real-time Sync:** When the Scorer app pushes a new `Delivery` object, the backend broadcasts this update to all clients viewing the Public Scoreboard, causing the UI to refresh instantly.

### 5.3. Tech Stack Recommendation
* **Frontend (Scorer & Public):** React Native or Flutter (for cross-platform mobile apps) or React/Next.js for progressive web apps.
* **Backend:** Node.js with Express.
* **Database:** MongoDB (for storing static match data) + Socket.io / Firebase (for real-time ball-by-ball updates).
