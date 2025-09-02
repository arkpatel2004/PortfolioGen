import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';

const Profile: React.FC = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Exit if there is no user
    if (!user?.id) {
      setLoading(false);
      return;
    }

    // Set up a real-time listener for the user's profile
    const unsubscribe = userService.onUserProfileSnapshot(
      user.id,
      (profile) => {
        if (profile) {
          setUserProfile(profile);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching user profile:', error);
        setLoading(false);
      }
    );

    // Clean up the listener when the component unmounts
    return () => unsubscribe();
  }, [user?.id]);

  // Get first letter of username for avatar
  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  if (!user) {
    // This guard clause prevents crashes during navigation
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
          <div className="animate-pulse">
            <div className="h-32 w-32 bg-gray-200 rounded-2xl mb-6"></div>
            <div className="h-8 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl border-4 border-gray-100 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {getInitial(user.name || '')}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{user.name || 'User Name'}</h1>
              <p className="text-gray-600 mb-4">{user.email || 'user@example.com'}</p>
              <p className="text-gray-600">Passionate developer with 5+ years of experience in full-stack development.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Statistics */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Account Statistics</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
            <div>
              <p className="font-semibold text-blue-900">Portfolios Created</p>
              <p className="text-2xl font-bold text-blue-600">{userProfile?.portfoliosGenerated || 0}</p>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">📄</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
            <div>
              <p className="font-semibold text-purple-900">Resumes Generated</p>
              <p className="text-2xl font-bold text-purple-600">{userProfile?.resumesGenerated || 0}</p>
            </div>
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">📝</span>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Profile Information */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Account Details</h2>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Current Tokens</label>
              <p className="text-lg font-semibold text-gray-900">{userProfile?.tokens ?? 0} tokens</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Member Since</label>
              <p className="text-lg font-semibold text-gray-900">
                {userProfile?.createdAt ? new Date(userProfile.createdAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500">Last Activity</label>
              <p className="text-lg font-semibold text-gray-900">
                {userProfile?.updatedAt ? new Date(userProfile.updatedAt).toLocaleDateString() : 'N/A'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500">Account Status</label>
              <p className="text-lg font-semibold text-green-600">Active</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;