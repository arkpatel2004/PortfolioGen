// src/services/userService.ts

import { db } from '../firebase'; // Ensure your firebaseConfig is exported as db
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  increment,
  serverTimestamp,
  onSnapshot,    // <-- ADD THIS IMPORT
  Unsubscribe,   // <-- ADD THIS IMPORT
} from 'firebase/firestore';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  portfoliosGenerated: number;
  resumesGenerated: number;
  tokens: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GenerationItem {
  id: string;
  userId: string;
  name: string;
  type: 'portfolio' | 'resume';
  status: 'completed' | 'processing' | 'failed';
  createdAt: Date;
  githubUrl?: string;
  linkedinData?: string;
  previewUrl?: string;
  downloadUrl?: string;
  tokens: number;
  templateId: number;
}

// This interface is no longer used by History.tsx but kept for other potential uses
export interface UserStats {
  totalGenerations: number;
  portfolios: number;
  resumes: number;
  successRate: number;
}

class UserService {
  // --- EXISTING METHODS (NO CHANGES) ---

  // Initialize new user profile
  async initializeUserProfile(userId: string, name: string, email: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        await setDoc(userRef, {
          name,
          email,
          portfoliosGenerated: 0,
          resumesGenerated: 0,
          tokens: 20,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        console.log('User profile initialized successfully');
      } else {
        const userData = userDoc.data();
        if (userData.tokens === 0 || userData.tokens === undefined) {
          await updateDoc(userRef, {
            tokens: 20,
            updatedAt: serverTimestamp()
          });
          console.log('Updated existing user with 20 tokens');
        }
      }
    } catch (error) {
      console.error('Error initializing user profile:', error);
      throw error;
    }
  }

  // Get user profile
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const data = userDoc.data();
        return {
          id: userDoc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw error;
    }
  }

  // Add generation item
  async addGenerationItem(item: Omit<GenerationItem, 'id' | 'createdAt'>): Promise<string> {
    try {
      // NOTE: Your code correctly points to a top-level 'generations' collection
      const generationsRef = collection(db, 'generations'); 
      const docRef = await addDoc(generationsRef, {
        ...item,
        createdAt: serverTimestamp()
      });
      
      await this.updateUserStats(item.userId, item.type, item.tokens);
      return docRef.id;
    } catch (error) {
      console.error('Error adding generation item:', error);
      throw error;
    }
  }

  // Update generation status
  async updateGenerationStatus(
    generationId: string, 
    status: 'completed' | 'processing' | 'failed',
    urls?: { previewUrl?: string; downloadUrl?: string }
  ): Promise<void> {
    try {
      const generationRef = doc(db, 'generations', generationId);
      const updateData: any = { status };
      
      if (urls) {
        if (urls.previewUrl) updateData.previewUrl = urls.previewUrl;
        if (urls.downloadUrl) updateData.downloadUrl = urls.downloadUrl;
      }
      
      await updateDoc(generationRef, updateData);
    } catch (error) {
      console.error('Error updating generation status:', error);
      throw error;
    }
  }

  // Update user stats after generation
  private async updateUserStats(userId: string, type: 'portfolio' | 'resume', tokensUsed: number): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const updateData: any = {
        tokens: increment(-tokensUsed),
        updatedAt: serverTimestamp()
      };
      
      if (type === 'portfolio') {
        updateData.portfoliosGenerated = increment(1);
      } else {
        updateData.resumesGenerated = increment(1);
      }
      
      await updateDoc(userRef, updateData);
    } catch (error) {
      console.error('Error updating user stats:', error);
      throw error;
    }
  }

  // Get user generation history (one-time fetch)
  async getUserGenerations(userId: string): Promise<GenerationItem[]> {
    try {
      const generationsRef = collection(db, 'generations');
      const q = query(
        generationsRef,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const generations: GenerationItem[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        generations.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date()
        } as GenerationItem);
      });
      
      return generations;
    } catch (error) {
      console.error('Error getting user generations:', error);
      throw error;
    }
  }

  // --- NEW REAL-TIME LISTENER METHODS ---

  /**
   * Listens for real-time updates to a user's generation history.
   * @param userId The ID of the user.
   * @param callback Function to call with the updated list of generations.
   * @param onError Function to call on error.
   * @returns An unsubscribe function to detach the listener.
   */
  onUserGenerationsSnapshot(
    userId: string,
    callback: (generations: GenerationItem[]) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    const generationsRef = collection(db, 'generations');
    const q = query(generationsRef, where('userId', '==', userId), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (querySnapshot) => {
        const generations = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
          } as GenerationItem;
        });
        callback(generations);
      },
      (error) => {
        console.error("Error with generations snapshot: ", error);
        onError(error);
      }
    );

    return unsubscribe;
  }

  /**
   * Listens for real-time updates to a user's profile document (for stats).
   * @param userId The ID of the user.
   * @param callback Function to call with the updated user profile.
   * @param onError Function to call on error.
   * @returns An unsubscribe function to detach the listener.
   */
  onUserProfileSnapshot(
    userId: string,
    callback: (profile: UserProfile | null) => void,
    onError: (error: Error) => void
  ): Unsubscribe {
    const userDocRef = doc(db, 'users', userId);

    const unsubscribe = onSnapshot(
      userDocRef,
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data();
          const profile: UserProfile = {
            id: docSnapshot.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as UserProfile;
          callback(profile);
        } else {
          callback(null);
        }
      },
      (error) => {
        console.error("Error with user profile snapshot: ", error);
        onError(error);
      }
    );

    return unsubscribe;
  }

  // --- Keep other methods if you have them ---

  async addTokens(userId: string, amount: number): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        tokens: increment(amount),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error adding tokens:', error);
      throw error;
    }
  }
}

export const userService = new UserService();