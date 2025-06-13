// Firebase configuration for the web admin dashboard
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyCgbBaKZJzUItNfBQbV3Qc9qxtDSlBNEgE',
  appId: '1:454441277105:web:0a1018348446199ff1b490',
  messagingSenderId: '454441277105',
  projectId: 'pcoin-bad70',
  authDomain: 'pcoin-bad70.firebaseapp.com',
  storageBucket: 'pcoin-bad70.firebasestorage.app',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };