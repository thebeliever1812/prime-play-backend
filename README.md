# 🎬 Prime Play – Video Sharing Platform (Backend)

![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=for-the-badge&logo=cloudinary&logoColor=white)
![Render](https://img.shields.io/badge/Render-000000?style=for-the-badge&logo=render&logoColor=white)

Prime Play Backend is the core API powering **Prime Play**, a feature‑rich modern video‑sharing platform built on the MERN stack.  
It manages authentication, video uploads, playlists, comments, likes, search, subscriptions, and more.

---

## 🔗 Frontend Repository

You can find the frontend source code here:
👉 **[Prime Play Frontend Repository](https://github.com/thebeliever1812/prime-play)**

---

## 🚀 Features

- 🔐 **JWT Authentication** – Access & refresh token flow  
- 🎥 **Video Upload Support** – Cloudinary + Multer integration  
- 👤 **User Management** – Register, login, update profile  
- 👍 **Like System** – Like and unlike videos  
- 💬 **Comment System** – Add, edit, delete comments  
- 📁 **Playlist Support** – Create, update, delete playlists  
- 📜 **Watch History Tracking** – Auto‑records viewed videos  
- 📌 **Channel Subscriptions** – Subscribe/unsubscribe to channels  
- 🔍 **Search API** – Search across videos & channels  
- 🧪 **Zod Validation** – Input validation  
- 🔁 **Token Rotation** – Secure auth refresh mechanism  

---

## 🛠 Tech Stack

**Backend:**  
- Node.js  
- Express.js  
- MongoDB  
- Mongoose  

**Authentication & Validation:**  
- JWT  
- bcrypt  
- Zod  

**Uploads:**  
- Multer  
- Cloudinary  

---

## 📂 Folder Structure

```
prime-play/
│
├── src/
│ ├── controllers/
│ ├── models/
│ ├── routes/
│ ├── middlewares/
│ ├── utils/
│ ├── config/
│ └── server.js
│
├── uploads/ # Optional - temp storage
├── .env
├── package.json
└── README.md
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/thebeliever1812/prime-play.git
cd prime-play
```

### 2️⃣ Install Dependencies
```bash
npm install
```

### 3️⃣ Create .env File
```bash
PORT=""
MONGODB_URI=""
FRONTEND_URL_LOCAL=""
FRONTEND_URL_PROD=""
ACCESS_TOKEN_SECRET=""
ACCESS_TOKEN_EXPIRY=""
REFRESH_TOKEN_SECRET=""
REFRESH_TOKEN_EXPIRY=""
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""
```

### 4️⃣ Start Development Server
```bash
npm run dev
```

---

## 🌐 Deployment

The backend is deployed on **Render**.
Ensure all environment variables are configured inside Render Dashboard.

---

## 📝 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International (CC BY-NC 4.0) License.

You are free to share, use, and modify the code for non-commercial purposes, with attribution. Commercial use is strictly prohibited.

---

## 👤 Author

**Basir Ahmad**  
📧 Email: **basirahmadmalik@gmail.com**  
🌐 Portfolio: **https://basir-ahmad-portfolio.vercel.app**
