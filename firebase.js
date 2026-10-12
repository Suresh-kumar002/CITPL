
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBq-VsN6OvM2z9cn1AGZJYKRSTchzu7Y2zY",
  authDomain: "citpl-a06f5.firebaseapp.com",
  projectId: "citpl-a06f5",
  storageBucket: "citpl-a06f5.firebasestorage.app",
  messagingSenderId: "526857454057",
  appId: "1:526857454057:web:790513275da055eff4cb78"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

