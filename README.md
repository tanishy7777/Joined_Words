# 🧩 Joined Words – Multiplayer Real-time Game
Adds scalable, real-time multiplayer functionality, room management, and live leaderboards to the original Joined Words Game ([here](https://jw-daily.web.app/)).

## Game Demo
(This video is sped up to save time. Unmute for the best experience!)

https://github.com/user-attachments/assets/5e8c476d-22b2-482e-9281-477b76bea504



## 📦 Overview
✨ **Features:**
- 🏠 **Dynamic multi-room creation** – supports multiple active game rooms running in parallel
- 🏆 **Live leaderboards & scoring** – real-time updates
- 🛡️ **Admin Reassignment** – automatic **Admin reassignment** when the current admin leaves
- 🔗 **Copy room link** feature for quick invites and smoother onboarding
- 📢 **UI enhancements** – toast notifications for events like player leaving, admin reassignment, and config changes
- 🔄 **Gamestate persistence** – restores player sessions after reloads
- 🚫 **Prevent duplicate backend requests** – disables repeated button clicks to avoid redundant calls

## 🛠 Tech Stack:
  - 🖼️ **React** – frontend
  - 🛠️ **Node.js** – backend
  - 📡 **WebSockets** – real-time communication
  - 🧠 **Redis** – fast state caching
  - 🔐 **Firebase** for authentication (anonymous sign-in & nicknames)



## 📈 Project Timeline & Versions

v1.0.0

Features:
- Adds Admin Reassignment
- UI improvement: Added toasts for various events like when, player leaves, admin reassignment, gameconfig changed, etc

Minor Changes:
- Prevent user from pressing a button more than once after he has pressed it. (This ensures backend dosent receive same requests more than once)

Bug Fixes:
- On reloading, state is restored properlly.

v0.3.0

https://github.com/user-attachments/assets/4f20cb08-a711-414c-b35b-ac622ba2b018

Features:

- Nicknames, Anonymous Signin(firebase)

Bug Fixes:
- Reloading maintains the state

v0.2.0
- UI change
- Admin Settings, Copy link feature, leaderboard and scoring
  
https://github.com/user-attachments/assets/0ef7d876-d14f-4c0e-90e1-4051d4927c13

v0.1.0
- very basic scaffolding and backend
   
https://github.com/user-attachments/assets/f1b6d9cc-0049-411c-a021-c8858b601b14

