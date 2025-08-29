import { db } from '../firebase';
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
  serverTimestamp 
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

export interface UserStats {
  totalGenerations: number;
  portfolios: number;
  resumes: number;
  successRate: number;
}

class UserService {
  // Initialize new user profile
  async initializeUserProfile(userId: string, name: string, email: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      const userDoc = await getDoc(userRef);
      
      if (!userDoc.exists()) {
        const newUser: Omit<UserProfile, 'id'> = {
          name,
          email,
          portfoliosGenerated: 0,
          resumesGenerated: 0,
          tokens: 20, // Default 20 tokens for new users
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(userRef, {
          ...newUser,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        
        console.log('User profile initialized successfully');
      } else {
        // If user exists but has 0 tokens, give them 20 tokens
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

  // Update user tokens
  async updateUserTokens(userId: string, tokenChange: number): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        tokens: increment(tokenChange),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Error updating user tokens:', error);
      throw error;
    }
  }

  // Add generation item
  async addGenerationItem(item: Omit<GenerationItem, 'id' | 'createdAt'>): Promise<string> {
    try {
      const generationsRef = collection(db, 'generations');
      const docRef = await addDoc(generationsRef, {
        ...item,
        createdAt: serverTimestamp()
      });
      
      // Update user stats
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

  // Get user generation history
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

  // Get user statistics
  async getUserStats(userId: string): Promise<UserStats> {
    try {
      const generations = await this.getUserGenerations(userId);
      
      const totalGenerations = generations.length;
      const portfolios = generations.filter(g => g.type === 'portfolio').length;
      const resumes = generations.filter(g => g.type === 'resume').length;
      const successful = generations.filter(g => g.status === 'completed').length;
      const successRate = totalGenerations > 0 ? Math.round((successful / totalGenerations) * 100) : 0;
      
      return {
        totalGenerations,
        portfolios,
        resumes,
        successRate
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return {
        totalGenerations: 0,
        portfolios: 0,
        resumes: 0,
        successRate: 0
      };
    }
  }

  // Add tokens (for watching ads, etc.)
  async addTokens(userId: string, amount: number): Promise<void> {
    try {
      await this.updateUserTokens(userId, amount);
    } catch (error) {
      console.error('Error adding tokens:', error);
      throw error;
    }
  }
}

export const userService = new UserService();