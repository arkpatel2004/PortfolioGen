import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Github, Linkedin, Code, Zap, Download, ChevronRight,
  User, Mail, Lock, Eye, EyeOff, CheckCircle
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { login, signup, resendVerification, isAuthenticated, user } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    setShowVerificationMessage(false);

    try {
      if (isLogin) {
        await login(formData.email, formData.password);
        navigate('/dashboard');
      } else {
        const result = await signup(formData.name, formData.email, formData.password);
        if (result.needsVerification) {
          setShowVerificationMessage(true);
          setFormData({ name: '', email: formData.email, password: '' });
        }
      }
    } catch (error: any) {
      if (isLogin) {
        if (error.message === 'email-not-verified') {
          setErrorMsg("Please verify your email before logging in. Check your inbox for verification link.");
        } else if (error.code === "auth/user-not-found") {
          setErrorMsg("Invalid email. This email is not registered.");
        } else if (error.code === "auth/wrong-password") {
          setErrorMsg("Invalid password. Please try again.");
        } else if (error.code === "auth/invalid-email") {
          setErrorMsg("Invalid email address format.");
        } else {
          setErrorMsg("Login failed. Please check your credentials.");
        }
      } else {
        // Signup errors
        if (error.code === "auth/email-already-in-use") {
          setErrorMsg("This email is already registered.");
        } else if (error.code === "auth/invalid-email") {
          setErrorMsg("Invalid email address.");
        } else if (error.code === "auth/weak-password") {
          setErrorMsg("Password should be at least 6 characters.");
        } else {
          setErrorMsg("Signup failed. Please try again.");
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      setIsLoading(true);
      await resendVerification();
      setErrorMsg("");
      alert("Verification email sent! Please check your inbox.");
    } catch (error) {
      setErrorMsg("Failed to resend verification email. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Open login modal and clear form/errors
  const openLogin = () => {
    setShowAuth(true);
    setIsLogin(true);
    setFormData({ name: '', email: '', password: '' });
    setErrorMsg('');
    setShowVerificationMessage(false);
  };

  // Open signup modal and clear form/errors
  const openSignup = () => {
    setShowAuth(true);
    setIsLogin(false);
    setFormData({ name: '', email: '', password: '' });
    setErrorMsg('');
    setShowVerificationMessage(false);
  };

  const features = [
    {
      icon: <Github className="w-8 h-8" />,
      title: "GitHub Integration",
      description: "Automatically fetch your repositories, contributions, and coding activity"
    },
    {
      icon: <Linkedin className="w-8 h-8" />,
      title: "LinkedIn Import",
      description: "Parse your LinkedIn profile from PDF exports to extract experience and skills"
    },
    {
      icon: <Code className="w-8 h-8" />,
      title: "Beautiful Portfolios",
      description: "Generate stunning, responsive portfolio websites ready for deployment"
    },
    {
      icon: <Download className="w-8 h-8" />,
      title: "Professional Resume",
      description: "Create polished, ATS-friendly resumes in multiple formats"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl animate-pulse delay-2000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 py-6">
        <nav className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gray-900">PortfolioGen</span>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={openLogin}
              className="px-6 py-2 text-gray-700 hover:text-blue-600 transition-colors duration-200 font-medium"
            >
              Sign In
            </button>
            <button
              onClick={openSignup}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Get Started
            </button>
          </div>
        </nav>
      </header>

      {/* Hero Section - Same as before */}
      <main className="relative z-10 px-6 pt-20 pb-32">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
              Generate Your
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Professional</span>
              <br />Portfolio Instantly
            </h1>
            <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
              Transform your GitHub repositories and LinkedIn profile into a stunning portfolio website
              and professional resume in minutes. No coding required.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-6">
              <button
                onClick={openSignup}
                className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:-translate-y-1 flex items-center space-x-2"
              >
                <span>Start Building</span>
                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>

              <button className="px-8 py-4 border-2 border-gray-200 text-gray-700 rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-all duration-200 font-semibold text-lg">
                See Examples
              </button>
            </div>
          </div>

          {/* Features Grid - Same as before */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group p-8 bg-white/70 backdrop-blur-sm rounded-3xl border border-gray-100 hover:bg-white transition-all duration-300 hover:shadow-xl hover:-translate-y-2"
              >
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      {showAuth && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-8">
              {showVerificationMessage ? (
                // Email Verification Message
                <div className="text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h2>
                  <p className="text-gray-600 mb-6">
                    We've sent a verification link to <strong>{formData.email}</strong>. 
                    Click the link to verify your account, then return here to sign in.
                  </p>
                  <button
                    onClick={handleResendVerification}
                    disabled={isLoading}
                    className="w-full py-3 bg-blue-100 text-blue-600 rounded-2xl hover:bg-blue-200 transition-all duration-200 font-medium mb-4 disabled:opacity-50"
                  >
                    {isLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                  <button
                    onClick={() => {
                      setShowVerificationMessage(false);
                      setIsLogin(true);
                      setFormData({ name: '', email: '', password: '' });
                    }}
                    className="text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Already verified? Sign In
                  </button>
                </div>
              ) : (
                // Regular Auth Form
                <>
                  <div className="flex items-center justify-between mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">
                      {isLogin ? 'Welcome Back' : 'Create Account'}
                    </h2>
                    <button
                      onClick={() => setShowAuth(false)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {errorMsg && (
                    <div className="relative mb-6">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-200"></div>
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-4 bg-white text-red-600 font-semibold">
                          {errorMsg}
                        </span>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {!isLogin && (
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="text"
                          placeholder="Full Name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors"
                          required
                        />
                      </div>
                    )}

                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="email"
                        placeholder="Email Address"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors"
                        required
                      />
                    </div>

                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type={showPassword ? "text" : "password"}
                        placeholder="Password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full pl-12 pr-12 py-4 border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isLoading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                  </form>

                  <div className="mt-6 text-center">
                    <button
                      onClick={() => {
                        setIsLogin(!isLogin);
                        setFormData({ name: '', email: '', password: '' });
                        setErrorMsg('');
                      }}
                      className="text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;