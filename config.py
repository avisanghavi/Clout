# config.py
import os
from dotenv import load_dotenv

# Get the absolute path of the directory containing this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load the .env file if it exists locally
env_path = os.path.join(BASE_DIR, '.env')
if os.path.exists(env_path):
    load_dotenv(dotenv_path=env_path)

# Application directories - adjust for production
if os.environ.get('RENDER') or os.environ.get('PRODUCTION'):
    # In production environments like Render, use temporary directories
    DATA_DIR = '/tmp/data'
    UPLOAD_FOLDER = '/tmp/uploads'
else:
    # Local development paths
    DATA_DIR = os.path.join(BASE_DIR, 'data')
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Secret key for Flask sessions
SECRET_KEY = os.environ.get('SECRET_KEY', 'default-dev-key-change-in-production')

# API keys and credentials
OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY', '')

# LinkedIn credentials
LINKEDIN_EMAIL = os.environ.get('LINKEDIN_EMAIL', '')
LINKEDIN_PASSWORD = os.environ.get('LINKEDIN_PASSWORD', '')

# Model settings
GPT_MODEL = os.environ.get('GPT_MODEL', 'gpt-4')
TEMPERATURE = float(os.environ.get('TEMPERATURE', '0.7'))

# App settings
DEFAULT_SEARCH_DELAY = int(os.environ.get('DEFAULT_SEARCH_DELAY', '5'))
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# File handling
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt', 'csv'}
