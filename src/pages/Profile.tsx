import React from 'react';
import { useAuth } from '../contexts/AuthContext';

const Profile: React.FC = () => {
  const { user } = useAuth();

  // Get first letter of username for avatar
  const getInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Profile Header */}
      <div className="bg-white rounded-2xl p-8 border border-gray-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center space-y-6 md:space-y-0 md:space-x-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-2xl border-4 border-gray-100 bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center">
              <span className="text-4xl font-bold text-white">
                {getInitial(user?.name || '')}
              </span>
            </div>
          </div>

          <div className="flex-1">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{user?.name || 'User Name'}</h1>
              <p className="text-gray-600 mb-4">{user?.email || 'user@example.com'}</p>
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
              <p className="text-2xl font-bold text-blue-600">12</p>
            </div>
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">📄</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-purple-50 rounded-xl">
            <div>
              <p className="font-semibold text-purple-900">Resumes Generated</p>
              <p className="text-2xl font-bold text-purple-600">8</p>
            </div>
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
              <span className="text-white font-bold">📝</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;