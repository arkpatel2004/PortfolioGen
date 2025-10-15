import React, { useState } from 'react';
import { Github, Linkedin, Upload, ExternalLink, Sparkles, FileText, Globe, Eye, Download, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/userService';

interface GenerateResponse {
  success: boolean;
  user_id: string;
  resume_url: string;
  portfolio_url: string;
  preview_resume_url: string;
  preview_portfolio_url: string;
  error?: string;
}

// API URL configuration - use localhost:5000 in development
const API_URL = import.meta.env.DEV ? 'http://localhost:5000' : '';

const DashboardInputs: React.FC = () => {
  const { user } = useAuth();
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [selectedPortfolioTemplate, setSelectedPortfolioTemplate] = useState<number | null>(null);
  const [selectedResumeTemplate, setSelectedResumeTemplate] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [generationResult, setGenerationResult] = useState<GenerateResponse | null>(null);
  const [error, setError] = useState<string>('');
  const [userTokens, setUserTokens] = useState<number>(0);

  // Load user tokens on component mount
  React.useEffect(() => {
    const loadUserTokens = async () => {
      if (user?.id) {
        try {
          await userService.initializeUserProfile(user.id, user.name, user.email);
          const profile = await userService.getUserProfile(user.id);
          setUserTokens(profile?.tokens || 0);
        } catch (error) {
          console.error('Error loading user tokens:', error);
        }
      }
    };

    loadUserTokens();
  }, [user?.id]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }
      setLinkedinFile(file);
      setError('');
    } else {
      setError('Please upload a valid PDF file');
    }
  };

  const handleGenerate = async () => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    if (!githubUrl || !linkedinFile || !selectedPortfolioTemplate || !selectedResumeTemplate) {
      setError('Please fill in all required fields');
      return;
    }
    
    const requiredTokens = 8;
    if (userTokens < requiredTokens) {
      setError(`Insufficient tokens. You need ${requiredTokens} tokens but only have ${userTokens}.`);
      return;
    }
    
    setIsProcessing(true);
    setError('');
    setGenerationResult(null);

    try {
      const portfolioName = `Portfolio ${new Date().toLocaleDateString()}`;
      const resumeName = `Resume ${new Date().toLocaleDateString()}`;
      
      const [portfolioId, resumeId] = await Promise.all([
        userService.addGenerationItem({
          userId: user.id,
          name: portfolioName,
          type: 'portfolio',
          status: 'processing',
          githubUrl,
          linkedinData: linkedinFile.name,
          tokens: 5,
          templateId: selectedPortfolioTemplate
        }),
        userService.addGenerationItem({
          userId: user.id,
          name: resumeName,
          type: 'resume',
          status: 'processing',
          githubUrl,
          linkedinData: linkedinFile.name,
          tokens: 3,
          templateId: selectedResumeTemplate
        })
      ]);

      const formData = new FormData();
      formData.append('github_url', githubUrl);
      formData.append('linkedin_pdf', linkedinFile);
      formData.append('portfolio_template', selectedPortfolioTemplate.toString());
      formData.append('resume_template', selectedResumeTemplate.toString());

      // FIXED: Use correct API URL
      console.log('Sending request to:', `${API_URL}/api/generate`);
      const response = await fetch(`${API_URL}/api/generate`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        await Promise.all([
          userService.updateGenerationStatus(portfolioId, 'completed', {
            previewUrl: result.preview_portfolio_url,
            downloadUrl: result.portfolio_url
          }),
          userService.updateGenerationStatus(resumeId, 'completed', {
            previewUrl: result.preview_resume_url,
            downloadUrl: result.resume_url
          })
        ]);

        const updatedProfile = await userService.getUserProfile(user.id);
        setUserTokens(updatedProfile?.tokens || 0);

        setGenerationResult(result);
        setError('');
      } else {
        await Promise.all([
          userService.updateGenerationStatus(portfolioId, 'failed'),
          userService.updateGenerationStatus(resumeId, 'failed')
        ]);
        throw new Error(result.error || 'Generation failed');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setError(error instanceof Error ? error.message : 'Generation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const portfolioTemplates = [
    {
      id: 1,
      name: 'Modern Developer',
      image: '/image/p1.png',
    },
    {
      id: 2,
      name: 'Animated Dark',
      image: '/image/p2.png',
    },
    {
      id: 3,
      name: 'Gradient Dreams',
      image: '/image/p3.png',
    }
  ];

  const resumeTemplates = [
    {
      id: 1,
      name: 'Professional Gradient Corporate',
      image: '/image/r1.png',
    },
    {
      id: 2,
      name: 'Classic Minimalist Professional',
      image: '/image/r2.png',
    },
    {
      id: 3,
      name: 'Traditional Academic Professional',
      image: '/image/r3.png',
    },
    {
      id: 4,
      name: 'Modern Dark Sidebar Resume',
      image: '/image/r4.png',
    },
    {
      id: 5,
      name: 'Simple Clean Professional',
      image: '/image/r5.png',
    }
  ];

  const handlePreviewPortfolio = async (templateId: number) => {
    try {
      // FIXED: Use correct API URL
      const response = await fetch(`${API_URL}/api/templates/portfolio/${templateId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Error loading portfolio template:', error);
      setError(`Error loading portfolio template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handlePreviewResume = async (templateId: number) => {
    try {
      // FIXED: Use correct API URL
      const response = await fetch(`${API_URL}/api/templates/resume/${templateId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const htmlContent = await response.text();
      const newWindow = window.open();
      if (newWindow) {
        newWindow.document.open();
        newWindow.document.write(htmlContent);
        newWindow.document.close();
      }
    } catch (error) {
      console.error('Error loading resume template:', error);
      setError(`Error loading resume template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const openPreview = (url: string) => {
    // FIXED: Use correct API URL
    window.open(`${API_URL}${url}`, '_blank');
  };

  const downloadFile = (url: string, filename: string) => {
    // FIXED: Use correct API URL
    const link = document.createElement('a');
    link.href = `${API_URL}${url}`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Generate Portfolio</h1>
        <p className="text-gray-600">
          Upload your data to instantly create a professional portfolio and resume
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center">
            <div className="w-5 h-5 text-red-500 mr-3">⚠️</div>
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Success Message with Results */}
      {generationResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center mb-4">
            <CheckCircle className="w-6 h-6 text-green-600 mr-3" />
            <h3 className="text-lg font-semibold text-green-800">Generation Successful!</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Portfolio Results */}
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Globe className="w-5 h-5 mr-2 text-purple-600" />
                Portfolio
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => openPreview(generationResult.preview_portfolio_url)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Portfolio</span>
                </button>
                <button
                  onClick={() => downloadFile(generationResult.portfolio_url, 'portfolio.html')}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Portfolio</span>
                </button>
              </div>
            </div>

            {/* Resume Results */}
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
                <FileText className="w-5 h-5 mr-2 text-green-600" />
                Resume
              </h4>
              <div className="space-y-2">
                <button
                  onClick={() => openPreview(generationResult.preview_resume_url)}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                  <span>Preview Resume</span>
                </button>
                <button
                  onClick={() => downloadFile(generationResult.resume_url, 'resume.html')}
                  className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Resume</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {/* GitHub URL Input */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center">
              <Github className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">GitHub Profile</h3>
              <p className="text-sm text-gray-500">Enter your GitHub username or profile URL</p>
            </div>
          </div>
          
          <div className="space-y-3">
            <input
              type="text"
              placeholder="https://github.com/yourusername"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none transition-colors"
            />
            {githubUrl && (
              <a
                href={githubUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Verify GitHub Profile</span>
              </a>
            )}
          </div>
        </div>

        {/* LinkedIn PDF Upload */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Linkedin className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">LinkedIn Profile</h3>
              <p className="text-sm text-gray-500">Upload your LinkedIn profile export (PDF)</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-gray-300 transition-colors">
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="linkedin-upload"
              />
              <label htmlFor="linkedin-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 mb-1">
                  {linkedinFile ? linkedinFile.name : 'Click to upload LinkedIn PDF'}
                </p>
                <p className="text-sm text-gray-400">PDF files only, max 10MB</p>
              </label>
            </div>
            
            {linkedinFile && (
              <div className="flex items-center space-x-2 text-green-600 text-sm">
                <FileText className="w-4 h-4" />
                <span>File uploaded successfully</span>
              </div>
            )}
          </div>
        </div>

        {/* Portfolio Template Selection */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Choose Portfolio Template</h3>
              <p className="text-sm text-gray-500">Select a template for your portfolio website</p>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {portfolioTemplates.map((template) => (
              <div
                key={template.id}
                className={`relative group cursor-pointer border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                  selectedPortfolioTemplate === template.id
                    ? 'border-blue-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedPortfolioTemplate(template.id)}
              >
                <div className="aspect-video bg-gray-100">
                  <img
                    src={template.image}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{template.name}</h4>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewPortfolio(template.id);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {selectedPortfolioTemplate === template.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resume Template Selection */}
        <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-green-600 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Choose Resume Template</h3>
              <p className="text-sm text-gray-500">Select a template for your resume PDF</p>
            </div>
          </div>

          <div className="grid md:grid-cols-5 gap-4">
            {resumeTemplates.map((template) => (
              <div
                key={template.id}
                className={`relative group cursor-pointer border-2 rounded-xl overflow-hidden transition-all duration-200 ${
                  selectedResumeTemplate === template.id
                    ? 'border-green-500 shadow-lg'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedResumeTemplate(template.id)}
              >
                <div className="aspect-[3/4] bg-gray-100">
                  <img
                    src={template.image}
                    alt={template.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900 text-sm">{template.name}</h4>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewResume(template.id);
                      }}
                      className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {selectedResumeTemplate === template.id && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Token Check Warning */}
        {userTokens < 8 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <div className="flex items-center">
              <div className="w-5 h-5 text-yellow-500 mr-3">⚠️</div>
              <p className="text-yellow-800">
                You need 8 tokens to generate both portfolio and resume (5 + 3). You currently have {userTokens} tokens.
                <a href="/dashboard/tokens" className="text-yellow-600 underline ml-1">Get more tokens</a>
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleGenerate}
          disabled={!githubUrl || !linkedinFile || !selectedPortfolioTemplate || !selectedResumeTemplate || isProcessing || userTokens < 8}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
        >
          {isProcessing ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full"></div>
              <span>Generating...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              <span>Generate Portfolio & Resume (8 tokens)</span>
            </>
          )}
        </button>
      </div>

      {/* Instructions */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-2xl p-6 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Sparkles className="w-5 h-5 text-blue-600" />
          <span>How it works</span>
        </h3>
        
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3 text-xl font-bold">1</div>
            <p className="font-medium text-gray-900 mb-2">Connect Your Profiles</p>
            <p className="text-sm text-gray-600">Add your GitHub URL and upload your LinkedIn PDF export</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3 text-xl font-bold">2</div>
            <p className="font-medium text-gray-900 mb-2">Choose Templates</p>
            <p className="text-sm text-gray-600">Select your preferred portfolio and resume templates</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3 text-xl font-bold">3</div>
            <p className="font-medium text-gray-900 mb-2">AI Processing</p>
            <p className="text-sm text-gray-600">Our AI extracts and organizes your professional information</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-orange-600 text-white rounded-xl flex items-center justify-center mx-auto mb-3 text-xl font-bold">4</div>
            <p className="font-medium text-gray-900 mb-2">Get Your Assets</p>
            <p className="text-sm text-gray-600">Download your portfolio website and professional resume</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardInputs;
