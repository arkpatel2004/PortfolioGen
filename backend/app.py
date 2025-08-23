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

class Config:
    GEMINI_API_KEY = "AIzaSyD4FlIeXdS_kfi5W2TGLECvug69rBJ7MsM"
    UPLOAD_FOLDER = 'storage/uploads'
    GENERATED_FOLDER = 'storage/generated'
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

app = Flask(__name__)
CORS(app)

class PDFParser:
    def extract_text_from_pdf(self, pdf_file):
        try:
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.read()))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            print("=== Extracted LinkedIn PDF text ===")
            print(text)  # Console log for you to observe structure and adjust if needed
            print("=== End of LinkedIn PDF text ===")
            return text
        except Exception as e:
            raise Exception(f"Failed to parse PDF: {e}")

    def extract_sections(self, text):
        # Parse Experience section first
        experiences = []
        education = []
        
        # Find Experience section
        exp_match = re.search(
            r"Experience(.*?)(Education|Skills|$)", 
            text, re.DOTALL | re.IGNORECASE
        )
        if exp_match:
            exp_text = exp_match.group(1).strip()
            # Split experience lines by newline
            lines = [line.strip() for line in exp_text.split('\n') if line.strip()]
            i = 0
            while i + 3 < len(lines):
                company = lines[i]
                job_title = lines[i+1]
                date = lines[i+2]
                location = lines[i+3]

                # Prepare experience object with keys company, jobTitle, date, location
                experiences.append({
                    "company": company,
                    "jobTitle": job_title,
                    "date": date,
                    "location": location
                })

                i += 4  # move to next 4-line chunk
                # Stop if next line is "Education" or "Skills"
                if i < len(lines):
                    next_line = lines[i]
                    if re.match(r"Education|Skills", next_line, re.IGNORECASE):
                        break

        # Find Education section
        edu_match = re.search(
            r"Education(.*?)(Experience|Skills|Page|$)", 
            text, re.DOTALL | re.IGNORECASE
        )
        if edu_match:
            edu_text = edu_match.group(1).strip()
            lines = [line.strip() for line in edu_text.split('\n') if line.strip()]
            # Education: school then date per 2 lines, stop on line with 'Page'
            i = 0
            while i + 1 < len(lines):
                school = lines[i]
                date = lines[i+1]
                if "Page" in school or "Page" in date:
                    break
                education.append({
                    "school": school,
                    "date": date
                })
                i += 2

        return experiences, education

class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"

    def extract_username_from_url(self, github_url):
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
                'repositories': self._process_repositories(repos_data)
            }
        except Exception as e:
            raise Exception(f"Failed to fetch GitHub data: {e}")

    def _process_repositories(self, repos):
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
        return processed_repos[:6]

class GeminiService:
    def extract_user_data(self, linkedin_text, github_data, pdf_parser: PDFParser):
        experiences, education = pdf_parser.extract_sections(linkedin_text)

        profile = github_data.get('profile', {})
        repos = github_data.get('repositories', [])

        user_data = {
            "name": profile.get('name') or profile.get('login', 'Unknown'),
            "title": profile.get('bio') or "Software Developer",
            "summary": profile.get('bio') or "Passionate developer building amazing projects.",
            "contact": {
                "email": profile.get('email', ''),
                "location": profile.get('location', ''),
                "linkedin": "linkedin.com/in/user",  # You can enhance extraction to get real LinkedIn URL here
                "github": profile.get('html_url', ''),
                "website": profile.get('blog', '')
            },
            "experience": experiences if experiences else [
                {
                    "company": "Tech Company",
                    "jobTitle": "Software Developer",
                    "date": "Jan 2022 - Present",
                    "location": ""
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
            "education": education if education else [
                {
                    "school": "University Name",
                    "date": "2018-2022"
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

class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
        self.storage_dir = "storage/generated"

    def generate_resume(self, user_data, template_id):
        try:
            template_path = os.path.join(self.templates_dir, f"resume{template_id}.html")
            with open(template_path, 'r', encoding='utf-8') as file:
                template_html = file.read()
            populated_html = self._inject_resume_data(template_html, user_data)
            filename = f"resume_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(populated_html)
            return filename
        except Exception as e:
            raise Exception(f"Failed to generate resume: {e}")

    def generate_portfolio(self, user_data, template_id):
        try:
            template_path = os.path.join(self.templates_dir, f"portfolio{template_id}.html")
            with open(template_path, 'r', encoding='utf-8') as file:
                template_html = file.read()
            populated_html = self._inject_portfolio_data(template_html, user_data)
            filename = f"portfolio_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as file:
                file.write(populated_html)
            return filename
        except Exception as e:
            raise Exception(f"Failed to generate portfolio: {e}")

    def _inject_resume_data(self, template_html, user_data):
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


os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
os.makedirs(Config.GENERATED_FOLDER, exist_ok=True)
os.makedirs("templates", exist_ok=True)

pdf_parser = PDFParser()
github_service = GitHubService()
gemini_service = GeminiService()
template_service = TemplateService()

@app.route('/api/generate', methods=['POST'])
def generate_portfolio_resume():
    try:
        github_url = request.form.get('github_url')
        portfolio_template = int(request.form.get('portfolio_template'))
        resume_template = int(request.form.get('resume_template'))

        if not github_url:
            return jsonify({'error': 'GitHub URL is required'}), 400

        if 'linkedin_pdf' not in request.files:
            return jsonify({'error': 'No LinkedIn PDF uploaded'}), 400

        pdf_file = request.files['linkedin_pdf']
        if pdf_file.filename == '':
            return jsonify({'error': 'No file selected'}), 400

        temp_filename = f"{uuid.uuid4().hex}_{pdf_file.filename}"
        temp_path = os.path.join(Config.UPLOAD_FOLDER, temp_filename)
        os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
        pdf_file.save(temp_path)

        with open(temp_path, 'rb') as f:
            linkedin_text = pdf_parser.extract_text_from_pdf(f)

        os.remove(temp_path)

        github_data = github_service.get_user_data(github_url)

        user_data = gemini_service.extract_user_data(linkedin_text, github_data, pdf_parser)

        resume_filename = template_service.generate_resume(user_data, resume_template)
        portfolio_filename = template_service.generate_portfolio(user_data, portfolio_template)

        user_id = str(uuid.uuid4())
        data_path = os.path.join(Config.GENERATED_FOLDER, f"user_data_{user_id}.json")
        os.makedirs(Config.GENERATED_FOLDER, exist_ok=True)
        with open(data_path, 'w', encoding='utf-8') as f:
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
