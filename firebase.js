
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB2uPhFR33nYWZ1sp6zngpikPuwRyztK1c",
  authDomain: "citpl-f6154.firebaseapp.com",
  projectId: "citpl-f6154",
  storageBucket: "citpl-f6154.firebasestorage.app",
  messagingSenderId: "105999478032",
  appId: "1:105999478032:web:168a0e08b8ea4141f00995"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

