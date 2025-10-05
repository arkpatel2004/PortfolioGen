// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDUgHw_UWelPEnlHqHh-FUkioEu-RyDnz8",
  authDomain: "portfoliogen-5b4e7.firebaseapp.com",
  projectId: "portfoliogen-5b4e7",
  storageBucket: "portfoliogen-5b4e7.firebasestorage.app",
  messagingSenderId: "526104562922",
  appId: "1:526104562922:web:d7470037aa48e47318db93",
  measurementId: "G-3NWPMDB56P"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);