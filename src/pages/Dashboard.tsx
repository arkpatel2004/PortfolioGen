import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';
import Sidebar from '../components/Sidebar';

const Dashboard: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);

  // Redirect to landing if not authenticated
  React.useEffect(() => {
    if (!isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Handle email verification and profile creation
  useEffect(() => {
    const handleUserProfile = async () => {
      if (user && user.emailVerified) {
        setIsLoadingProfile(true);
        
        try {
          // First, try to get existing profile
          let profile = await userService.getUserProfile(user.id);
          
          if (!profile) {
            // If no profile exists, create it (user just verified email)
            console.log('Creating profile for verified user...');
            await userService.handleEmailVerification(user.id, user.name, user.email);
            
            // Try to get profile again after creation
            profile = await userService.getUserProfile(user.id);
          }
          
          setUserProfile(profile);
        } catch (error) {
          console.error('Error handling user profile:', error);
          // Handle error gracefully - maybe show a notification
        } finally {
          setIsLoadingProfile(false);
        }
      }
    };

    if (user?.emailVerified) {
      handleUserProfile();
    }
  }, [user]);

  // Show loading state while checking authentication
  if (!isAuthenticated || !user) {
    return null;
  }

  // Show loading state while profile is being created/fetched
  if (isLoadingProfile) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Setting up your account...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Dashboard;