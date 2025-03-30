# utils.py
import os
from flask import current_app

def allowed_file(filename):
    """Check if the file has an allowed extension"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in current_app.config['ALLOWED_EXTENSIONS']

def extract_text_from_file(filepath):
    """Extract text from uploaded files (product description)"""
    file_ext = filepath.split('.')[-1].lower()
    
    try:
        if file_ext == 'pdf':
            # For PDF files
            from pdfminer.high_level import extract_text
            return extract_text(filepath)
            
        elif file_ext in ['docx', 'doc']:
            # For Word documents
            import docx
            doc = docx.Document(filepath)
            return '\n'.join([paragraph.text for paragraph in doc.paragraphs])
            
        elif file_ext == 'txt':
            # For text files
            with open(filepath, 'r', encoding='utf-8') as f:
                return f.read()
                
        else:
            return "Unsupported file format. Please upload a PDF, DOCX, DOC, or TXT file."
            
    except Exception as e:
        print(f"Error extracting text: {e}")
        return ""

def ensure_data_dir():
    """Ensure data directory exists"""
    os.makedirs(current_app.config['DATA_DIR'], exist_ok=True)
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)