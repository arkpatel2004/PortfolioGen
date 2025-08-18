import React, { useState } from 'react';
import { Github, Linkedin, Upload, ExternalLink, Sparkles, FileText, Globe, Eye } from 'lucide-react';

const DashboardInputs: React.FC = () => {
  const [githubUrl, setGithubUrl] = useState('');
  const [linkedinFile, setLinkedinFile] = useState<File | null>(null);
  const [selectedPortfolioTemplate, setSelectedPortfolioTemplate] = useState<number | null>(null);
  const [selectedResumeTemplate, setSelectedResumeTemplate] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setLinkedinFile(file);
    }
  };

  const handleGenerate = async () => {
    if (!githubUrl || !linkedinFile || !selectedPortfolioTemplate || !selectedResumeTemplate) return;
    
    setIsProcessing(true);
    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    setIsProcessing(false);
  };

  const portfolioTemplates = [
    {
      id: 1,
      name: 'Modern Developer ',
      image: './image/p1.png',
    },
    {
      id: 2,
      name: 'Animated Dark',
      image: './image/p2.png',
    },
    {
      id: 3,
      name: 'Gradient Dreams',
      image: './image/p3.png',
    }
  ];

  const resumeTemplates = [
    {
      id: 1,
      name: 'Professional Gradient Corporate',
      image: './image/r1.png',
    },
    {
      id: 2,
      name: 'Classic Minimalist Professional',
      image: './image/r2.png',
    },
    {
      id: 3,
      name: 'Traditional Academic Professional',
      image: './image/r3.png',
    },
    {
      id: 4,
      name: 'Modern Dark Sidebar Resume',
      image: './image/r4.png',
    },
    {
      id: 5,
      name: 'Simple Clean Professional',
      image: './image/r5.png',

    }
  ];

  const handlePreviewPortfolio = (templateId: number) => {
    // Fetch the HTML content and open in new tab using Blob
    fetch(`/templates/portfolio${templateId}.html`)
      .then(response => response.text())
      .then(htmlContent => {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(error => {
        console.error('Error loading portfolio template:', error);
        alert('Error loading portfolio template. Please try again.');
      });
  };

  const handlePreviewResume = (templateId: number) => {
    // Fetch the HTML content and open in new tab using Blob
    fetch(`/templates/resume${templateId}.html`)
      .then(response => response.text())
      .then(htmlContent => {
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        
        // Clean up the object URL after a short delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
      .catch(error => {
        console.error('Error loading resume template:', error);
        alert('Error loading resume template. Please try again.');
      });
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
                      <h4 className="font-semibold text-gray-900">{template.name}</h4>
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

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={!githubUrl || !linkedinFile || !selectedPortfolioTemplate || !selectedResumeTemplate || isProcessing}
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
              <span>Generate Portfolio & Resume</span>
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