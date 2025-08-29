import React, { useState, useEffect } from 'react';
import { Zap, Play, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService, UserProfile } from '../services/userService';

const Tokens: React.FC = () => {
  const { user } = useAuth();
  const [isWatchingAd, setIsWatchingAd] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserProfile = async () => {
      if (user?.id) {
        try {
          // Ensure user profile exists with tokens
          await userService.initializeUserProfile(user.id, user.name, user.email);
          const profile = await userService.getUserProfile(user.id);
          setUserProfile(profile);
        } catch (error) {
          console.error('Error loading user profile:', error);
        } finally {
          setLoading(false);
        }
      }
    };

    loadUserProfile();
  }, [user?.id]);

  const handleWatchAd = async () => {
    if (!user?.id) return;
    
    setIsWatchingAd(true);
    
    try {
      // Simulate watching ad
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Add 1 token to user's balance
      await userService.addTokens(user.id, 1);
      
      // Refresh user profile
      const updatedProfile = await userService.getUserProfile(user.id);
      setUserProfile(updatedProfile);
      
    } catch (error) {
      console.error('Error adding tokens:', error);
    } finally {
      setIsWatchingAd(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
          <div className="animate-pulse">
            <div className="h-8 bg-white bg-opacity-20 rounded mb-4"></div>
            <div className="h-4 bg-white bg-opacity-20 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const currentTokens = userProfile?.tokens || 20;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Current Balance */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Token Balance</h1>
            <p className="text-blue-100">Use tokens to generate portfolios and resumes</p>
          </div>
          <div className="text-right">
            <p className="text-5xl font-bold">{currentTokens}</p>
            <p className="text-blue-100">tokens remaining</p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Watch Ad for Tokens */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Earn Free Tokens</h3>
          
          <div className="text-center p-8 bg-gradient-to-br from-green-50 to-blue-50 rounded-2xl border border-green-100">
            <div className="w-16 h-16 bg-green-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Play className="w-8 h-8 text-white" />
            </div>
            
            <h4 className="text-xl font-bold text-gray-900 mb-2">Watch an Ad</h4>
            <p className="text-gray-600 mb-6">Watch a short advertisement to earn 1 free token</p>
            
            <button
              onClick={handleWatchAd}
              disabled={isWatchingAd}
              className="px-8 py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-all duration-200 font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 mx-auto"
            >
              {isWatchingAd ? (
                <>
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
                  <span>Watching Ad...</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5" />
                  <span>Watch Ad (+1 Token)</span>
                </>
              )}
            </button>
            
            <p className="text-sm text-gray-500 mt-4">
              Watch ads to earn free tokens
            </p>
          </div>
        </div>

        {/* Token Costs */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-6">Token Pricing</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Portfolio Generation</p>
                  <p className="text-sm text-gray-500">Complete website with multiple pages</p>
                </div>
              </div>
              <span className="font-bold text-blue-600">5 tokens</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-gray-900">Resume Generation</p>
                  <p className="text-sm text-gray-500">Professional PDF resume</p>
                </div>
              </div>
              <span className="font-bold text-purple-600">3 tokens</span>
            </div>
          </div>

        </div>
      </div>

      {/* How to Earn Tokens */}
      <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-2xl p-6 border border-green-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Zap className="w-5 h-5 text-green-600" />
          <span>How to Earn Tokens</span>
        </h3>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3">
              <Play className="w-6 h-6" />
            </div>
            <p className="font-medium text-gray-900 mb-2">Watch Advertisements</p>
            <p className="text-sm text-gray-600">Watch short ads to earn 1 token each</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3">
              <Check className="w-6 h-6" />
            </div>
            <p className="font-medium text-gray-900 mb-2">Daily Login</p>
            <p className="text-sm text-gray-600">Get bonus tokens for logging in daily (coming soon)</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3">
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Tokens;