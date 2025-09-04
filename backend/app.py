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

# --- Helper Function for JSON Printing ---
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
        try:
            # Reset file pointer to beginning
            pdf_file.seek(0)
            
            pdf_reader = PyPDF2.PdfReader(BytesIO(pdf_file.read()))
            text = ""
            
            print("=" * 50)
            print("🔍 PDF EXTRACTION STARTED")
            print("=" * 50)
            print(f"📄 File: {getattr(pdf_file, 'filename', 'Unknown')}")
            print(f"📑 Pages: {len(pdf_reader.pages)}")
            print(f"🔒 Encrypted: {pdf_reader.is_encrypted}")
            
            if pdf_reader.is_encrypted:
                print("⚠️ PDF is encrypted, attempting to decrypt...")
                pdf_reader.decrypt("")
            
            for page_num, page in enumerate(pdf_reader.pages):
                try:
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text += page_text + "\n"
                    else:
                        print(f"📄 Page {page_num + 1}: No text found or empty")
                except Exception as page_error:
                    print(f"❌ Error extracting page {page_num + 1}: {page_error}")
            
            print("\n" + "=" * 50)
            print("📝 COMPLETE EXTRACTED TEXT:")
            print("=" * 50)
            if text.strip():
                print(text)
            else:
                print("⚠️ No text was extracted from the PDF!")
            print("=" * 50)
            print("✅ PDF EXTRACTION COMPLETED")
            print("=" * 50)
            
            return text
        except Exception as e:
            print(f"❌ CRITICAL ERROR in PDF extraction: {e}")
            import traceback
            traceback.print_exc()
            raise Exception(f"Failed to parse PDF: {e}")

    def extract_sections(self, text):
        print("🔄 Starting section extraction...")
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
        
        # Print extracted sections
        sections_data = {"experiences": experiences, "education": education}
        print_json_data(sections_data, "EXTRACTED SECTIONS")
        
        return experiences, education

class GitHubService:
    def __init__(self):
        self.base_url = "https://api.github.com"
        # Set up authentication headers with GitHub token
        self.headers = {
            "Authorization": f"Bearer {Config.GITHUB_TOKEN}",
            "Accept": "application/vnd.github.v3+json"
        } if Config.GITHUB_TOKEN else {}

    def extract_username_from_url(self, github_url):
        match = re.search(r'github\.com/([^/]+)', github_url)
        if match:
            return match.group(1)
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
            print(f"🐙 Fetching GitHub data for: {username}")
            
            user_response = requests.get(f"{self.base_url}/users/{username}", headers=self.headers)
            user_response.raise_for_status()
            user_data = user_response.json()
            
            print(f"👤 User: {user_data.get('name', 'N/A')} (@{user_data.get('login')})")
            print(f"📍 Location: {user_data.get('location', 'N/A')}")
            print(f"📧 Email: {user_data.get('email', 'N/A')}")

            repos_response = requests.get(f"{self.base_url}/users/{username}/repos?sort=updated&per_page=10", headers=self.headers)
            repos_response.raise_for_status()
            repos_data = repos_response.json()
            
            print(f"📦 Found {len(repos_data)} repositories")

            result = {
                'profile': user_data,
                'repositories': self._process_repositories(repos_data, user_data)
            }
            
            # Print GitHub data structure
            github_summary = {
                "profile_keys": list(user_data.keys()),
                "repos_count": len(repos_data),
                "processed_repos_count": len(result['repositories'])
            }
            print_json_data(github_summary, "GITHUB API INFO")
            print_json_data(result, "GITHUB DATA")

            return result
        except Exception as e:
            print(f"❌ Error fetching GitHub data: {e}")
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
    def __init__(self, api_keys):
        if not api_keys or len(api_keys) == 0:
            print("❌ No Gemini API keys provided")
            self.api_keys = []
            self.models = []
            return
            
        self.original_keys = api_keys.copy()
        self.active_keys = api_keys.copy()
        self.cooldown_keys = {}
        self.current_index = 0
        self.models = {}
        
        print(f"🔑 Initializing GeminiService with {len(api_keys)} API keys...")
        
        # Initialize models for each key
        for i, key in enumerate(api_keys):
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                self.models[key] = model
                print(f"✅ Initialized model for key {i+1}")
            except Exception as e:
                print(f"❌ Error initializing model for key {i+1}: {e}")
                self.models[key] = None

    def _restore_cooled_keys(self):
        """Move keys from cooldown back to active if cooldown period expired"""
        current_time = time.time()
        keys_to_restore = []
        
        for key, cooldown_time in self.cooldown_keys.items():
            if current_time - cooldown_time > 3600:  # 1 hour cooldown
                keys_to_restore.append(key)
        
        for key in keys_to_restore:
            self.cooldown_keys.pop(key)
            if key not in self.active_keys:
                self.active_keys.append(key)
                print(f"🔄 Restored key from cooldown")

    def _get_next_key(self):
        """Get next available API key using round-robin"""
        self._restore_cooled_keys()
        
        if not self.active_keys:
            raise Exception("❌ No active API keys available. All keys in cooldown.")
        
        key = self.active_keys[self.current_index]
        self.current_index = (self.current_index + 1) % len(self.active_keys)
        return key

    def _handle_api_error(self, key, error):
        """Move key to cooldown if rate limited"""
        error_str = str(error).lower()
        if "429" in error_str or "quota" in error_str or "rate limit" in error_str:
            if key in self.active_keys:
                self.active_keys.remove(key)
                self.cooldown_keys[key] = time.time()
                print(f"🕒 API key moved to cooldown due to rate limit")
            return True
        return False

    def generate_with_retry(self, prompt):
        """Generate content with automatic key rotation and retry"""
        if not self.active_keys and not self.cooldown_keys:
            return "Error: No Gemini API keys configured."
        
        max_attempts = len(self.original_keys)
        attempt = 0
        last_error = None
        
        while attempt < max_attempts:
            try:
                key = self._get_next_key()
                model = self.models.get(key)
                
                if not model:
                    attempt += 1
                    continue
                
                response = model.generate_content(prompt)
                return response.text.strip()
                
            except Exception as e:
                last_error = e
                if not self._handle_api_error(key, e):
                    # If not a rate limit error, re-raise
                    raise e
                attempt += 1
                print(f"🔄 Retrying with next key... (attempt {attempt}/{max_attempts})")
        
        print(f"❌ All API keys exhausted after {max_attempts} attempts")
        return f"Error: All API keys exhausted. Last error: {str(last_error)}"

    def generate_resume_summary(self, resume_text: str) -> str:
        prompt = f"Based on the following resume text, create a compelling and concise professional summary of 4-5 lines. Focus on key skills, experience, and career aspirations.\n\n**Resume Text:**\n---\n{resume_text}\n---"
        try:
            print("🤖 Generating resume summary with Gemini...")
            summary = self.generate_with_retry(prompt)
            if not summary.startswith("Error:"):
                print(f"✅ Generated summary: {summary}")
                return summary
            else:
                print(f"❌ Error calling Gemini API for summary: {summary}")
                return "Passionate and skilled professional seeking to leverage expertise in software development and project management."
        except Exception as e:
            print(f"❌ Error calling Gemini API for summary: {e}")
            return "Passionate and skilled professional seeking to leverage expertise in software development and project management."
    
    def generate_project_description(self, project_name: str, existing_info: str) -> str:
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
            print(f"🔧 Generating description for project: {project_name}")
            description = self.generate_with_retry(prompt)
            if not description.startswith("Error:"):
                description = description.replace("**", "")
                print(f"✅ Generated project description: {description[:100]}...")
                return description
            else:
                print(f"❌ Error generating description for project {project_name}: {description}")
                return f"A project named '{project_name}' that showcases practical application of technical skills."
        except Exception as e:
            print(f"❌ Error generating description for project {project_name}: {e}")
            return f"A project named '{project_name}' that showcases practical application of technical skills."

    def extract_user_data(self, linkedin_text, github_data, pdf_parser: PDFParser):
        print("🔄 Starting user data extraction...")
        
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
            generated_projects.append({
                "title": project_title, 
                "description": generated_desc,
                "image": "https://images.pexels.com/photos/196644/pexels-photo-196644.jpeg?auto=compress&cs=tinysrgb&w=400",
                "link": repo.get('html_url', '#'),
                "demo": repo.get('html_url', '#'),
                "github": repo.get('html_url', '#')
            })

        # Get skills from repos
        languages = list(set([r['language'] for r in repos if r['language']]))
        topics = []
        for repo in repos:
            topics.extend(repo.get('topics', []))
        topics = list(set(topics))

        user_data = {
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
                {"category": "Programming Languages", "items": languages or ["Python", "JavaScript"]},
                {"category": "Technologies", "items": topics[:10] if topics else ["React", "Node.js", "Docker", "AWS"]}
            ],
            "certifications": [],
            
            # Portfolio-specific data structures
            "portfolio_data": self.generate_portfolio_data(profile, generated_projects, experiences, education, generated_summary, languages, topics)
        }
        
        print_json_data(user_data, "FINAL USER DATA")
        
        return user_data

    def generate_portfolio_data(self, profile, projects, experiences, education, summary, languages, topics):
        """Generate portfolio-specific data structure for different templates"""
        
        name = profile.get('name') or profile.get('login', 'Unknown')
        
        # Common portfolio data structure
        portfolio_data = {
            # Template 1 structure
            "template1": {
                "name": name,
                "home": {
                    "title": f"Hi, I'm {name}",
                    "subtitle": profile.get('bio') or "Software Developer",
                    "description": summary,
                    "image": f"https://github.com/{profile.get('login', 'user')}.png",
                    "socialLinks": [
                        {"platform": "github", "url": profile.get('html_url', '')},
                        {"platform": "linkedin", "url": "https://www.linkedin.com/"},
                    ]
                },
                "about": {
                    "title": "About Me",
                    "subtitle": "My introduction",
                    "description": summary,
                    "image": f"https://github.com/{profile.get('login', 'user')}.png",
                    "info": [
                        {"title": f"{len(projects)}+", "name": "Projects<br>completed"},
                        {"title": f"{len(experiences)}+", "name": "Years<br>experience"},
                        {"title": "5+", "name": "Technologies<br>used"}
                    ],
                    "cvUrl": "#"
                },
                "skills": self.generate_skills_for_template1(languages, topics),
                "qualification": self.generate_qualification_data(experiences, education),
                "services": [
                    {
                        "title": "Web<br>Development",
                        "icon": "uil-web-grid",
                        "features": [
                            "I develop responsive web applications.",
                            "Modern frontend and backend solutions.",
                            "API integration and development.",
                            "Database design and optimization."
                        ]
                    },
                    {
                        "title": "Software<br>Development",
                        "icon": "uil-arrow",
                        "features": [
                            "Full-stack application development.",
                            "Code optimization and refactoring.",
                            "Testing and debugging.",
                            "Version control and collaboration."
                        ]
                    }
                ],
                "portfolio": projects[:6],  # Limit to 6 projects
                "callToAction": {
                    "title": "Have a project in mind?",
                    "description": "Let's work together to bring your ideas to life.",
                    "image": "https://images.pexels.com/photos/574071/pexels-photo-574071.jpeg?auto=compress&cs=tinysrgb&w=300"
                },
                "contact": {
                    "phone": "+1-234-567-8900",
                    "email": profile.get('email', 'contact@example.com'),
                    "location": profile.get('location', 'Location')
                },
                "footer": {
                    "name": name,
                    "subtitle": profile.get('bio') or "Software Developer",
                    "links": [
                        {"text": "About", "href": "#about"},
                        {"text": "Projects", "href": "#portfolio"},
                        {"text": "Contact", "href": "#contact"}
                    ],
                    "socialLinks": [
                        {"platform": "github", "url": profile.get('html_url', '')},
                        {"platform": "linkedin", "url": "https://linkedin.com/"}
                    ],
                    "copyright": f"&copy; {name}. All rights reserved"
                }
            },
            
            # Template 2 structure
            "template2": {
                "name": name,
                "header": {"logo": name.split()[0] if name else "Portfolio"},
                "home": {
                    "greeting": "Hi, I'm",
                    "name": name,
                    "role": profile.get('bio') or "Software Developer",
                    "description": summary,
                    "buttons": {"hire": "Hire Me", "talk": "Let's Talk"},
                    "socialLinks": [
                        {"platform": "github", "url": profile.get('html_url', '')},
                        {"platform": "linkedin", "url": "https://linkedin.com/"}
                    ]
                },
                "about": {
                    "heading": "About <span>Me</span>",
                    "title": "Hello! I'm a passionate developer.",
                    "description": summary,
                    "image": f"https://github.com/{profile.get('login', 'user')}.png",
                    "buttonText": "Contact Me"
                },
                "journey": self.generate_journey_data(experiences, education),
                "skills": self.generate_skills_for_template2(languages, topics),
                "footer": {"text": f"Copyright © {name}. All rights reserved."}
            },
            
            # Template 3 structure
            "template3": {
                "name": name,
                "logoName": name.split()[0] if name else "Portfolio",
                "tagline": profile.get('bio') or "Creative Developer & Designer",
                "heroDescription": summary,
                "heroCta": {"text": "View My Work", "link": "#projects"},
                "about": {
                    "title": "About Me",
                    "image": f"https://github.com/{profile.get('login', 'user')}.png",
                    "greeting": f"Hello! I'm {name}",
                    "paragraphs": [summary]
                },
                "skills": self.generate_skills_for_template3(languages, topics),
                "projects": projects,
                "contact": {
                    "heading": "Let's work together!",
                    "text": "I'm always excited to work on new projects and collaborate with amazing people.",
                    "details": [
                        {"icon": "📧", "value": profile.get('email', 'contact@example.com')},
                        {"icon": "📱", "value": "+1 (555) 123-4567"},
                        {"icon": "📍", "value": profile.get('location', 'Location')},
                        {"icon": "🌐", "value": profile.get('blog', 'website.com')}
                    ]
                },
                "social": [
                    {"url": profile.get('html_url', ''), "icon": "🐙"},
                    {"url": "https://linkedin.com", "icon": "💼"}
                ],
                "copyright": f"&copy; 2024 {name}. All rights reserved."
            }
        }
        
        return portfolio_data

    def generate_skills_for_template1(self, languages, topics):
        """Generate skills in template 1 format"""
        skills = []
        
        if languages:
            skills.append({
                "title": "Programming Languages",
                "subtitle": "Core technologies",
                "icon": "uil-brackets-curly",
                "items": [{"name": lang, "level": 85} for lang in languages[:4]]
            })
        
        if topics:
            skills.append({
                "title": "Technologies & Frameworks",
                "subtitle": "Tools and libraries",
                "icon": "uil-server-network",
                "items": [{"name": topic.title(), "level": 80} for topic in topics[:4]]
            })
        
        return skills

    def generate_skills_for_template2(self, languages, topics):
        """Generate skills in template 2 format"""
        skills = []
        
        if languages:
            skills.append({
                "title": "Programming Languages",
                "skills": [{"name": lang, "level": 85} for lang in languages[:4]]
            })
        
        if topics:
            skills.append({
                "title": "Technologies & Tools",
                "skills": [{"name": topic.title(), "level": 80} for topic in topics[:4]]
            })
        
        return skills

    def generate_skills_for_template3(self, languages, topics):
        """Generate skills in template 3 format"""
        skills = []
        
        combined_skills = languages + topics
        skill_chunks = [combined_skills[i:i+3] for i in range(0, min(len(combined_skills), 6), 3)]
        
        for i, chunk in enumerate(skill_chunks):
            skills.append({
                "title": f"Skill Category {i+1}",
                "skills": [{"name": skill, "level": 85} for skill in chunk]
            })
        
        return skills

    def generate_qualification_data(self, experiences, education):
        """Generate qualification data for template 1"""
        qual_data = {}
        
        if education:
            qual_data["education"] = []
            for edu in education:
                qual_data["education"].append({
                    "title": edu.get("degree", "Degree"),
                    "subtitle": edu.get("school", "Institution"),
                    "date": edu.get("date", "Year")
                })
        
        if experiences:
            qual_data["experience"] = []
            for exp in experiences:
                qual_data["experience"].append({
                    "title": exp.get("jobTitle", "Position"),
                    "subtitle": exp.get("company", "Company"),
                    "date": exp.get("date", "Period")
                })
        
        return qual_data

    def generate_journey_data(self, experiences, education):
        """Generate journey data for template 2"""
        journey = {"heading": "My <span>Journey</span>"}
        
        if education:
            journey["educationTitle"] = "Education"
            journey["education"] = []
            for edu in education:
                journey["education"].append({
                    "year": edu.get("date", "Year"),
                    "title": edu.get("degree", "Degree"),
                    "description": f"Studied at {edu.get('school', 'Institution')}"
                })
        
        if experiences:
            journey["experienceTitle"] = "Experience"
            journey["experience"] = []
            for exp in experiences:
                journey["experience"].append({
                    "year": exp.get("date", "Period"),
                    "title": exp.get("jobTitle", "Position"),
                    "description": f"Worked at {exp.get('company', 'Company')}"
                })
        
        return journey

class TemplateService:
    def __init__(self):
        self.templates_dir = "templates"
        self.storage_dir = Config.GENERATED_FOLDER

    def _generate_file(self, user_data, template_id, file_type):
        try:
            print(f"📝 Generating {file_type} with template {template_id}")
            
            template_path = os.path.join(self.templates_dir, f"{file_type}{template_id}.html")
            with open(template_path, 'r', encoding='utf-8') as f:
                template_html = f.read()
            
            # Determine which data to use based on file type
            if file_type == 'resume':
                data_to_inject = user_data
                render_func = 'renderResume'
            else:  # portfolio
                # Use the appropriate template data structure
                portfolio_data = user_data.get('portfolio_data', {})
                template_key = f"template{template_id}"
                data_to_inject = portfolio_data.get(template_key, user_data)  # Fallback to user_data if template-specific data not found
                render_func = 'renderPortfolio'
            
            script_injection = f"<script>window.onload = () => {{ if(typeof {render_func} === 'function') {render_func}({json.dumps(data_to_inject)}); }};</script>"
            populated_html = template_html.replace('</body>', f'{script_injection}</body>')
            
            filename = f"{file_type}_{uuid.uuid4().hex[:8]}.html"
            output_path = os.path.join(self.storage_dir, filename)
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(populated_html)
            
            print(f"✅ Generated {file_type}: {filename}")
            return filename
        except Exception as e:
            print(f"❌ Error generating {file_type}: {e}")
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

# === TEMPLATE PREVIEW ROUTES ===
@app.route('/api/templates/portfolio/<int:template_id>')
def serve_portfolio_template(template_id):
    """Serve portfolio template for preview"""
    try:
        template_filename = f'portfolio{template_id}.html'
        template_path = os.path.join('templates', template_filename)
        
        print(f"📁 Looking for portfolio template at: {template_path}")
        
        if os.path.exists(template_path):
            print(f"✅ Found portfolio template {template_id}, serving file...")
            return send_from_directory('templates', template_filename)
        else:
            print(f"❌ Portfolio template {template_id} not found at {template_path}")
            return jsonify({'error': f'Portfolio template {template_id} not found'}), 404
    except Exception as e:
        print(f"❌ Error serving portfolio template {template_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/templates/resume/<int:template_id>')
def serve_resume_template(template_id):
    """Serve resume template for preview"""
    try:
        template_filename = f'resume{template_id}.html'
        template_path = os.path.join('templates', template_filename)
        
        print(f"📁 Looking for resume template at: {template_path}")
        
        if os.path.exists(template_path):
            print(f"✅ Found resume template {template_id}, serving file...")
            return send_from_directory('templates', template_filename)
        else:
            print(f"❌ Resume template {template_id} not found at {template_path}")
            return jsonify({'error': f'Resume template {template_id} not found'}), 404
    except Exception as e:
        print(f"❌ Error serving resume template {template_id}: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/templates/<filename>')
def serve_template_files(filename):
    """Serve template files directly (alternative route)"""
    try:
        template_path = os.path.join('templates', filename)
        print(f"📁 Direct template access requested: {template_path}")
        
        if os.path.exists(template_path):
            return send_from_directory('templates', filename)
        else:
            print(f"❌ Template file {filename} not found at {template_path}")
            return jsonify({'error': f'Template file {filename} not found'}), 404
    except Exception as e:
        print(f"❌ Error serving template file {filename}: {e}")
        return jsonify({'error': str(e)}), 500

# === MAIN GENERATION ROUTE ===
@app.route('/api/generate', methods=['POST'])
def generate_portfolio_resume():
    try:
        print("🚀 Starting portfolio/resume generation...")
        
        if 'linkedin_pdf' not in request.files or not request.form.get('github_url'):
            return jsonify({'error': 'Missing required form fields (linkedin_pdf, github_url)'}), 400
        
        pdf_file = request.files['linkedin_pdf']
        github_url = request.form.get('github_url')
        portfolio_template = int(request.form.get('portfolio_template', 1))
        resume_template = int(request.form.get('resume_template', 1))

        # Print request data
        request_data = {
            "github_url": github_url,
            "portfolio_template": portfolio_template,
            "resume_template": resume_template,
            "pdf_filename": pdf_file.filename if pdf_file else None,
            "pdf_size": len(pdf_file.read()) if pdf_file else None
        }
        pdf_file.seek(0)  # Reset file pointer after reading size
        print_json_data(request_data, "REQUEST DATA")

        linkedin_text = pdf_parser.extract_text_from_pdf(pdf_file)
        github_data = github_service.get_user_data(github_url)
        user_data = gemini_service.extract_user_data(linkedin_text, github_data, pdf_parser)

        resume_filename = template_service.generate_resume(user_data, resume_template)
        portfolio_filename = template_service.generate_portfolio(user_data, portfolio_template)

        response_data = {
            'success': True,
            'resume_url': f'/api/download/resume/{resume_filename}',
            'portfolio_url': f'/api/download/portfolio/{portfolio_filename}',
            'preview_resume_url': f'/api/preview/resume/{resume_filename}',
            'preview_portfolio_url': f'/api/preview/portfolio/{portfolio_filename}'
        }
        
        # Print response data
        print_json_data(response_data, "RESPONSE DATA")
        
        return jsonify(response_data)
    except Exception as e:
        error_data = {"error": str(e), "type": type(e).__name__}
        print_json_data(error_data, "ERROR DATA")
        print(f"❌ Error in /api/generate: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/download/<file_type>/<filename>')
def download_file(file_type, filename):
    print(f"📥 Download request: {file_type}/{filename}")
    return send_from_directory(Config.GENERATED_FOLDER, filename, as_attachment=True)

@app.route('/api/preview/<file_type>/<filename>')
def preview_file(file_type, filename):
    print(f"👁️ Preview request: {file_type}/{filename}")
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
    
    print("=" * 60)
    print("🚀 Starting Portfolio Generator Backend...")
    print("=" * 60)
    print("📊 Debug Mode: ENABLED")
    print("🔍 JSON Data Logging: ENABLED")
    print("📄 PDF Text Extraction: ENABLED")
    print("🤖 Gemini AI Integration: ENABLED")
    print(f"🔑 GitHub Token: {'✅ SET' if Config.GITHUB_TOKEN else '❌ NOT SET'}")
    print(f"🔑 Gemini API Keys: {'✅ ' + str(len(Config.GEMINI_API_KEYS)) + ' KEYS' if Config.GEMINI_API_KEYS else '❌ NOT SET'}")
    print("=" * 60)
    print("📡 Available Routes:")
    print("  - POST /api/generate")
    print("  - GET /api/templates/portfolio/<id>")
    print("  - GET /api/templates/resume/<id>") 
    print("  - GET /templates/<filename>")
    print("  - GET /api/health")
    print("=" * 60)
    
    app.run(debug=True, port=5000)