import { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInAnonymously, 
  signInWithPopup, 
  GoogleAuthProvider, 
  updateProfile,
  onAuthStateChanged 
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNicknamePrompt, setShowNicknamePrompt] = useState(false);

  // Anonymous sign in with nickname[20][29]
  const signInAnonymouslyWithNickname = async (nickname) => {
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      // Update Firebase Auth profile[48]
      await updateProfile(user, {
        displayName: nickname
      });
      
      // Store user data in Firestore
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        nickname: nickname,
        displayName: nickname,
        createdAt: new Date(),
        isAnonymous: true,
        friends: [],
        friendRequests: {
          sent: [],
          received: []
        },
        gamesPlayed: 0,
        totalScore: 0
      });
      
      return user;
    } catch (error) {
      console.error('Anonymous sign-in failed:', error);
      throw error;
    }
  };

  // Google sign in[27][33]
  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      // Check if user document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create user document for new Google users
        await setDoc(userDocRef, {
          uid: user.uid,
          nickname: user.displayName,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          createdAt: new Date(),
          isAnonymous: false,
          friends: [],
          friendRequests: {
            sent: [],
            received: []
          },
          gamesPlayed: 0,
          totalScore: 0
        });
      }
      
      return user;
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // Check if user has a nickname/displayName
        if (!currentUser.displayName && currentUser.isAnonymous) {
          setShowNicknamePrompt(true);
        } else {
          setShowNicknamePrompt(false);
        }
        setUser(currentUser);
      } else {
        setShowNicknamePrompt(true);
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    loading,
    showNicknamePrompt,
    setShowNicknamePrompt,
    signInAnonymouslyWithNickname,
    signInWithGoogle
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
