import React, { useState } from 'react';
import { Globe, FileText, Download, ExternalLink, Calendar, Filter, Search, MoreVertical, Trash2, Eye } from 'lucide-react';

const History: React.FC = () => {
  const [filterType, setFilterType] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const historyItems = [
    {
      id: 1,
      name: 'Portfolio v3.2',
      type: 'portfolio',
      status: 'completed',
      createdAt: '2 hours ago',
      githubUrl: 'https://github.com/johndoe',
      linkedinData: 'LinkedIn_Export_Dec2024.pdf',
      previewUrl: 'https://johndoe-portfolio-v32.netlify.app',
      downloadUrl: '#',
      tokens: 5
    },
    {
      id: 2,
      name: 'Resume December 2024',
      type: 'resume',
      status: 'completed',
      createdAt: '1 day ago',
      githubUrl: 'https://github.com/johndoe',
      linkedinData: 'LinkedIn_Export_Dec2024.pdf',
      previewUrl: '#',
      downloadUrl: '#',
      tokens: 3
    },
    {
      id: 3,
      name: 'Portfolio v3.1',
      type: 'portfolio',
      status: 'processing',
      createdAt: '2 days ago',
      githubUrl: 'https://github.com/johndoe',
      linkedinData: 'LinkedIn_Export_Nov2024.pdf',
      previewUrl: null,
      downloadUrl: null,
      tokens: 5
    },
    {
      id: 4,
      name: 'Resume November 2024',
      type: 'resume',
      status: 'completed',
      createdAt: '1 week ago',
      githubUrl: 'https://github.com/johndoe',
      linkedinData: 'LinkedIn_Export_Nov2024.pdf',
      previewUrl: '#',
      downloadUrl: '#',
      tokens: 3
    },
    {
      id: 5,
      name: 'Portfolio v3.0',
      type: 'portfolio',
      status: 'failed',
      createdAt: '2 weeks ago',
      githubUrl: 'https://github.com/johndoe',
      linkedinData: 'LinkedIn_Export_Oct2024.pdf',
      previewUrl: null,
      downloadUrl: null,
      tokens: 0
    }
  ];

  const filteredItems = historyItems.filter(item => {
    const matchesType = filterType === 'all' || item.type === filterType;
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'processing':
        return 'bg-yellow-100 text-yellow-700';
      case 'failed':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getTypeIcon = (type: string) => {
    return type === 'portfolio' ? (
      <Globe className="w-5 h-5 text-blue-600" />
    ) : (
      <FileText className="w-5 h-5 text-purple-600" />
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generation History</h1>
        <p className="text-gray-600">View and manage your portfolio and resume generations</p>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Filter:</span>
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            >
              <option value="all">All Types</option>
              <option value="portfolio">Portfolios</option>
              <option value="resume">Resumes</option>
            </select>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search generations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none w-full lg:w-80"
            />
          </div>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Item</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Type</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Status</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Created</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Tokens</th>
                <th className="text-left py-4 px-6 font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-3">
                      {getTypeIcon(item.type)}
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-500">
                          {item.type === 'portfolio' ? 'Portfolio Website' : 'PDF Resume'}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="capitalize text-gray-700">{item.type}</span>
                  </td>
                  <td className="py-4 px-6">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(item.status)}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Calendar className="w-4 h-4" />
                      <span className="text-sm">{item.createdAt}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <span className="font-medium text-gray-900">{item.tokens}</span>
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      {item.status === 'completed' && (
                        <>
                          {item.previewUrl && (
                            <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Eye className="w-4 h-4" />
                            </button>
                          )}
                          <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                            <Download className="w-4 h-4" />
                          </button>
                          {item.previewUrl && (
                            <button className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                              <ExternalLink className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                      <div className="relative">
                        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No generations found</h3>
            <p className="text-gray-500 mb-6">
              {searchTerm ? 'Try adjusting your search terms' : 'Start by creating your first portfolio or resume'}
            </p>
            <button className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              Create New Generation
            </button>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Total Generations</h3>
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-blue-600">28</p>
          <p className="text-sm text-gray-500 mt-1">All time</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Portfolios</h3>
            <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-purple-600">18</p>
          <p className="text-sm text-gray-500 mt-1">Websites created</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Resumes</h3>
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-green-600">10</p>
          <p className="text-sm text-gray-500 mt-1">PDFs generated</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Success Rate</h3>
            <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
              <span className="text-yellow-600 font-bold">%</span>
            </div>
          </div>
          <p className="text-3xl font-bold text-yellow-600">96%</p>
          <p className="text-sm text-gray-500 mt-1">Successful generations</p>
        </div>
      </div>
    </div>
  );
};

export default History;