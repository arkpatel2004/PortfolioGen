from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import time
from datetime import datetime
import uuid
import json
import re
import requests
from io import BytesIO
import PyPDF2
import google.generativeai as genai
import base64

# Import API keys from config file
try:
    from config import GEMINI_API_KEYS, GITHUB_TOKEN
    print("✅ API keys loaded from config.py")
except ImportError:
    print("❌ config.py not found. Please create backend/config.py with your API keys")
    GEMINI_API_KEYS = []
    GITHUB_TOKEN = ""

# --- Configuration ---
class Config:
    GEMINI_API_KEYS = GEMINI_API_KEYS
    GITHUB_TOKEN = GITHUB_TOKEN
    UPLOAD_FOLDER = 'storage/uploads'
    GENERATED_FOLDER = 'storage/generated'
    MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

app = Flask(__name__)
CORS(app)

# --- HELPER FUNCTION ---
def print_json_data(data, title="DATA"):
    """Helper function to pretty print JSON data"""
    try:
        print(f"\n{'='*50}")
        print(f"🔍 {title}")
        print(f"{'='*50}")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print(f"{'='*50}")
        print(f"✅ END {title}")
        print(f"{'='*50}\n")
    except Exception as e:
        print(f"❌ Error printing {title}: {e}")

# --- Service Classes ---

class PDFParser:
    def extract_text_from_pdf(self, pdf_file):
        print("\n📄 [1/5] Starting PDF Text Extraction...")
        try:
            pdf_file.seek(0)
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.read()))
            text = ""
            for page in pdf_reader.pages:
                page_text = page.extract_text()
                if page_text and page_text.strip():
                    text += page_text + "\n"
            
            # --- ADDED PRINT STATEMENT as requested ---
            print("\n" + "=" * 50)
            print("📝 FULL EXTRACTED PDF TEXT:")
            print("=" * 50)
            print(text)
            print("=" * 50)

            print("📄 [1/5] ✅ PDF Text Extraction Successful.")
            return text
        except Exception as e:
            print(f"📄 [1/5] ❌ CRITICAL ERROR in PDF extraction: {e}")
            raise Exception(f"Failed to parse PDF: {e}")

    def extract_sections(self, text):
        print("📄 [2/5] Starting PDF Section Parsing...")
        experiences, education = [], []
        exp_match = re.search(r"Experience(.*?)(Education|Skills|$)", text, re.DOTALL | re.IGNORECASE)
        if exp_match:
            exp_text = exp_match.group(1).strip()
            lines = [line.strip() for line in exp_text.split('\n') if line.strip()]
            i = 0
            while i + 3 < len(lines):
                experiences.append({"company": lines[i], "jobTitle": lines[i+1], "date": lines[i+2], "location": lines[i+3]})
                i += 4
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
        print("📄 [2/5] ✅ PDF Sections Parsed Successfully.")
        return experiences, education

class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"
        self.headers = {"Authorization": f"Bearer {Config.GITHUB_TOKEN}"} if Config.GITHUB_TOKEN else {}

    def extract_username_from_url(self, github_url):
        match = re.search(r'github\.com/([^/]+)', github_url)
        if match: return match.group(1)
        raise ValueError("Invalid GitHub URL format")

    def get_readme_content(self, owner, repo_name):
        try:
            readme_url = f"{self.base_url}/repos/{owner}/{repo_name}/readme"
            response = requests.get(readme_url, headers=self.headers)
            response.raise_for_status()
            content_encoded = response.json().get('content', '')
            if content_encoded:
                return base64.b64decode(content_encoded).decode('utf-8')
            return None
        except Exception:
            return None

    def get_user_data(self, github_url):
        print("🐙 [3/5] Starting GitHub Data Fetching...")
        try:
            username = self.extract_username_from_url(github_url)
            user_response = requests.get(f"{self.base_url}/users/{username}", headers=self.headers)
            user_response.raise_for_status()
            user_data = user_response.json()
            repos_response = requests.get(f"{self.base_url}/users/{username}/repos?sort=updated&per_page=10", headers=self.headers)
            repos_response.raise_for_status()
            repos_data = repos_response.json()
            result = {
                'profile': user_data,
                'repositories': self._process_repositories(repos_data, user_data)
            }
            print("🐙 [3/5] ✅ GitHub Data Fetched Successfully.")
            return result
        except Exception as e:
            print(f"🐙 [3/5] ❌ Error fetching GitHub data: {e}")
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
                    'readme': readme_content,
                    'html_url': repo.get('html_url')
                })
        return processed_repos[:6]

class GeminiService:
    def __init__(self, api_keys):
        if not api_keys: raise ValueError("❌ No Gemini API keys provided.")
        self.api_keys = api_keys
        self.current_key_index = 0
        genai.configure(api_key=self.api_keys[self.current_key_index])
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        print(f"🤖 GeminiService initialized with {len(self.api_keys)} API key(s).")

    def _rotate_key(self):
        self.current_key_index = (self.current_key_index + 1) % len(self.api_keys)
        new_key = self.api_keys[self.current_key_index]
        genai.configure(api_key=new_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        print(f"🔄 Rotated to Gemini API key index {self.current_key_index}")

    def generate_content(self, prompt: str):
        for _ in range(len(self.api_keys)):
            try:
                response = self.model.generate_content(prompt)
                return response.text.strip()
            except Exception as e:
                if "rate limit" in str(e).lower() or "429" in str(e):
                    print(f"🕒 Rate limit hit on key index {self.current_key_index}. Rotating key...")
                    self._rotate_key()
                else: raise e
        raise Exception("❌ All Gemini API keys are rate-limited or invalid.")

    def generate_resume_summary(self, resume_text: str) -> str:
        prompt = f"Based on the following resume text, create a compelling professional summary of 4-5 lines.\n\n**Resume Text:**\n---\n{resume_text}\n---"
        try:
            return self.generate_content(prompt)
        except Exception as e:
            print(f"❌ Error in generate_resume_summary: {e}")
            return "A passionate developer skilled in creating dynamic and user-friendly applications."

    def generate_project_description(self, project_name: str, project_context: str) -> str:
        prompt = f"""
        Act as an expert technical copywriter for a professional resume. Your task is to write a compelling, results-oriented description for the software project detailed below.
        **CRITICAL INSTRUCTIONS:**
        1.  **Length:** The description must be between 3 and 5 lines long.
        2.  **Content Focus:** Focus on the project's core functionality, the problem it solves, and the value it provides to an end-user. Describe WHAT the application is and what it DOES.
        3.  **Exclusion Criteria:**
            - **Crucially, DO NOT mention specific programming languages** (e.g., Python, JavaScript).
            - **DO NOT mention specific AI-as-a-service tools** or brand names (e.g., ChatGPT, Lobe.ai, Bolt). Instead, describe the functionality (e.g., "a custom machine learning model for image recognition," "a natural language processing feature").
            - Mention general technologies (like 'REST API', 'NoSQL database', 'machine learning model') only to support the description of what was built.
        **Project to Describe:**
        ---
        **Name**: "{project_name}"
        **Context**: "{project_context}"
        ---
        """
        try:
            return self.generate_content(prompt)
        except Exception as e:
            print(f"❌ Error in generate_project_description for '{project_name}': {e}")
            return f"A project named '{project_name}' that showcases practical application of technical skills."

    def generate_portfolio_data(self, profile, projects, experiences, education, summary, languages, topics):
        name = profile.get('name') or profile.get('login', 'Unknown')
        return {
            "template1": { "name": name, "home": { "title": f"Hi, I'm {name}", "subtitle": profile.get('bio') or "Software Developer", "description": summary, "image": f"https://github.com/{profile.get('login', 'user')}.png", "socialLinks": [ {"platform": "github", "url": profile.get('html_url', '')}, {"platform": "linkedin", "url": "https://www.linkedin.com/"}, ] }, "about": { "title": "About Me", "subtitle": "My introduction", "description": summary, "image": f"https://github.com/{profile.get('login', 'user')}.png", "info": [ {"title": f"{len(projects)}+", "name": "Projects<br>completed"}, {"title": f"{len(experiences)}+", "name": "Years<br>experience"}, {"title": "5+", "name": "Technologies<br>used"} ], "cvUrl": "#" }, "skills": self.generate_skills_for_template1(languages, topics), "qualification": self.generate_qualification_data(experiences, education), "portfolio": projects[:6], "contact": { "phone": "+1-234-567-8900", "email": profile.get('email', 'contact@example.com'), "location": profile.get('location', 'Location') }, "footer": { "name": name, "subtitle": profile.get('bio') or "Software Developer", "links": [ {"text": "About", "href": "#about"}, {"text": "Projects", "href": "#portfolio"}, {"text": "Contact", "href": "#contact"} ], "socialLinks": [ {"platform": "github", "url": profile.get('html_url', '')}, {"platform": "linkedin", "url": "https://linkedin.com/"} ], "copyright": f"&copy; {name}. All rights reserved" } },
            "template2": { "name": name, "header": {"logo": name.split()[0] if name else "Portfolio"}, "home": { "greeting": "Hi, I'm", "name": name, "role": profile.get('bio') or "Software Developer", "description": summary, "buttons": {"hire": "Hire Me", "talk": "Let's Talk"}, "socialLinks": [ {"platform": "github", "url": profile.get('html_url', '')}, {"platform": "linkedin", "url": "https://linkedin.com/"} ] }, "about": { "heading": "About <span>Me</span>", "title": "Hello! I'm a passionate developer.", "description": summary, "image": f"https://github.com/{profile.get('login', 'user')}.png", "buttonText": "Contact Me" }, "journey": self.generate_journey_data(experiences, education), "skills": self.generate_skills_for_template2(languages, topics), "footer": {"text": f"Copyright © {name}. All rights reserved."} },
            "template3": { "name": name, "logoName": name.split()[0] if name else "Portfolio", "tagline": profile.get('bio') or "Creative Developer & Designer", "heroDescription": summary, "heroCta": {"text": "View My Work", "link": "#projects"}, "about": { "title": "About Me", "image": f"https://github.com/{profile.get('login', 'user')}.png", "greeting": f"Hello! I'm {name}", "paragraphs": [summary] }, "skills": self.generate_skills_for_template3(languages, topics), "projects": projects, "contact": { "heading": "Let's work together!", "text": "I'm always excited to work on new projects.", "details": [ {"icon": "📧", "value": profile.get('email', 'contact@example.com')}, {"icon": "📍", "value": profile.get('location', 'Location')}, ] }, "social": [ {"url": profile.get('html_url', ''), "icon": "🐙"}, {"url": "https://linkedin.com", "icon": "💼"} ], "copyright": f"&copy; 2024 {name}. All rights reserved." }
        }

    def generate_skills_for_template1(self, languages, topics):
        skills = []
        
        # Programming Languages
        if languages:
            skills.append({
                "title": "Programming Languages",
                "subtitle": "Languages I work with",
                "icon": "uil-brackets-curly",
                "items": [{"name": lang, "level": 85} for lang in languages[:4]]
            })
            
        # Technologies & Frameworks (with a fallback)
        final_topics = [t.title() for t in topics] if topics else ["React", "Node.js", "Docker", "Firebase"]
        skills.append({
            "title": "Technologies & Frameworks",
            "subtitle": "Tools and libraries I use",
            "icon": "uil-server-network",
            "items": [{"name": topic, "level": 80} for topic in final_topics[:4]]
        })
            
        return skills

    def generate_skills_for_template2(self, languages, topics):
        skills = []
        if languages: skills.append({ "title": "Programming Languages", "skills": [{"name": lang, "level": 85} for lang in languages[:4]] })
        if topics: skills.append({ "title": "Technologies & Tools", "skills": [{"name": topic.title(), "level": 80} for topic in topics[:4]] })
        return skills

    def generate_skills_for_template3(self, languages, topics):
            """Generates skills in the format expected by portfolio3.html"""
            skills_data = []
            
            # Create a card for Programming Languages
            if languages:
                skills_data.append({
                    "icon": "💻",
                    "title": "Programming Languages",
                    "description": ", ".join(languages)
                })
            
            # Create a card for Technologies & Frameworks
            if topics:
                skills_data.append({
                    "icon": "🛠️",
                    "title": "Technologies & Frameworks",
                    "description": ", ".join([t.title() for t in topics])
                })
            
            # Add a fallback card if both lists are empty
            if not skills_data:
                skills_data.append({
                    "icon": "💡",
                    "title": "Core Competencies",
                    "description": "Full-Stack Development, Problem Solving, and System Design."
                })
                
            return skills_data

    def generate_qualification_data(self, experiences, education):
        return {
            "education": [{"title": e.get("degree", "Degree"), "subtitle": e.get("school", "Institution"), "date": e.get("date", "Year")} for e in education],
            "experience": [{"title": exp.get("jobTitle", "Position"), "subtitle": exp.get("company", "Company"), "date": exp.get("date", "Period")} for exp in experiences]
        }

    def generate_journey_data(self, experiences, education):
        return {
            "heading": "My <span>Journey</span>",
            "educationTitle": "Education",
            "education": [{"year": e.get("date", "Year"), "title": e.get("degree", "Degree"), "description": f"Studied at {e.get('school', 'Institution')}"} for e in education],
            "experienceTitle": "Experience",
            "experience": [{"year": exp.get("date", "Period"), "title": exp.get("jobTitle", "Position"), "description": f"Worked at {exp.get('company', 'Company')}"} for exp in experiences]
        }

    def extract_user_data(self, linkedin_text, github_data, pdf_parser: PDFParser):
        print("🤖 [4/5] Starting AI Content Generation & Data Compilation...")
        print("    > Generating resume summary...")
        generated_summary = self.generate_resume_summary(linkedin_text)
        print("    > ✅ Summary generated.")
        
        experiences, education = pdf_parser.extract_sections(linkedin_text)
        profile = github_data.get('profile', {})
        repos = github_data.get('repositories', [])
        
        generated_projects = []
        for i, repo in enumerate(repos):
            print(f"    > Generating description for project {i+1}/{len(repos)}: {repo.get('name')}")
            project_title = repo.get('name', 'Untitled').replace('-', ' ').title()
            topics_str = ", ".join(repo.get('topics', []))
            project_context = repo.get('readme') or f"Desc: {repo.get('description', 'N/A')}. Lang: {repo.get('language', 'N/A')}. Topics: {topics_str}"
            desc = self.generate_project_description(project_title, project_context[:2000])
            generated_projects.append({
                "title": project_title, "description": desc,
                "image": "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=400",
                "link": repo.get('html_url', '#'), "demo": repo.get('html_url', '#'), "github": repo.get('html_url', '#')
            })

            if i < len(repos) - 1:
                print(f"    > ⏳ Pausing for 1 second...")
                time.sleep(1)
        print("🤖 [4/5] ✅ All AI Content Generated.")

        # --- FIX for empty/duplicate Technologies section ---
        languages = [lang for lang in list(set(r.get('language') for r in repos if r.get('language'))) if lang != "Jupyter Notebook"]
        topics = list(set(topic for repo in repos for topic in repo.get('topics', [])))
        
        # Jupyter Notebook is a tool/technology, not a language
        if any(r.get('language') == "Jupyter Notebook" for r in repos):
            if "Jupyter Notebook" not in topics:
                topics.append("Jupyter Notebook")

        final_techs = [t.title() for t in topics][:10] if topics else ["Node.js", "React", "Machine-Learning", "Docker"]

        user_data = {
            "name": profile.get('name') or profile.get('login', 'Unknown'),
            "title": profile.get('bio') or "Software Developer",
            "summary": generated_summary,
            "contact": { "email": profile.get('email'), "location": profile.get('location'), "linkedin": "linkedin.com/in/your-profile", "github": profile.get('html_url', ''), "website": profile.get('blog', '') },
            "experience": experiences or [],
            "projects": generated_projects,
            "education": education or [],
            "skills": [
                {"category": "Programming Languages", "items": languages or ["JavaScript", "Python"]},
                {"category": "Technologies", "items": final_techs}
            ],
            "certifications": [],
            "portfolio_data": self.generate_portfolio_data(profile, generated_projects, experiences, education, generated_summary, languages, topics)
        }
        
        # --- PRINT FINAL OBJECT as requested ---
        print_json_data(user_data, "FINAL COMPILED USER DATA")
        return user_data

class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
        self.storage_dir = Config.GENERATED_FOLDER
    
    def _generate_file(self, user_data, template_id, file_type):
        try:
            template_path = os.path.join(self.templates_dir, f"{file_type}{template_id}.html")
            with open(template_path, 'r', encoding='utf-8') as f:
                template_html = f.read()
            
            if file_type == 'resume':
                data_to_inject = user_data
                render_func = 'renderResume'
            else:
                portfolio_data = user_data.get('portfolio_data', {})
                template_key = f"template{template_id}"
                data_to_inject = portfolio_data.get(template_key, user_data)
                render_func = 'renderPortfolio'
            
            script_injection = f"<script>window.onload = () => {{ if(typeof {render_func} === 'function') {render_func}({json.dumps(data_to_inject)}); }};</script>"
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
gemini_service = GeminiService(api_keys=Config.GEMINI_API_KEYS)
template_service = TemplateService()

@app.route('/api/generate', methods=['POST'])
def generate_portfolio_resume():
    try:
        if 'linkedin_pdf' not in request.files or not request.form.get('github_url'):
            return jsonify({'error': 'Missing required fields'}), 400
        pdf_file = request.files['linkedin_pdf']
        github_url = request.form.get('github_url')
        portfolio_template = int(request.form.get('portfolio_template', 1))
        resume_template = int(request.form.get('resume_template', 1))

        print("\n🚀🚀🚀 STARTING NEW GENERATION 🚀🚀🚀")
        
        linkedin_text = pdf_parser.extract_text_from_pdf(pdf_file)
        github_data = github_service.get_user_data(github_url)
        
        user_data = gemini_service.extract_user_data(linkedin_text, github_data, pdf_parser)
        
        print("📝 [5/5] Starting File Generation...")
        resume_filename = template_service.generate_resume(user_data, resume_template)
        portfolio_filename = template_service.generate_portfolio(user_data, portfolio_template)
        print("📝 [5/5] ✅ File Generation Successful.")

        print("\n🎉🎉🎉 GENERATION COMPLETE 🎉🎉🎉\n")
        return jsonify({
            'success': True,
            'resume_url': f'/api/download/resume/{resume_filename}',
            'portfolio_url': f'/api/download/portfolio/{portfolio_filename}',
            'preview_resume_url': f'/api/preview/resume/{resume_filename}',
            'preview_portfolio_url': f'/api/preview/portfolio/{portfolio_filename}'
        })
    except Exception as e:
        print(f"\n🔥🔥🔥 GENERATION FAILED: {e} 🔥🔥🔥\n")
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
    print("🚀 Starting Portfolio Generator Backend...")
    app.run(debug=True, port=5000)