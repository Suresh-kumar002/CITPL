# CIT Premier League (CITPL) — Feature, Workflow, Admin Permission aur System Architecture Report

> **Report ka scope:** Yeh document repository mein maujood HTML, JavaScript, CSS, data headers aur architecture notes ko padhkar current implementation ka varnan karta hai. Jahan screen par dikhne wala claim aur code ka behavior alag hai, wahan farq ko jaan-boojhkar highlight kiya gaya hai. Yeh report feature specification aur implementation guide hai; ise hosted production backend ya audited security assessment nahi maana jaana chahiye.

## 1. Executive summary

CIT Premier League (CITPL) ek college cricket league ke liye banaya gaya multi-page web application hai. Iska user-facing experience league home page, player registration, team/player directory, auction room, live score, match pages, points table, captain/team-owner portal, scorekeeper console aur admin suite mein bata hua hai. League ka intended lifecycle registration se shuru hota hai, admin player approvals karta hai, teams aur owners banata hai, auction mein eligible players ko franchise teams mein assign kiya jaata hai, aur scorekeeper console match ka ball-by-ball score public scoreboard ko dikhata hai.

Is repository ka main league data model abhi bhi browser-side hai. HTML pages JavaScript files load karke UI banate hain. Common league data ke liye `js/firebase-config.js` mein `CITPLFirebaseEngine` naam ka class hai, par uske actual persistence operations `localStorage` mein JSON read/write karte hain; file naam mein Firebase hone se cloud Firebase backend siddh nahi hota. Player/team sign-in `sessionStorage`/local data par nirbhar hai. CSV tools data export/download ke liye hain, server par CSV ko automatic database ke roop mein update karne ke liye nahi. Naya `server.mjs` admin login ke liye hashed password verification aur HTTP-only session cookie deta hai; isse league data apne-aap server par migrate ya devices ke beech sync nahi hota.

Admin credentials source code mein nahi hote. Node server `ADMIN_EMAIL` aur salted scrypt `ADMIN_PASSWORD_HASH` ko private environment se padhta hai; login par rate limit lagti hai aur session cookie `HttpOnly`, `SameSite=Strict` hoti hai. `.env` ko commit na karein. Admin login ke liye server process chalna aur frontend ko usi origin se serve hona zaroori hai. GitHub Pages workflow sirf static preview deploy karta hai, Node API nahi. Existing teams/players/matches/features aur unke writes ab bhi browser `localStorage` mein hain, server-authoritative league-data authorization nahi.

Ek mahatvapurn technical distinction scoring mein hai. `pages/scorekeeper.html` apna match/scoring state `citpl_scorer_v2` key mein rakhta hai aur public pages ke liye `CITPL_SCORE` JSON publish karta hai. `js/firebase-config.js` mein ek doosra `liveMatch`, scorekeeper assignment/lock aur `recordBall()` pathway bhi maujood hai. Inspected scorekeeper page apne ball-scoring functions mein is data-engine method ko call nahi karta; isliye in dono pathways ko ek hi synchronized scoring backend samajhna galat hoga. Iska asar neeche permission aur live update ke sections mein detail se diya gaya hai.

Repository mein role-aware UI, auction workflow, purse accounting, player approval aur browser-based score display hain. Alag state stores, legacy player/team browser credentials, hard-coded match IDs aur restore wiring ko live tournament se pehle test/fix karna zaroori hai.

## 2. Application overview aur navigation

`index.html` public landing page hai: league introduction, live match, auction, registration, teams/players aur tournament leadership sections. Kuch text/counters promotional ya sample ho sakte hain. `js/dashboard.js` kuch counters aur live/auction status `window.citplDB.db` aur `CITPL_SCORE` se render karta hai; static aur runtime values alag rakhein.

Public-facing pages ka broad purpose:

| Page | Mukhya kaam | Data/behavior ka verified sanket |
|---|---|---|
| Home (`index.html`) | League overview, navigation, live/auction highlights | Dashboard JavaScript local browser state padhta hai; static marketing copy bhi hai. |
| Live (`pages/live.html`) | Match scorecard aur live presentation | `CITPL_SCORE` localStorage key padhi jaati hai; storage event par reload hota hai. |
| Auction (`pages/auction.html`) | Owner bidding aur admin auction control | Role ke hisab se alag tabs; shared `citplDB` state. |
| Projector (`pages/auction-live.html`) | Auction stage/projector display | Auction state ko render karta hai aur data-engine updates subscribe karta hai. |
| Matches (`pages/matches.html`) | Admin-managed fixtures, status aur result/draw | Schedule `citplDB.matches` se render hota hai; blank state tab tak rahegi jab tak admin fixtures add na kare. |
| Teams (`pages/teams.html`) | Franchise owners aur squads | Team/player relation se squad render hoti hai. |
| Players (`pages/players.html`) | Player directory aur stats | Player/team state padhi jaati hai. |
| Points table (`pages/points-table.html`) | Standings/points presentation | Calculation aur available match-result data ko source se alag verify karna chahiye. |
| Registration (`pages/register.html`) | Player application submit karna | Form data `registerPlayer()` ko diya jaata hai. |
| Login (`pages/login.html`) | Existing user sign-in | `js/app.js` login response ke normalized role ke hisab se redirect karta hai. |
| Captain (`pages/captain.html`) | Owner ki squad aur Playing XI draft | Current user `TEAM_OWNER` aur linked `teamId` hona chahiye. |
| Scorekeeper (`pages/scorekeeper.html`) | Match create, score, scorecard/history | Page-level guard `ADMIN` ya `SCOREKEEPER` role mangta hai. |
| Admin (`pages/admin.html`) | Player, teams, permissions, backup aur monitoring | Admin session aur admin role dono verify kiye jaate hain. |

`js/app-shell.js` role-aware mobile navigation banata hai: owner ko auction/captain, admin ko admin/scorekeeper, scorekeeper ko scorekeeper link mil sakta hai. Yeh convenience hai, authorization ka substitute nahi. Sensitive writes par permission alag enforce honi chahiye.

## 3. User roles aur permission matrix

Role values `ADMIN`, `TEAM_OWNER`, `SCOREKEEPER`, `PLAYER` aur public/anonymous state ho sakte hain. `normalizeRole()` `SUPER_ADMIN`/`AUCTION_ADMIN` ko `ADMIN`, aur `CAPTAIN` ko `TEAM_OWNER` map karta hai. Login redirect role se tay hota hai, lekin routing aur har mutation ki permission ek nahi.

| Role | Intended access | Current code mein dikhne wale actions | Important boundary |
|---|---|---|---|
| ADMIN | League-wide operator | Server-verified admin login ke baad admin suite, auction controls, team/owner creation, player decision, scorekeeper assignment/lock, export/backup; auction admin tabs | Login session Node API se verify hota hai; league-data writes ab bhi client/localStorage mein hain aur multi-device secure database nahi. |
| TEAM_OWNER / CAPTAIN | Apni franchise manage karna | Auction bid, apna team purse/squad dekhna, Playing XI draft | Auction bidding mein owner/team link, purse, roster cap, active lot aur timer validation hai. Captain page selected user ke teamId se team load karta hai. |
| SCOREKEEPER | Match scoring | Scorekeeper page par match setup aur score controls dikhte hain | Page role guard hai; assigned email/lock wala data-engine check scorer ke active scoring calls se linked nazar nahi aata. |
| PLAYER | Player identity/profile | Registration ke baad login/player pass ya public league pages | Player ka pending status auction eligibility se alag hai; approve hone se pehle player auction pool mein nahi aata. |
| PUBLIC / signed-out | Read-only league browsing | Public live, teams, players, fixtures aur points pages | Login/role UI guard ko server-side access control nahi kaha ja sakta; data browser mein hota hai. |

Admin page `checkAdminAuth()` Node API se restore hue admin session ko maangta hai. Scorekeeper page `ADMIN` ya `SCOREKEEPER` allow karta hai; owner dashboard `TEAM_OWNER` aur `teamId` check karta hai. Admin ke baaki league operations ab bhi local client data-engine par hote hain; is backend mein teams/matches/auction ke protected data APIs nahi hain.

### Server-backed admin login chalana

1. Node.js 18+ install karke repository root mein `npm run admin:setup` chalayein. Prompt par admin email aur naya password type karein; password input terminal mein hidden rehta hai. Script `ADMIN_EMAIL` aur salted scrypt hash deta hai.
2. `.env.example` ko `.env` naam se copy karein, setup output ki `ADMIN_EMAIL` aur `ADMIN_PASSWORD_HASH` values `.env` mein paste karein. `.env` Git se ignored hai; ise commit/share na karein.
3. `npm start` chalayein aur `http://localhost:3000/pages/login.html` kholein. Sign-in ke liye “Sign in to the admin panel” checkbox select karein. Yeh server hi frontend files bhi serve karta hai, jisse session cookie same-origin rahe.
4. Deployment host par `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, `NODE_ENV=production`, `HOST=0.0.0.0` aur platform ka `PORT` environment variables mein set karein. HTTPS reverse proxy/origin ke peeche `APP_ORIGIN` ko exact public origin par set karein.
5. `.github/workflows/deploy-pages.yml` Node server host nahi karta; woh ab bhi sirf read-only `preview/` folder GitHub Pages par publish karta hai. Admin login ke liye Node server run karne wala host chahiye. Existing localStorage tournament data admin ke browser se doosre devices par sync nahi hota.

## 4. Player registration aur approval flow

Registration (`pages/register.html`) naam, mobile, email, password, branch, semester, role/category, UPI transaction reference aur photo leti hai. UI ₹50 fee dikhata hai. Reference collect hona payment process, bank verification ya gateway webhook ka proof nahi.

`registerPlayer()` player ID, registration ID, profile data, transaction ID, `PENDING`, `paymentVerified: false`, `teamId: null` aur initial stats save karta hai. `users` list mein `PLAYER` account bhi add/update hota hai. Handler auto-login karke ID dikhata hai. Password browser database ke plain JSON mein hai; yeh production-grade storage nahi.

Admin pending players filter karta hai. `approvePlayer(id)` status `APPROVED` aur `paymentVerified: true` karta hai; reject action `REJECTED` aur false set karta hai. `getNextAuctionPlayer()` unassigned `APPROVED` player chunta hai, isliye approval auction eligibility gate hai. Sale par `SOLD`, lot outcome par `UNSOLD` ho sakta hai.

Payment approval text UI mein payment verification ko imply karta hai, lekin observed handler manual approve/reject status set karta hai; external transaction validation ka code confirm nahi hua. Admin ko UTR dekh kar manual verification karni hoti hai, jab tak project ke bahar koi process na ho. Report ke liye yeh distinction zaroori hai: registration fee policy aur actual integrated payment processing alag baatein hain.

## 5. Admin panel ka complete workflow

Admin suite league operations ke liye hai. Page `firebase-config.js`, CSV manager aur app-shell load karta hai. Node server admin HTML ko valid session ke bina serve nahi karta; `checkAdminAuth()` restored admin role bhi verify karta hai. `pageshow` par dashboard/auction monitor render hote hain; admin sign-out server session revoke karta hai.

Dashboard registration/team counts arrays se calculate karta hai aur scorekeeper/lock label `liveMatch` se dikhata hai. CSV export, JSON backup aur Restore UI hain. JSON backup `citplDB.db` download karta hai; Restore input `importTournamentData(event)` refer karta hai, par inspected script mein handler nahi mila. Restore ko functional kehne se pehle test karein.

Admin ke primary workflows:

1. **Registration review:** pending profile/reference dekhkar approve/reject karein.
2. **Team/owner administration:** `createTeamByAdmin()` linked `TEAM_OWNER` banata hai. `deleteTeamByAdmin()` team/account remove aur players unassign karta hai; accounting consistency test karein.
3. **Auction supervision:** current lot, highest bid/team, history aur purse monitor karein. Auction page par pause/resume, Going Once/Twice, SOLD, UNSOLD, Next Lot controls hain; admin page projector link deta hai.
4. **Scorekeeper:** email/password assignment aur lock/unlock `liveMatch` methods call hote hain; hard-coded match ID section 9 mein.
5. **Data:** CSV downloads aur JSON backup section 12 mein.
6. **Settings/transfers:** admin timer, increment, squad cap, purse aur extension set kar sakta hai. Transfer approval player-team/purse/count badalta hai; requester ownership validation test karein.

`auditLogs` mein team creation, assignment, lock aur auction actions aa sakte hain. Yeh local trace hai, tamper-proof audit system nahi.

## 6. Team creation, owner assignment aur captain portal

Admin franchise name/short code, owner name/email, password aur purse deta hai. Engine team ID aur `startingPurse`, `remainingPurse`, `totalSpent`, `squadCount`, standings fields aur timestamp rakhta hai. Owner user `TEAM_OWNER` aur wahi `teamId` paata hai. Form defaults code values hain, tournament policy ka proof nahi.

`js/app.js` owner ko auction par redirect karta hai. Owner tabs Live Bidding, My Squad aur Bid History hain; bidding view purse, squad cap/spent aur next bid dikhata hai. `pages/captain.html` valid `TEAM_OWNER`/`teamId` ke saath purse, squad aur Playing XI draft dikhata hai.

Playing XI selection current team ke squad players tak seemit hai. UI 11 se adhik selections rokne ki koshish karta hai, aur save par selected player IDs team ke `playingXI` field mein aur timestamp `playingXIUpdatedAt` mein store hota hai. Text “draft” kehta hai; code selection 11 se kam hone par bhi save karne se mana nahi karta. Isliye complete, exactly-11 finalized XI enforcement ka dawa nahi karna chahiye. Captain page selection ko render karte waqt pehle 11 players tak limit bhi karta hai. Match scorer ka opening lineup, owner ke saved Playing XI se automatically populate hota hai—iska source evidence nahi mila.

Public teams page owner name aur us team ke `teamId` se linked players dikhata hai. Auction ke SOLD operation se player-team link banne par squad page aur team purse dono update hone ka intended data path hai.

## 7. Auction ka end-to-end flow

Auction se pehle admin teams banata aur players approve karta hai. `getNextAuctionPlayer()` unassigned `APPROVED` player dhoondhta hai. Admin-only `advanceAuctionToNextPlayer()` lot close hone tak next lot rokta hai; player na mile to `AUCTION_COMPLETE`. Naye lot par player, lot number, base bid, increment aur deadline set hote hain. Base price player `basePrice` ya fallback se; timer/increment settings se aate hain.

`placeBid(amount)` session email ko stored account se match karke owner role/team, active lot, unassigned player, timer, highest bidder, exact next bid, squad cap aur purse validate karta hai. Valid bid current bidder, timestamp, history aur audit log update karti hai. Deadline reset hoti hai; aakhri seconds mein extension mil sakta hai.

Admin auction control mein:
- **Pause:** remaining seconds store karke deadline null ki jaati hai.
- **Resume:** saved timer ke basis par deadline dobara banayi jaati hai.
- **Going Once/Going Twice:** auction state transition allow-list ke anusaar badalta hai; bid button active status ki conditions se prabhavit hota hai.
- **SOLD:** `markPlayerSold()` sirf admin ke liye hai. Active player, winning team aur current bid amount match karne chahiye. Player `teamId`, `auctionPrice`, `SOLD` status aur sold timestamp paata hai; team remaining purse ghatta hai, total spent aur squad count badhte hain.
- **UNSOLD:** `markPlayerUnsold()` active player ko `UNSOLD` set karta hai, deadline rokta hai aur highest bidder clear karta hai. Aage dobara unsold players ko lot mein lane ka dedicated re-auction mechanism inspected flow se confirm nahi hota.
- **Next Lot:** current lot ko pehle SOLD/UNSOLD close karna data method ka rule hai. UI confirmation message isko bypass karne ka option jaisa dikha sakta hai, lekin engine method phir bhi reject kar sakta hai.

Admin purse/current bid/history dekhta hai. `auction-live.html` subscribed auction state se player, category, status, timer, bids aur teams render karta hai. Same-origin tabs refresh ho sakte hain; remote database ke bina alag devices ka shared state guaranteed nahi. Timer client clock par hai.

## 8. Match setup aur scorekeeper scoring workflow

`pages/scorekeeper.html` mobile-friendly scorer console hai. Setup mein dono team names, overs, toss winner/decision chune jaate hain; phir striker, non-striker aur bowler. Registered schedule se roster guaranteed load hona confirm nahi; name-entry/history suggestions ho sakti hain.

Live console mein runs, extras aur wicket toggle ke saath ball entry hoti hai:
- Runs ke baad batsman ke runs, balls, fours/sixes aur team total update hote hain.
- Wide/no-ball legal-ball count ko alag handle karte hain; byes/leg-byes extras mein count hote hain.
- Wicket par dismissal mode, dismissed batter aur incoming batter select karne ka flow hai.
- Odd runs strike rotate karte hain; over complete hone par strike change aur agla bowler select karne ka prompt hota hai.
- Retire flow aur undo stack maujood hain.
- Innings end wickets/overs/target conditions se hota hai; doosri innings mein target chase aur result message calculate hota hai.
- Scorecard batting/bowling tables, over timeline, fall-of-wickets, match history, result aur team/player views dikhane ke functions hain.

UI `citpl_scorer_v2` mein match save karta hai; `syncLivePublic()` innings ko `CITPL_SCORE` shape mein publish karta hai. Live page/dashboard yeh key padhte hain; same-origin tabs storage event se refresh ho sakte hain. Public bowler mapping mein maidens zero set hote hain; field dikhna accurate calculation ka proof nahi.

`js/firebase-config.js` mein alag `liveMatch`, `recordBall()` aur `canUserUpdateScore()` pathway hai. Inspected scorer UI ka `ball()`/`save()` ise call nahi karta; woh apne `M` state par chalta hai. Assignment/lock aur active scorer alag pathways hain. Public feed active console se aati hai. Scorer save errors chupaye ja sakte hain.

## 9. Scorekeeper assignment aur admin permission

Admin form selector dikhata hai, par `handleAssignScorekeeperSubmit()` uski value nahi padhta; `assignScorekeeperToMatch("match_105", email, pass)` hard-code karta hai. Engine admin role check karke `liveMatch.assignedScorekeeper`, `SCOREKEEPER` account, `assignedMatch`, password aur audit record save karta hai. Lock toggle `liveMatch.isLockedByAdmin` badalta hai.

`canUserUpdateScore()` admin ko allow karta hai; doosre user ke liye match, unlocked state aur assigned email match chahiye. `recordBall()` ise call karta hai, isliye is method se write hone par check lagu ho sakta hai.

Lekin active scorer page ka guard sirf current role `ADMIN` ya `SCOREKEEPER` check karta hai. Is page ke visible scoring functions `recordBall()` use nahi karte, aur apne local `citpl_scorer_v2` state mein score likhte hain. Isliye source se yeh establish nahi hota ki assigned email ya `liveMatch.isLockedByAdmin` actual scorer UI mein ball entry ko rokta hai. Sirf scorekeeper role wala koi bhi logged-in user page guard paar kar sakta hai; page mein assignedMatch ka per-match check nahi dikh raha. Isse “Admin ne assign kiya hai isliye doosre scorer score nahi kar sakte” wala UI claim engine pathway par nirbhar hai, active console par verified enforcement nahi.

Yeh operationally high-priority gap hai. Saath hi browser localStorage/sessionStorage client-controlled hain; browser-side guard malicious ya technically savvy user ke khilaf server authorization nahi. Secure tournament deployment ke liye authoritative backend, server-side role and match assignment checks aur audit events chahiye. UI dropdown se match select hona tab tak meaningful nahi jab tak selected ID handler/data method tak consistently pass na ho.

## 10. Public live score, matches, teams, players aur standings

Live page `CITPL_SCORE` se teams, innings, batters/bowlers, target, timeline aur result fields padh sakta hai. Key change par refresh WebSocket/cloud push nahi. Storage event same-browser tabs ko update kar sakta hai, alag device ka localStorage nahi. Cross-device feed source se confirm nahi.

Home dashboard counts/season data engine aur live score `CITPL_SCORE` se le sakta hai. Teams page owner/squad aur players page profile/category/team/auction price dikhata hai. Admin suite mein fixtures create, edit, delete aur status/result (draw/no-result samet) update kiye ja sakte hain; public matches page yahi `citplDB.matches` data render karti hai. Matches browser ke local storage mein hain, isliye abhi alag device/browser ke users ko admin ke updates sync nahi hote. Points table standings dikha sakta hai, lekin completed match se automatic update core flow mein confirm nahi; `liveMatch` aur scorer result integration alag hai.
Admin suite mein admin title, description, category, image aur optional link ke saath custom website feature/update add, edit, publish/unpublish ya delete kar sakta hai. Sirf published items public home page par dikhte hain. Uploaded image browser local storage mein save hoti hai (500 KB limit); data shared devices ke beech sync nahi hota.

Isliye public pages ki UI functionality aur fully populated league data ko alag samjhein. Static landing page examples, default labels ya empty-state messages ko actual tournament facts na maanein. Standings/Orange Cap/ Purple Cap claims ko tabhi final report mein “automatic” bolna chahiye jab data update/calculation code actual match completion se connected ho.

## 11. Data model aur technical architecture

Current observed browser-side flow ko is tarah samjha ja sakta hai:

```text
User / Admin browser
        |
        v
HTML page + JavaScript UI
        |
        +--> CITPL data engine (window.citplDB)
        |       |
        |       +--> localStorage: CITPL_DATABASE_STORE_2026
        |       +--> sessionStorage: CITPL_CURRENT_USER / admin session marker
        |       +--> subscribe callbacks + browser storage events
        |
        +--> Scorer page ka apna state
                |
                +--> localStorage: citpl_scorer_v2
                +--> public projection: CITPL_SCORE
                            |
                            +--> Live page / dashboard read
```

`window.citplDB.db` mein `season`, `settings`, `users`, `players`, `teams`, `matches`, `customFeatures`, `auctionState`, `liveMatch`, `pendingTransfers`, `notifications` aur `auditLogs` hain. Player/owner `teamId` se franchise se link hain. `customFeatures` admin-authored content cards aur unki optional images/links rakhta hai. Auction state lot, bid, highest team, deadline/history rakhti hai. `liveMatch` assignment/lock rakhta hai; scorer page ka local model alag hai.

Engine JSON ko `CITPL_DATABASE_STORE_2026` mein rakhta hai. `subscribe()` same-page UI refresh karta hai; `storage` event same-origin tabs ko signal kar sakta hai. `sessionStorage` user state rakhta hai, `CITPL_SCORE` local public projection hai. Yeh central multi-user database nahi.

`js/firebase-config.js` ka naam Firebase suggest karta hai, par inspected code mein initialization `localStorage` se hai; actual Firebase SDK, Firestore/Realtime Database read-write, cloud authentication request ya server API call verify nahi hua. `scoring_architecture_plan.md` real-time backend/Firestore/WebSocket aur delivery aggregation jaise future design ideas discuss karta hai. Woh plan current implementation ka proof nahi hai.

## 12. Persistence, backup aur CSV

`js/csv-manager.js` CSV headers rakhta hai; `toCSV()` text banata aur `downloadCSV()` browser download trigger karta hai. Export-all populated categories ki alag files download karta hai, ZIP nahi.

Specific downloads players, teams, matches, auction aur scores ke liye hain. `scores.csv` `db.scores` dekhta hai; active scorer `citpl_scorer_v2`/`CITPL_SCORE` use karta hai aur delivery rows sync hoti confirm nahi. Ise complete score backup na maanein.

JSON backup `citplDB.db` snapshot download karta hai aur ab `users`/`players` se password fields hata deta hai. CSV user/player exports mein bhi password columns nahi hote. Restore input handler ka naam refer karta hai, lekin implementation nahi mili; ise verified feature na kahein. `syncToLocalStorage()` timestamp set karta hai, CSV file nahi; CSV manually download hoti hai.

Recommendations: tournament use se pehle actual browser profile ka JSON backup test karein, restore round-trip test add karein, scorekeeper match data ko defined export schema mein jodein, aur file download success/failure ka visible status dein. Yeh recommendations hain, existing guarantee nahi.

## 13. Observed limitations, inconsistencies aur recommendations

| Priority | Observed fact | Impact | Suggested improvement |
|---|---|---|---|
| High | Firebase-named engine localStorage use karta hai; cloud SDK/network backend confirm nahi. | Different devices par shared data aur central authority nahi. | Authoritative backend aur authenticated API/database add karein; deploy se pehle cross-device tests karein. |
| High | Active scorer `citpl_scorer_v2` save karta hai; assignment/lock `liveMatch` pathway mein hai. | Admin grant/lock live scorer entry par enforce hota dikhta nahi. | Scorer writes ko server-side authorized match endpoint se route karein; end-to-end tests likhein. |
| High | Client storage mein users/passwords aur role fields hain. | Browser inspection/tampering se credentials/data expose ya modify ho sakte hain. | Password hashing, server sessions, HTTPS, role checks server par aur secrets rotation use karein. |
| High | Scorekeeper match selector actual submit handler mein selected value ke badle hard-coded ID bhejta hai. | Admin galat match ke liye permission grant kar sakta hai. | Selected match ID validate karke assignment aur score writes mein ek hi ID pass karein. |
| Medium | Registration transaction reference leta hai; payment gateway verification ka code confirm nahi. | “Paid” status manual approval par nirbhar; UI wording user ko confuse kar sakti hai. | Manual verification process document karein ya provider integration/webhook add karein. |
| Medium | JSON Restore input hai, par handler implementation inspected page script mein nahi. | Operator backup import karne ka option dekh sakta hai jo fail ho. | Restore handler, schema validation, confirmation aur rollback tests add karein; warna control hata dein. |
| Medium | CSV scores export `db.scores` padhta hai, jabki active scorer alag keys use karta hai. | Downloaded CSV mein live ball-by-ball record absent ho sakta hai. | Scorer state ka canonical export schema bana kar sample export verify karein. |
| Medium | Public live state browser localStorage se aata hai. | Separate viewer device ko scorer ka update apne aap nahi milega. | Cloud push/subscription ya polling API jodein; network interruption UX test karein. |
| Medium | Team deletion player assignment reset karta hai, par purse/team/account edge cases test chahiye. | Auction accounting ya historical data inconsistent ho sakta hai. | Delete ko archive/soft-delete banayein; linked players aur financial ledger transactionally reconcile karein. |
| Medium | Transfer request method mein requester ke source-team ownership ka sakht check confirm nahi. | Galat owner transfer request create kar sakta hai agar UI/other checks na rokein. | Requester identity ko player ke current team owner se server-side compare karein. |
| Low | Scorer ball save mein broad catch block error ko suppress kar sakta hai. | Storage quota/error hone par operator ko save failure samajh nahi aata. | Visible error state aur retry/export recovery provide karein. |
| Low | Scorer public mapping kuch fields jaise maidens ko fixed value de sakti hai. | Public scorecard statistics incomplete ho sakti hain. | Statistics ko delivery data se calculate karein aur innings test fixtures se verify karein. |

Yeh table observed code differences aur unke likely operational effects ko batata hai. Iska matlab yeh nahi ki har deployment mein har bug reproduce hua hai. Security recommendations khas taur par isliye mahatvapurn hain kyunki browser-side JavaScript user ke device par chalti hai. Role check UI ko accidental access se rok sakta hai, lekin adversarial client ke liye trusted enforcement nahi.

## 14. User journeys

### A. Player registration se auction tak
1. Player registration page kholta hai, personal/college/cricket information aur contact details deta hai.
2. ₹50 fee ke liye page par dikhaye gaye payment process ke anusaar transaction reference enter karta hai; source code reference collect karta hai, external payment validate karna confirm nahi.
3. Registration submit hone par `PENDING` player record aur `PLAYER` account browser database mein banta hai; registration/pass ID success panel par dikhta hai.
4. Admin pending queue mein player aur reference dekhta hai. Manual verification ke baad approve ya reject karta hai.
5. Approved player, jab tak team se linked nahi aur auctionable hai, auction engine ke next-player search mein eligible ho sakta hai.
6. Auction sale ke baad player `SOLD` aur team-linked hota hai; uski value team directory/squad mein aa sakti hai.

### B. Team owner ka bid aur squad update
1. Admin franchise aur owner account banata hai; team purse aur owner ka `teamId` link initialize hota hai.
2. Owner email/password se login karta hai; role-based redirect auction room par le jaata hai.
3. Auction tab current player, next bid, timer, highest team aur apna purse dikhata hai.
4. Owner ka bid engine ke validation rules se guzarta hai. Valid bid history aur auction state mein record hoti hai.
5. Admin lot ko SOLD confirm karta hai. Team purse ghatta, total spent/squad count badhta aur player team se link hota hai.
6. Owner apna squad dekh sakta hai; captain portal mein eligible squad players se Playing XI draft select karke save kar sakta hai.

### C. Scorekeeper permission se public live score tak
1. Admin UI se scorekeeper email/password aur match select karta hai. Current handler hard-coded match ID use karta hai, selected dropdown value nahi.
2. Engine `liveMatch` assignment/lock fields aur `SCOREKEEPER` user update karta hai. Yeh action active scorer ke independent local state ko automatically initialize karta hai, aisa evidence nahi.
3. SCOREKEEPER role ka user scorekeeper page khol sakta hai; page role guard `ADMIN`/`SCOREKEEPER` check karta hai.
4. Scorer apna match setup karke ball entry karta hai. Observed active path `citpl_scorer_v2` mein save aur `CITPL_SCORE` publish karta hai.
5. Live page/dashboard same browser origin mein `CITPL_SCORE` padhkar update ho sakte hain.
6. `liveMatch` assignment, lock aur `canUserUpdateScore()` ka active page ke ball function se connection verify nahi; isliye yeh journey centralized enforced permission ki guarantee nahi deti.

### D. Projector display par auction monitor
1. Admin auction control se projector page open karta hai.
2. Projector current lot, player, status, price, timer, recent bids aur teams render karta hai.
3. Owner bid state badalne par same-origin subscription/render loop display update kar sakta hai.
4. Alag device ya browser par state share ke liye cloud sync code inspected implementation mein nahi mila; projector deployment ko same shared data context ke saath test karna hoga.

### E. Owner ka Playing XI draft
1. `TEAM_OWNER` account captain portal kholta hai; page teamId se uski franchise dhoondhta hai.
2. Full squad se checkboxes ke zariye players chunta hai; 11 se zyada selection UI par rok di jaati hai.
3. Save par selected IDs `team.playingXI` aur timestamp `playingXIUpdatedAt` mein store hote hain.
4. Fewer than 11 entries ko save karna code mein mumkin hai; isliye yeh draft feature hai, finalized XI validation nahi.

## 15. Conclusion

CITPL repository ek broad cricket-league workflow ka browser-side prototype prastut karti hai: player registration aur review, admin-created franchises, owner-linked auction bidding, purse/squad management, scorekeeper interface, public score display, projector aur CSV/JSON export ke building blocks ek jagah milte hain. Auction engine mein role, purse, roster aur bid-state checks jaise concrete business rules hain; scorer UI mein ball-by-ball cricket events aur match result flow bhi hai. In features ko user journeys ke roop mein samajhna project ko onboard karne aur testing plan banane ke liye upyogi hai.

Live operation se pehle sabse aham kaam ek canonical match/scoring data pathway chunna, scorekeeper assignment aur lock ko har score write par lagu karna, aur browser-only storage ko shared authoritative backend se replace ya explicitly single-device limitation ke roop mein document karna hai. Admin scorekeeper assignment mein selected match ID use karna, payment verification wording ko sahi rakhna, restore functionality aur CSV score export ko test karna, aur passwords/roles ko client storage se bahar le jaana bhi prathmikta honi chahiye.

Ant mein, UI par feature ka hona aur end-to-end feature ka secure, persistent aur cross-device working hona alag maturity levels hain. Is report mein implemented flow ko proposed architecture aur recommendations se alag rakha gaya hai, taaki CITPL ki current capability aur aage ke kaam dono saaf nazar aayen.

## 16. Codebase module map aur zimmedariyan

Is section ka uddeshya developer ya project coordinator ko yeh batana hai ki kisi workflow ko padhne ya badalne ke liye repository mein pehle kahan dekhna chahiye. Page aur shared JavaScript ka rishta samajhne se feature tracing aasaan hoti hai.

| Code area | Zimmedari | Investigation ke liye note |
|---|---|---|
| `index.html` | Home-page structure, league overview aur public navigation | Kuch visible copy static hai; dynamic cards ke liye dashboard script dekhein. |
| `css/style.css` | Common colors, layout, buttons aur responsive styling | Page-specific inline style bhi ho sakta hai; shared CSS edit ka asar kai pages par pad sakta hai. |
| `js/firebase-config.js` | `window.citplDB`, initial browser data, local login, auction/team/player operations, permission methods | Naam Firebase hai, par persistence localStorage hai. Admin role fail-closed hai; non-admin local credentials secure authentication nahi hain. |
| `js/app.js` | Login/logout UI, redirect, registration ke shared handlers, player dashboard | Kuch forms apna handler override karte hain; registration page ka inline code bhi check karein. |
| `js/app-shell.js` | Mobile navigation aur role-based navigation links | Link display routing ko prabhavit karta hai; core data security nahi. |
| `js/dashboard.js` | Home dashboard counts, live summary aur auction state | `CITPL_SCORE` aur engine state dono se data le sakta hai. |
| `js/csv-manager.js` | CSV parse/serialize aur downloads | CSV download/export helper; localStorage se CSV file sync karne wala backend nahi. |
| `pages/admin.html` | Registration approvals, team create/delete, scorekeeper assignment, score lock, data backup/export aur auction monitoring | Admin forms ke event handlers isi page ke inline script mein ho sakte hain. |
| `pages/auction.html` | Owner bid UI, admin controls, team/player/transfer/settings tabs | Role ke mutabik same page ka interface badalta hai. |
| `pages/auction-live.html` | Auction display/projector | Shared browser state par subscribe aur periodic render use karta hai. |
| `pages/captain.html` | Owner purse/squad/Playing XI draft | Team context current user ke `teamId` se aata hai. |
| `pages/scorekeeper.html` | Match setup, innings/scoring UI, history aur scorecard | Is page mein substantial inline JavaScript aur scorer-specific storage state hai. |
| `pages/live.html` | Public scoreboard | `CITPL_SCORE` ko parse karke totals/scorecard render karta hai. |
| `pages/register.html` | Player registration form, photo/payment reference UI | Inline photo/form handling shared registration function ko override kar sakti hai. |
| `pages/teams.html`, `players.html`, `matches.html`, `points-table.html` | Public directory, fixtures aur standings views | In pages ki display completeness runtime data par nirbhar hai. |
| `js/scoring-engine.js` | Ek additional scoring implementation/state | `CITPL_SCORE` likhne ka code rakhta hai; ise scorekeeper page ka active engine samajhne se pehle call sites verify karein. |
| `data/*.csv` | CSV schema/seed/export-format files | Header-only files database persistence ka pramaan nahi hain. |
| `scoring_architecture_plan.md` | Scoring architecture ka design note | Proposed target architecture ko implemented runtime ke saath mix na karein. |

Feature change karte waqt ek hi page ko dekhna kaafi nahi hota. Udaharan ke liye, scorekeeper permission badalne par admin assignment form, `assignScorekeeperToMatch()`, scorekeeper page ka guard, ball submit handler aur public scoreboard update sab ko ek trace mein verify karna hoga. Auction rules ke liye owner bid button ke UI condition ke saath `placeBid()`, admin state-transition method aur projector rendering ko bhi match karein. Is se UI state aur stored state mein divergence ka risk kam hota hai.

## 17. Data/status lifecycle aur state transitions

### Player lifecycle

Player record ki aam progression source fields aur auction selection ke hisaab se samjhi ja sakti hai:

```text
Registration submitted
        |
        v
PENDING (paymentVerified = false, teamId = null)
   | Admin approves             | Admin rejects
   v                             v
APPROVED                      REJECTED
   |
   | Auction next-player query: approved + unassigned
   v
Auction lot --> SOLD (teamId assigned, price recorded)
          \--> UNSOLD (not bought in this lot)
```

Yeh simplified conceptual lifecycle hai, complete immutable audit state machine nahi. Source mein admin approval status aur payment flag update karta hai; auction sale player ka status aur team link update karti hai. `UNSOLD` status ko future auction mein dobara eligible banane ka rule source se confirm nahi, kyunki query `APPROVED` status leti hai. Isliye unsold player ko dobara lot mein lana ho to admin process aur code behavior ko pehle verify karein; sirf “UNSOLD” label se automatic re-listing assume na karein.

### Auction lifecycle

Auction state mein `NOT_STARTED`, `LIVE`, `PAUSED`, `GOING_ONCE`, `GOING_TWICE`, `SOLD`, `UNSOLD` aur `AUCTION_COMPLETE` jaise statuses hain. `setAuctionStatus()` in statuses ke beech allowed transition map check karta hai; yeh arbitrary text status change nahi. `advanceAuctionToNextPlayer()` active player ke lot ko close karne ki requirement rakhta hai. Lot open par bid deadline set hoti hai; pause remaining time save karke deadline hata deta hai, aur resume nayi deadline banata hai. Bid accepted hone par timer reset/extend hota hai. Sale/unsold par timer band hota hai. Projector timer ko data engine ke remaining-seconds helper se nikalta hai.

Operational nuance: UI confirmation dialog aur data method ka rule alag ho sakte hain. Jaise “Next lot anyway?” confirm karne se user ki consent milti hai, par engine method open lot ko phir bhi reject kar sakta hai. Test cases mein sirf button par click nahi, actual stored state aur returned result verify karein.

### Match/scoring lifecycle

Scorekeeper page ka local match object team labels, overs limit, innings index, toss string, innings arrays, result aur creation display data rakhta hai. Innings object mein runs, wickets, legal balls, batters, bowlers, extras, striker/non-striker, current bowler, over timeline aur fall-of-wicket fields jaise elements hain. Match history list scorer key mein persist hoti hai. Is lifecycle ko `liveMatch` object ke saath na milayein: source mein woh doosra record hai, jiske status/assignment fields alag hain.

Result calculation scorekeeper flow mein second innings ke total ko first innings ke total/target ke saath compare karta hai. Match ke result ko `CITPL_SCORE` projection mein `isComplete`/result text jaise fields ke saath public page ke liye serialize kiya ja sakta hai. Is projection ko scorer ki full editable history ya ball ledger na samjhein: yeh display shape hai aur ismein source stats ka subset hi hai.

## 18. Tournament operations checklist

Yeh checklist maujooda screens ko chalane ke liye operational guidance hai. Jahan step current app se poora nahi hota, wahan manual verification ya external process ka zikr diya gaya hai.

### Registration window kholne se pehle

1. Confirm karein ki operator jis browser profile mein kaam karega, usmein intended database state hai. Local browser storage alag profile/device par automatically share nahi hota.
2. Registration form ko test account se submit karke dekhein: required fields, photo upload, ID display, auto-login, pending record aur transaction reference.
3. Admin pending queue mein test application verify karein. Payment ka external/manual verification kaun karega aur kis proof ke basis par, yeh organizers ko alag se define karna chahiye.
4. Admin JSON backup download karke file ka existence aur contents check karein; is file mein personal data aur credentials ho sakte hain, isliye access limited rakhein.
5. Registration message ko actual payment workflow se align karein. Reference collect hone ko successful payment ke roop mein communicate na karein.

### Auction day se pehle

1. Admin se franchise teams create karayein; owner email unique ho, owner ko credentials safely milen, aur team/purse records confirm hon.
2. Test owner login karke verify karein ki sirf linked team ka purse/squad/bid controls dikh rahe hain.
3. Pending registrations ko review karke eligible players approve karein. Player directory aur auction player queue ko compare karein.
4. Timer, increment, maximum squad size aur starting purse settings decide karke test lot par validate karein. Settings change karne se pehle existing team balances par kya asar hoga, uska assumption na banayein.
5. Projector page ko intended display machine/browser mein khol kar check karein. Bid submit karke monitor karein ki projector wahi state dekh raha hai.
6. SOLD, UNSOLD, pause/resume, Going Once/Going Twice aur Next Lot ko test records ke saath rehearse karein. Real players par test bid chalane se pehle test data reset/restore procedure tayyar ho.
7. Auction ke baad CSV/JSON files ka controlled backup lein aur confirm karein ki player, team purse, sold price aur bid history expected hai.

### Match day se pehle

1. Fixture, teams, venue, overs aur playing squads ko organizer se confirm karein. Current scorer setup free-text team input rakhta hai; naam spelling public page se consistent rakhein.
2. Match dropdown aur assignment form ka selected match actual assignment par asar karta hai ya nahi, test karein; current handler hard-coded ID use karta hai.
3. Scorekeeper role assignment aur password distribution ko test karein. Match lock/unlock ko active scorer screen par check karein, sirf admin status label par nahi.
4. Scoring se pehle same browser/origin mein live scoreboard kholkar test ball enter karein. Run, wide, no-ball, bye, wicket, over end, innings end aur undo ka expected display check karein.
5. Page refresh/browser crash ke baad scorer history recover hoti hai ya nahi verify karein. `citpl_scorer_v2` ki local persistence cross-device restore nahi hai.
6. Match ke baad result, scorecard, fall of wickets aur CSV exports manually reconcile karein. Public score total aur scorer console total mein farq ho to public output ko authoritative na maanein jab tak discrepancy resolve na ho.

### Tournament ke baad

1. Match results, points table aur player stats ko official scorebook se compare karein. Auto-update behavior assume na karein.
2. JSON backup aur relevant CSV exports ko approved secure location mein store karein. Player contact, photo aur credentials wali files ko public share na karein.
3. Transfer, correction ya team deletion se pehle current snapshot lein. Client-side edit/delete se audit trail kaafi na ho sakta hai.
4. Tournament archive banane se pehle state keys aur scorekeeper histories ki completeness verify karein; available exports alag data pathways cover karte hain.

## 19. Acceptance tests aur edge-case checklist

Yeh implementation behavior verify karne ke liye suggested acceptance scenarios hain. Yeh claim nahi ki repository mein ye tests automated form mein already maujood hain.

### Registration/admin tests

- Required email/name/reference missing ho to submission roki jaati hai; duplicate email aur duplicate registration ID cases ka behavior define/test ho.
- Nayi application `PENDING`, `paymentVerified: false`, `teamId: null` ke saath banti hai.
- Admin approve karne par wahi record `APPROVED` ho aur approved player auction selector mein aaye.
- Rejected player eligible list mein na aaye. Re-approval ka policy/allowed state transition check ho.
- UTR manually verify kiye bina UI payment ko verified na dikhaye; approval message ki wording state se match kare.
- Photo ke declared file type/size limit ko actual handler mein validate kiya jaata hai ya nahi check ho; sirf UI hint par bharosa na ho.

### Team aur owner tests

- Team create karna non-admin user se fail ho; admin action par team aur linked owner ka same `teamId` ho.
- Invalid/duplicate owner email, empty team name, negative/non-numeric purse aur duplicate short code ka behavior test ho.
- Owner account Team A ke liye login kare to Team B ke purse/squad ko dekh ya bid na kar sake.
- Squad cap par exactly last allowed player buy karna pass ho aur uske baad next bid fail ho.
- Team delete karne par linked owner login, assigned players, auction history aur purse totals ka documented result verify ho.
- Playing XI zero, partial, exactly 11 aur 12 players ke liye UI aur saved data compare ho; currently UI 12th ko rokta hai, par partial draft allow karta hai.

### Auction tests

- First bid base price ke barabar ho; agla bid configured increment se kam/zyada ho to reject ho.
- Highest bidder apni hi team se dobara bid na kar sake.
- Timer expired, auction paused, lot unsold/sold/complete aur player pehle se sold ho to bid reject ho.
- Remaining purse bid amount se kam ho to bid fail aur purse unchanged rahe.
- Valid SOLD par ek hi baar purse deduct ho, squad count ek hi baar bade aur player duplicate sale na ho.
- UNSOLD ke baad agla lot aur unsold player ki re-list policy expected ho.
- Do owners ek hi waqt bid karein to ordering/result test ho. Browser-local JSON ke saath atomic transaction/locking available hai, aisa presume na karein.
- Multiple tabs mein fast bid, pause/resume aur deadline boundary par state last-write-wins ho sakti hai; simultaneous operation behavior specifically test karein.

### Scorekeeper/public tests

- Signed-out, PLAYER aur TEAM_OWNER account se scorekeeper page access expected tareeke se roka jaye; ADMIN/SCOREKEEPER entry par active assignment aur lock rules bhi validate hon.
- Assigned scorekeeper email aur kisi doosre SCOREKEEPER email se ek hi match par attempt karein; dono ka outcome confirm karein.
- Admin lock ke waqt score entry blocked ho aur unlock ke baad sirf authorized match scorer proceed kare—current active UI mein yeh test gap hai.
- Runs 0–6, odd/even run strike change, wide/no-ball/byes/leg-byes, wicket + extras, run out vs bowler wicket credit aur over boundary ko official cricket rules ke against validate karein.
- Undo ke baad total, batter/bowler stats, timeline, FOW aur public `CITPL_SCORE` sab pehle state mein lautein.
- Do innings, target chase, all-out, overs complete, tie aur win result ko boundary values par test karein.
- Public page refresh/reopen, empty score, malformed localStorage JSON aur storage quota/error ko test karein.
- Same-origin second tab refresh aur doosre device/browser par behavior alag test karke user-facing limitation document karein.

### Backup/export tests

- CSV escaping commas, quotes, newline aur Unicode naam par parse/download round-trip kare.
- Empty collection export headers-only ho; yeh blank data ko accidentally overwrite na kare.
- `scores.csv` mein active scorer ki ball records aati hain ya nahi sample match se assert ho.
- JSON restore input actual database state ko validated backup se restore kare, ya UI ko unavailable dikhaya jaye. Restore par corrupt JSON, schema mismatch aur accidental overwrite confirm/rollback scenarios test hon.
- CSV/JSON files mein passwords, transaction IDs, mobile numbers aur photos hain ya nahi review karke secure retention policy set ho.

## 20. Score display metrics aur cricket terminology

Live scoreboard source se kuch metrics display ke waqt calculate karta hai:

- **Overs:** Legal deliveries ke total balls ko 6 se divide karke overs aur remaining ball ke roop mein dikhaya jaata hai. Cricket notation mein `5.2` ka matlab 5 overs aur 2 legal balls hai, decimal 5.2 overs nahi.
- **CRR (Current Run Rate):** `runs × 6 ÷ legal balls`. Legal ball zero ho to display zero rate deta hai.
- **RRR (Required Run Rate):** Second innings mein target se bache runs ko remaining legal balls par divide karke per-over rate nikala jaata hai. Public page first innings total + 1 ko chase target ke roop mein use karta hai.
- **Strike Rate:** Batter runs ÷ batter balls × 100. Zero balls hone par zero/placeholder rate dikh sakta hai.
- **Economy Rate:** Bowler ke conceded runs ÷ overs bowled; public display balls se overs banata hai. Maidens ka mapped value scorer projection mein zero set ho sakta hai.
- **Fall of wickets (FOW):** Wicket ke waqt score, wicket number, batter aur over jaise details timeline/table mein dikhte hain; exact formatting page-specific hai.
- **Extras:** Wide, no-ball, bye aur leg-bye ko team total aur batter/bowler figures mein cricket ke niyam ke anusaar alag count karna chahiye. UI labels maujood hona har edge-case arithmetic ke correct hone ka proof nahi; test checklist ke ball scenarios se verify karein.

Ye metrics scoreboard ke formulas ko samajhne ke liye hain; official match result publish karne se pehle scoring arithmetic ko independent scorebook se reconcile karna chahiye. Ek non-legal delivery par batter ball count, no-ball par bowler runs aur wicket-credit rules jaise edge cases implementation differences la sakte hain.

| Term | Saral arth |
|---|---|
| Purse | Auction mein team ke paas bachi hui kharid budget amount. |
| Base price | Kisi auction lot par opening/initial price. |
| Bid increment | Current price ke upar agle valid bid ka minimum step. |
| Lot | Auction ke dauran ek player ka bidding round. |
| Highest bidder | Is waqt current lot ke liye sabse badi accepted bid wali team. |
| Owner / captain | Is app mein team se linked management/bidding role; dono labels UI mein mil sakte hain. |
| Scorekeeper | Match scoring UI chalane wala role; assignment ka actual enforcement separately verify hota hai. |
| Innings | Team ke batting turn ka unit. |
| Legal ball | Delivery jo over-ball count mein count hoti hai; wide/no-ball ka handling alag hota hai. |
| NRR | Net Run Rate, tournament standings metric; formula ko competition rules aur completed innings data ke saath verify karna hota hai. |
| localStorage | Browser origin ke liye persistent key/value storage; user/browser profile ke beech automatically shared nahi. |
| sessionStorage | Browser tab/session ke dauran state rakhne wala storage; backend login session ke samaan nahi. |
| CSV | Rows/columns ko text file mein serialize karne ka format; export apne aap database synchronization nahi. |
| Projector view | Auction stage ke liye large-screen display; display page hi authoritative auction write service nahi. |

## 21. Deployment se pehle tay karne wale product decisions

Code se pare kuch league rules organizers ko explicit karne honge, taaki ek hi behavior sabhi pages aur officials ke liye consistent rahe:

1. **Payment policy:** ₹50 collection UPI/manual hai ya payment provider integrated hoga? Kaun receipt/UTR verify karega, aur rejection/duplicate payment ka process kya hoga?
2. **Registration eligibility:** Kaunse branches/semesters/roles allowed hain? Duplicate email/mobile, late registration, photo consent aur player withdrawal ka policy kya hai?
3. **Auction eligibility:** Approved player ka exact meaning, category-wise base price, bid increment, unsold re-entry, tie/withdrawal aur sale correction process kya hai?
4. **Franchise rules:** Starting purse, min/max squad, owner replacement, co-owner/captain, player transfer/fee aur team archive policy kya hai?
5. **Match operations:** Overs, playing XI deadline, toss record, innings break, rain-shortened match, tie/super-over, abandoned match aur score correction authority kis role ke paas hogi?
6. **Official data authority:** Paper scorebook, current browser storage ya future server backend mein se final source-of-truth kaunsa hoga? Conflict resolve kaun karega?
7. **Audience/privacy:** Players ke phone/email, photos, transaction reference aur login details kaun dekh sakta hai? Public pages par kaunsa personal data bilkul nahi dikhna chahiye?
8. **Audit/retention:** Registration documents aur match/auction logs kitne samay tak rakhne hain, backup kahan store hoga, aur data correction ka record kaise preserve hoga?

In decisions ko README mein current feature nahi, operational policy questions ke roop mein rakha gaya hai. Inka jawab milne ke baad UI labels, validations, roles aur backend requirements ko ek consistent specification mein badla ja sakta hai.

## GitHub repository aur Pages preview status

GitHub repository mein CITPL ka complete source (home page, app pages, CSS/JavaScript, documentation, empty CSV schema files aur project media) rakha ja sakta hai. `.github/workflows/deploy-pages.yml` ka GitHub Pages workflow jaan-boojhkar **sirf `preview/` folder** publish karta hai. Isse repository mein app source maujood rehta hai, par hosted site mein abhi koi login form, data entry, local database ya user data nahi hota. Yeh security boundary Firebase-backed production app ka substitute nahi.

### GitHub par Pages enable karna

1. Repository ke **Settings → Pages → Build and deployment** mein source **GitHub Actions** select karein.
2. `main` branch par change push karne ke baad **Actions** tab mein “Deploy CITPL to GitHub Pages” run dekhein; zaroorat par **Run workflow** use karein.
3. Successful deploy ke baad Actions environment mein diya gaya `github-pages` URL kholein. Is preview ko public samjhein, bhale source repository private ho.
4. Preview deployment mein sirf static CITPL overview aana chahiye; admin, registration, auction aur scorekeeper actions intentionally include nahi hote. CSV/data files aur app source deployment artifact mein shamil nahi.

### Production app deployment abhi kyun blocked hai

Workflow preflight preview ko static/read-only aur credential literals se free verify karta hai. Production app ko Pages artifact mein daalna alag aur abhi unsafe hai: current `js/firebase-config.js` Firebase SDK se connect nahi karta, browser `localStorage` use karta hai, aur role/auction/scoring decisions client code mein hote hain.

`server.mjs` admin login/session API deta hai aur main app ko same origin se serve kar sakta hai. Yeh tournament ka central database nahi hai: GitHub Pages static hosting hai aur current matches/players/features browser `localStorage` mein rehte hain. Multi-device writes aur full server-side admin authorization ke liye privileged league operations ko database-backed API mein migrate karna ab bhi baaki hai.

Firebase Web App config browser client mein use hone wali config hoti hai, server credential nahi; uski security Database Rules aur server-side Functions se aati hai. **Service-account JSON, private key, passwords ya payment credentials repository mein commit na karein.** Cloud Functions deploy credentials ko GitHub Actions Secrets/secure Firebase deployment workflow mein rakhna hoga. Service account ko least privilege dein, Firebase Authorized domains mein deployed Pages domain add karein, aur database par default public read/write rules kabhi na lagayein.

Read-only preview workflow app source se alag folder publish karta hai. Firebase project, Authentication, strict Realtime Database Rules aur privileged operations ke liye Cloud Functions implement/test hone ke baad hi production app deploy strategy badlein. Service-account JSON/private key kabhi repository mein add na karein.

---

**Approximate word count:** 8,002 whitespace-separated words, headings aur tables samet.
