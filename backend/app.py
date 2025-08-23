from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
import uuid
import json
import re
import requests
from io import BytesIO
import PyPDF2

# Config class to hold constants and keys
class Config:
    GEMINI_API_KEY = "AIzaSyD4FlIeXdS_kfi5W2TGLECvug69rBJ7MsM"  # Replace with your actual Gemini API key
    UPLOAD_FOLDER = 'storage/uploads'
    GENERATED_FOLDER = 'storage/generated'
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Setup Flask
app = Flask(__name__)
CORS(app)

# --- PDF Parsing Service ---
class PDFParser:
    def extract_text_from_pdf(self, pdf_file):
        """Extract text content from LinkedIn PDF"""
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.read()))
            text = ""
            
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            
            return self._clean_linkedin_text(text)
        except Exception as e:
            raise Exception(f"Failed to parse PDF: {e}")
    
    def _clean_linkedin_text(self, text):
        """Clean and format LinkedIn extracted text"""
        text = re.sub(r'\s+', ' ', text)
        text = text.replace('\n', ' ').strip()
        return text

# --- GitHub Data Service ---
class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"
    
    def extract_username_from_url(self, github_url):
        """Extract username from GitHub URL"""
        patterns = [
            r'github\.com/([^/]+)/?$',
            r'github\.com/([^/]+)/.*',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, github_url)
            if match:
                return match.group(1)
        
        raise ValueError("Invalid GitHub URL format")
    
    def get_user_data(self, github_url):
        """Fetch user profile and repositories from GitHub API"""
        try:
            username = self.extract_username_from_url(github_url)
            
            # Get user profile
            user_response = requests.get(f"{self.base_url}/users/{username}")
            user_response.raise_for_status()
            user_data = user_response.json()
            
            # Get repositories
            repos_response = requests.get(f"{self.base_url}/users/{username}/repos?sort=updated&per_page=10")
            repos_response.raise_for_status()
            repos_data = repos_response.json()
            
            return {
                'profile': user_data,
                'repositories': self._process_repositories(repos_data)
            }
        except Exception as e:
            raise Exception(f"Failed to fetch GitHub data: {e}")
    
    def _process_repositories(self, repos):
        """Process and filter repositories for portfolio"""
        processed_repos = []
        
        for repo in repos:
            if not repo.get('fork', False) and repo.get('size', 0) > 0:
                processed_repos.append({
                    'name': repo.get('name'),
                    'description': repo.get('description'),
                    'language': repo.get('language'),
                    'stars': repo.get('stargazers_count', 0),
                    'url': repo.get('html_url'),
                    'updated_at': repo.get('updated_at'),
                    'topics': repo.get('topics', [])
                })
        
        return processed_repos[:6]  # Limit to top 6 repositories

# --- Gemini AI Service ---
class GeminiService:
    def extract_user_data(self, linkedin_text, github_data):
        """Extract and structure user data using AI (mocked for demo)"""
        # NOTE: Replace this with actual Gemini API call
        # For now, we'll create a structured response from the data we have
        
        # Extract basic info from GitHub profile
        profile = github_data.get('profile', {})
        repos = github_data.get('repositories', [])
        
        # Create structured user data
        user_data = {
            "name": profile.get('name') or profile.get('login', 'Unknown'),
            "title": "Software Developer",  # You can enhance this with AI
            "summary": profile.get('bio') or "Passionate developer building amazing projects.",
            "contact": {
                "email": profile.get('email', ''),
                "location": profile.get('location', ''),
                "linkedin": "linkedin.com/in/user",  # Extract from LinkedIn PDF with AI
                "github": profile.get('html_url', ''),
                "website": profile.get('blog', '')
            },
            "experience": [
                # AI would extract this from LinkedIn PDF
                {
                    "jobTitle": "Software Developer",
                    "company": "Tech Company",
                    "startDate": "Jan 2022",
                    "endDate": "Present",
                    "description": ["Developed web applications", "Worked with modern technologies"]
                }
            ],
            "projects": [
                {
                    "title": repo['name'].replace('-', ' ').title(),
                    "technologies": repo['language'] or 'Various',
                    "date": repo['updated_at'][:10] if repo['updated_at'] else '',
                    "summary": repo['description'] or f"GitHub project: {repo['name']}",
                    "description": [
                        f"Repository with {repo['stars']} stars",
                        f"Built using {repo['language'] or 'various technologies'}"
                    ]
                } for repo in repos
            ],
            "education": [
                # AI would extract this from LinkedIn PDF
                {
                    "degree": "Bachelor's Degree in Computer Science",
                    "school": "University Name",
                    "date": "2018-2022",
                    "details": ""
                }
            ],
            "skills": [
                {
                    "category": "Programming Languages",
                    "items": list(set([repo['language'] for repo in repos if repo['language']]))
                },
                {
                    "category": "Technologies",
                    "items": ["React", "Node.js", "Python", "JavaScript"]
                }
            ],
            "certifications": []
        }
        
        return user_data

# --- Template Service ---
class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
        self.storage_dir = "storage/generated"
    
    def generate_resume(self, user_data, template_id):
        """Generate resume HTML with user data"""
        try:
            # Load resume template
            template_path = os.path.join(self.templates_dir, f"resume{template_id}.html")
            
            with open(template_path, 'r', encoding='utf-8') as file:
                template_html = file.read()
            
            # Inject user data into template
            populated_html = self._inject_resume_data(template_html, user_data)
            
            # Save generated resume
            filename = f"resume_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(populated_html)
            
            return filename
            
        except Exception as e:
            raise Exception(f"Failed to generate resume: {e}")
    
    def generate_portfolio(self, user_data, template_id):
        """Generate portfolio HTML with user data"""
        try:
            # Load portfolio template
            template_path = os.path.join(self.templates_dir, f"portfolio{template_id}.html")
            
            with open(template_path, 'r', encoding='utf-8') as file:
                template_html = file.read()
            
            # Inject user data into template
            populated_html = self._inject_portfolio_data(template_html, user_data)
            
            # Save generated portfolio
            filename = f"portfolio_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(populated_html)
            
            return filename
            
        except Exception as e:
            raise Exception(f"Failed to generate portfolio: {e}")
    
    def _inject_resume_data(self, template_html, user_data):
        """Inject user data into resume template"""
        script_injection = f"""
        <script>
        window.onload = function() {{
            const userData = {json.dumps(user_data)};
            if (typeof renderResume === 'function') {{
                renderResume(userData);
            }}
        }};
        </script>
        """
        
        return template_html.replace('</body>', f'{script_injection}</body>')
    
    def _inject_portfolio_data(self, template_html, user_data):
        """Inject user data into portfolio template"""
        script_injection = f"""
        <script>
        window.onload = function() {{
            const userData = {json.dumps(user_data)};
            if (typeof renderPortfolio === 'function') {{
                renderPortfolio(userData);
            }}
        }};
        </script>
        """
        
        return template_html.replace('</body>', f'{script_injection}</body>')

# --- Initialize Services ---
# Ensure directories exist
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.GENERATED_FOLDER, exist_ok=True)
os.makedirs('templates', exist_ok=True)

pdf_parser = PDFParser()
github_service = GitHubService()
gemini_service = GeminiService()
template_service = TemplateService()

# --- API Routes ---

@app.route('/api/generate', methods=['POST'])
def generate_portfolio_resume():
    try:
        # Get form data
        github_url = request.form.get('github_url')
        portfolio_template = int(request.form.get('portfolio_template'))
        resume_template = int(request.form.get('resume_template'))
        
        # Validate inputs
        if not github_url:
            return jsonify({'error': 'GitHub URL is required'}), 400
        
        # Get uploaded file
        if 'linkedin_pdf' not in request.files:
            return jsonify({'error': 'No LinkedIn PDF uploaded'}), 400
        
        pdf_file = request.files['linkedin_pdf']
        if pdf_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Save uploaded PDF temporarily
        temp_filename = f"{uuid.uuid4().hex}_{pdf_file.filename}"
        temp_path = os.path.join(Config.UPLOAD_FOLDER, temp_filename)
        pdf_file.save(temp_path)
        
        # Extract PDF text
        with open(temp_path, 'rb') as f:
            linkedin_text = pdf_parser.extract_text_from_pdf(f)
        
        # Clean up temporary file
        os.remove(temp_path)
        
        # Get GitHub data
        github_data = github_service.get_user_data(github_url)
        
        # Use AI to structure the data
        user_data = gemini_service.extract_user_data(linkedin_text, github_data)
        
        # Generate templates
        resume_filename = template_service.generate_resume(user_data, resume_template)
        portfolio_filename = template_service.generate_portfolio(user_data, portfolio_template)
        
        # Save user data for reference
        user_id = str(uuid.uuid4())
        data_path = os.path.join(Config.GENERATED_FOLDER, f"user_data_{user_id}.json")
        
        with open(data_path, 'w') as f:
            json.dump({
                'user_data': user_data,
                'resume_file': resume_filename,
                'portfolio_file': portfolio_filename,
                'generated_at': datetime.now().isoformat()
            }, f, indent=2)
        
        return jsonify({
            'success': True,
            'user_id': user_id,
            'resume_url': f'/api/download/resume/{resume_filename}',
            'portfolio_url': f'/api/download/portfolio/{portfolio_filename}',
            'preview_resume_url': f'/api/preview/resume/{resume_filename}',
            'preview_portfolio_url': f'/api/preview/portfolio/{portfolio_filename}'
        })
        
    except Exception as e:
        print(f"Error in generate_portfolio_resume: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/resume/<filename>')
def download_resume(filename):
    try:
        return send_from_directory(Config.GENERATED_FOLDER, filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/download/portfolio/<filename>')
def download_portfolio(filename):
    try:
        return send_from_directory(Config.GENERATED_FOLDER, filename, as_attachment=True)
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/preview/resume/<filename>')
def preview_resume(filename):
    try:
        return send_from_directory(Config.GENERATED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404

@app.route('/api/preview/portfolio/<filename>')
def preview_portfolio(filename):
    try:
        return send_from_directory(Config.GENERATED_FOLDER, filename)
    except FileNotFoundError:
        return jsonify({'error': 'File not found'}), 404

@app.route('/templates/<path:filename>')
def serve_templates(filename):
    try:
        return send_from_directory('templates', filename)
    except FileNotFoundError:
        return jsonify({'error': 'Template not found'}), 404

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    print("Starting Portfolio Generator Backend...")
    print(f"Upload folder: {Config.UPLOAD_FOLDER}")
    print(f"Generated files folder: {Config.GENERATED_FOLDER}")
    app.run(debug=True, port=5000, host='0.0.0.0')
