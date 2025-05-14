// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Opcjonalnie, jeśli będziesz chciał korzystać z innych usług Firebase, np. Firestore, Authentication
// import { getFirestore } from "firebase/firestore";
// import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBbGVgci0Pwj0ngaPTpTL4OqiLBpn6vBJQ",
    authDomain: "improve-site-26afb.firebaseapp.com",
    projectId: "improve-site-26afb",
    storageBucket: "improve-site-26afb.firebasestorage.app",
    messagingSenderId: "664512167664",
    appId: "1:664512167664:web:f95d0c80cd79eb4f82cc35"
};

// Inicjalizacja Firebase
const app = initializeApp(firebaseConfig);

// Eksportowanie instancji usług Firebase, których będziesz używać
// export const db = getFirestore(app);
// export const auth = getAuth(app);
export const db = getFirestore(app);