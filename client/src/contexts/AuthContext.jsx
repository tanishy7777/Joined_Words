import React, { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, updateProfile, onAuthStateChanged } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { updateSocketAuth } from '../../socket'; // Ensure this is the correct path to your socket file

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

  const signInAnonymouslyWithNickname = async (nickname) => {
    try {
      const userCredential = await signInAnonymously(auth);
      const user = userCredential.user;
      
      await updateProfile(user, {
        displayName: nickname
      });

      const updatedUser = { ...user, displayName: nickname };
      setUser(updatedUser);
      setShowNicknamePrompt(false);

      await updateSocketAuth(updatedUser); 
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        nickname: nickname,
        displayName: nickname,
        createdAt: new Date(),
        isAnonymous: true,
        gamesPlayed: 0,
        totalScore: 0
      });
      
      return user;
    } catch (error) {
      console.error('Anonymous sign-in failed:', error);
      throw error;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        if (!currentUser.displayName && currentUser.isAnonymous) {
          setShowNicknamePrompt(true);
        } else {
          setShowNicknamePrompt(false);
        }
        setUser(currentUser);
        await updateSocketAuth(currentUser);
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
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
