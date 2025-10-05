import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { auth } from '../firebase';
import { userService } from '../services/userService';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  sendEmailVerification,
  User as FirebaseUser,
} from "firebase/auth";

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  emailVerified: boolean; // Add this field
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<{ needsVerification: boolean }>;
  logout: () => Promise<void>;
  resendVerification: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

const extractUser = (user: FirebaseUser): User => ({
  id: user.uid,
  name: user.displayName ?? "",
  email: user.email ?? "",
  avatar: user.photoURL ?? "",
  emailVerified: user.emailVerified, // Add this field
});

const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setUser(extractUser(firebaseUser));
      } else {
        setUser(null);
      }
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string) => {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if email is verified
    if (!userCredential.user.emailVerified) {
      throw new Error('email-not-verified');
    }
  };

  const signup = async (name: string, email: string, password: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    if (userCredential?.user) {
      await updateProfile(userCredential.user, { displayName: name });
      
      // Send verification email
      await sendEmailVerification(userCredential.user);
      
      // DON'T initialize user profile in Firestore yet - wait for verification
      
      return { needsVerification: true };
    }
    
    return { needsVerification: false };
  };

  const resendVerification = async () => {
    if (auth.currentUser && !auth.currentUser.emailVerified) {
      await sendEmailVerification(auth.currentUser);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const value = {
    user,
    login,
    signup,
    logout,
    resendVerification,
    isAuthenticated: !!user && !!user.emailVerified, // Only authenticated if email verified
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;