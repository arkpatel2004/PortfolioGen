from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
from datetime import datetime
import uuid
import json
import re
import requests
from io import BytesIO
import PyPDF2
import google.generativeai as genai
import base64

# --- Configuration ---
class Config:
    # IMPORTANT: Replace with your actual Gemini API Key
    GEMINI_API_KEY = "AIzaSyD4FlIeXdS_kfi5W2TGLECvug69rBJ7MsM"
    UPLOAD_FOLDER = 'storage/uploads'
    GENERATED_FOLDER = 'storage/generated'
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

app = Flask(__name__)
CORS(app)

# --- Service Classes ---

class PDFParser:
    def extract_text_from_pdf(self, pdf_file):
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.read()))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            print("=== Extracted PDF text ===")
            print("=== End of PDF text ===")
            return text
        except Exception as e:
            raise Exception(f"Failed to parse PDF: {e}")

    def extract_sections(self, text):
        experiences, education = [], []
        exp_match = re.search(r"Experience(.*?)(Education|Skills|$)", text, re.DOTALL | re.IGNORECASE)
        if exp_match:
            exp_text = exp_match.group(1).strip()
            lines = [line.strip() for line in exp_text.split('\n') if line.strip()]
            i = 0
            while i + 3 < len(lines):
                experiences.append({"company": lines[i], "jobTitle": lines[i+1], "date": lines[i+2], "location": lines[i+3]})
                i += 4
                if i < len(lines) and re.match(r"Education|Skills", lines[i], re.IGNORECASE):
                    break
        edu_match = re.search(r"Education(.*?)(Experience|Skills|Page|$)", text, re.DOTALL | re.IGNORECASE)
        if edu_match:
            edu_text = edu_match.group(1).strip()
            lines = [line.strip() for line in edu_text.split('\n') if line.strip()]
            i = 0
            while i + 1 < len(lines):
                school, date = lines[i], lines[i+1]
                if "Page" in school or "Page" in date: break
                education.append({"school": school, "date": date})
                i += 2
        return experiences, education

class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"

    def extract_username_from_url(self, github_url):
        match = re.search(r'github\.com/([^/]+)', github_url)
        if match:
            return match.group(1)
        raise ValueError("Invalid GitHub URL format")

    def get_readme_content(self, owner, repo_name):
        try:
            readme_url = f"{self.base_url}/repos/{owner}/{repo_name}/readme"
            response = requests.get(readme_url)
            response.raise_for_status()
            content_encoded = response.json().get('content', '')
            if content_encoded:
                return base64.b64decode(content_encoded).decode('utf-8')
            return None
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404:
                print(f"No README found for {owner}/{repo_name}")
                return None
            raise e
        except Exception as e:
            print(f"An error occurred fetching README for {owner}/{repo_name}: {e}")
            return None

    def get_user_data(self, github_url):
        try:
            username = self.extract_username_from_url(github_url)
            user_response = requests.get(f"{self.base_url}/users/{username}")
            user_response.raise_for_status()
            user_data = user_response.json()

            repos_response = requests.get(f"{self.base_url}/users/{username}/repos?sort=updated&per_page=10")
            repos_response.raise_for_status()
            repos_data = repos_response.json()

            return {
                'profile': user_data,
                'repositories': self._process_repositories(repos_data, user_data)
            }
        except Exception as e:
            raise Exception(f"Failed to fetch GitHub data: {e}")

    def _process_repositories(self, repos, owner_profile):
        processed_repos = []
        owner_login = owner_profile.get('login')
        if not owner_login: return []

        for repo in repos:
            if not repo.get('fork', False) and repo.get('size', 0) > 0:
                readme_content = self.get_readme_content(owner_login, repo.get('name'))
                processed_repos.append({
                    'name': repo.get('name'),
                    'description': repo.get('description'),
                    'language': repo.get('language'),
                    'topics': repo.get('topics', []),
                    'readme': readme_content
                })
        return processed_repos[:6]

class GeminiService:
    def __init__(self, api_key):
        try:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-1.5-flash')
            print("Gemini Service initialized successfully.")
        except Exception as e:
            print(f"Error initializing Gemini Service: {e}")
            self.model = None

    def generate_resume_summary(self, resume_text: str) -> str:
        if not self.model: return "Error: Gemini model not initialized."
        prompt = f"Based on the following resume text, create a compelling and concise professional summary of 4-5 lines. Focus on key skills, experience, and career aspirations.\n\n**Resume Text:**\n---\n{resume_text}\n---"
        try:
            response = self.model.generate_content(prompt)
            print("Successfully generated resume summary.")
            return response.text.strip()
        except Exception as e:
            print(f"Error calling Gemini API for summary: {e}")
            return "Passionate and skilled professional seeking to leverage expertise in software development and project management."
    
    def generate_project_description(self, project_name: str, existing_info: str) -> str:
        if not self.model: return "A key project demonstrating skills in software development and problem-solving."
        prompt = f"""
        Act as a professional resume writer. Analyze the provided project information below, which could be a detailed README file or a brief summary. Your goal is to extract the most important information and write a polished, professional description of 2-3 lines for a resume's "Projects" section.

        **Instructions:**
        - Synthesize the context to clearly explain the project's purpose, key features, and what it does.
        - Mention primary technologies if evident.
        - The final output **must** be a complete, well-written paragraph.
        - **Crucially, do not** use any placeholders, square brackets [], or instructional text like "insert description here". Write the final description yourself.

        **Project Information to Analyze:**
        - **Project Name:** "{project_name}"
        - **Context / README:** "{existing_info}"

        **Generated Resume Description:**
        """
        try:
            response = self.model.generate_content(prompt)
            print(f"Successfully generated description for project: {project_name}")
            return response.text.strip().replace("**", "")
        except Exception as e:
            print(f"Error generating description for project {project_name}: {e}")
            return f"A project named '{project_name}' that showcases practical application of technical skills."

    def extract_user_data(self, linkedin_text, github_data, pdf_parser: PDFParser):
        generated_summary = self.generate_resume_summary(linkedin_text)
        experiences, education = pdf_parser.extract_sections(linkedin_text)
        profile = github_data.get('profile', {})
        repos = github_data.get('repositories', [])

        generated_projects = []
        for repo in repos:
            project_title = repo.get('name', 'Untitled').replace('-', ' ').title()
            readme_content = repo.get('readme')
            if readme_content:
                project_context = readme_content
            else:
                project_context = (f"Description: {repo.get('description', 'N/A')}. "
                                   f"Language: {repo.get('language', 'N/A')}. "
                                   f"Topics: {', '.join(repo.get('topics', [])) or 'N/A'}.")
            generated_desc = self.generate_project_description(project_title, project_context)
            generated_projects.append({"title": project_title, "description": generated_desc})

        return {
            "name": profile.get('name') or profile.get('login', 'Unknown'),
            "title": profile.get('bio') or "Software Developer",
            "summary": generated_summary,
            "contact": {
                "email": profile.get('email', 'your-email@example.com'),
                "location": profile.get('location', 'City, Country'),
                "linkedin": "linkedin.com/in/your-profile",
                "github": profile.get('html_url', ''),
                "website": profile.get('blog', '')
            },
            "experience": experiences or [],
            "projects": generated_projects,
            "education": education or [],
            "skills": [
                {"category": "Programming Languages", "items": list(set([r['language'] for r in repos if r['language']])) or ["Python", "JavaScript"]},
                {"category": "Technologies", "items": ["React", "Node.js", "Docker", "AWS"]}
            ],
            "certifications": []
        }

class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
        self.storage_dir = Config.GENERATED_FOLDER

    def _generate_file(self, user_data, template_id, file_type):
        try:
            template_path = os.path.join(self.templates_dir, f"{file_type}{template_id}.html")
            with open(template_path, 'r', encoding='utf-8') as f:
                template_html = f.read()
            
            render_func = 'renderResume' if file_type == 'resume' else 'renderPortfolio'
            script_injection = f"<script>window.onload = () => {{ if(typeof {render_func} === 'function') {render_func}({json.dumps(user_data)}); }};</script>"
            populated_html = template_html.replace('</body>', f'{script_injection}</body>')
            
            filename = f"{file_type}_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(populated_html)
            return filename
        except Exception as e:
            raise Exception(f"Failed to generate {file_type}: {e}")

    def generate_resume(self, user_data, template_id):
        return self._generate_file(user_data, template_id, 'resume')

    def generate_portfolio(self, user_data, template_id):
        return self._generate_file(user_data, template_id, 'portfolio')

# --- Initialization & Routes ---
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.GENERATED_FOLDER, exist_ok=True)
os.makedirs("templates", exist_ok=True)

pdf_parser = PDFParser()
github_service = GitHubService()
gemini_service = GeminiService(api_key=Config.GEMINI_API_KEY)
template_service = TemplateService()

@app.route('/api/generate', methods=['POST'])
def generate_portfolio_resume():
    try:
        if 'linkedin_pdf' not in request.files or not request.form.get('github_url'):
            return jsonify({'error': 'Missing required form fields (linkedin_pdf, github_url)'}), 400
        
        pdf_file = request.files['linkedin_pdf']
        github_url = request.form.get('github_url')
        portfolio_template = int(request.form.get('portfolio_template', 1))
        resume_template = int(request.form.get('resume_template', 1))

        linkedin_text = pdf_parser.extract_text_from_pdf(pdf_file)
        github_data = github_service.get_user_data(github_url)
        user_data = gemini_service.extract_user_data(linkedin_text, github_data, pdf_parser)

        resume_filename = template_service.generate_resume(user_data, resume_template)
        portfolio_filename = template_service.generate_portfolio(user_data, portfolio_template)

        return jsonify({
            'success': True,
            'resume_url': f'/api/download/resume/{resume_filename}',
            'portfolio_url': f'/api/download/portfolio/{portfolio_filename}',
            'preview_resume_url': f'/api/preview/resume/{resume_filename}',
            'preview_portfolio_url': f'/api/preview/portfolio/{portfolio_filename}'
        })
    except Exception as e:
        print(f"Error in /api/generate: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<file_type>/<filename>')
def download_file(file_type, filename):
    return send_from_directory(Config.GENERATED_FOLDER, filename, as_attachment=True)

@app.route('/api/preview/<file_type>/<filename>')
def preview_file(file_type, filename):
    return send_from_directory(Config.GENERATED_FOLDER, filename)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})

if __name__ == '__main__':
    # Simplified endpoints for download and preview
    app.add_url_rule('/api/download/resume/<filename>', 'download_resume', lambda filename: download_file('resume', filename))
    app.add_url_rule('/api/download/portfolio/<filename>', 'download_portfolio', lambda filename: download_file('portfolio', filename))
    app.add_url_rule('/api/preview/resume/<filename>', 'preview_resume', lambda filename: preview_file('resume', filename))
    app.add_url_rule('/api/preview/portfolio/<filename>', 'preview_portfolio', lambda filename: preview_file('portfolio', filename))
    
    print("Starting Portfolio Generator Backend...")
    app.run(debug=True, port=5000)