# config.py
import os
from dotenv import load_dotenv

# Get the absolute path of the directory containing this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Specify the exact path to your .env file
env_path = os.path.join(BASE_DIR, '.env')

# Load the .env file with explicit path
load_dotenv(dotenv_path=env_path)

# Print debug info
print(f"Loading .env from: {env_path}")
print(f"LinkedIn Email from env: {os.getenv('LINKEDIN_EMAIL', 'Not found')}")

# Application directories
DATA_DIR = os.path.join(BASE_DIR, 'data')
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')

# Ensure directories exist
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# API keys and credentials
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', 'your-openai-api-key-here')

# LinkedIn credentials - try environment variables first, then fallbacks
LINKEDIN_EMAIL = os.getenv('LINKEDIN_EMAIL')
LINKEDIN_PASSWORD = os.getenv('LINKEDIN_PASSWORD')

# More debug info for LinkedIn credentials
print(f"LinkedIn Email in config: {LINKEDIN_EMAIL}")
print(f"LinkedIn Password in config: {'*' * len(LINKEDIN_PASSWORD) if LINKEDIN_PASSWORD else 'Not set'}")

# Model settings
GPT_MODEL = os.getenv('GPT_MODEL', 'gpt-4')
TEMPERATURE = float(os.getenv('TEMPERATURE', '0.7'))

# LinkedIn API settings (for future implementation)
LINKEDIN_CLIENT_ID = os.getenv('LINKEDIN_CLIENT_ID', '')
LINKEDIN_CLIENT_SECRET = os.getenv('LINKEDIN_CLIENT_SECRET', '')

# App settings
DEFAULT_SEARCH_DELAY = int(os.getenv('DEFAULT_SEARCH_DELAY', '5'))
DEBUG = os.getenv('DEBUG', 'False').lower() == 'true'

# File handling
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'doc', 'txt', 'csv'}