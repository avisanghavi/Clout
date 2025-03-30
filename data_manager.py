# data_manager.py
import os
import json
import pandas as pd
from flask import current_app
from datetime import datetime

def ensure_directories():
    """Ensure all required directories exist"""
    os.makedirs(current_app.config['DATA_DIR'], exist_ok=True)
    os.makedirs(current_app.config['UPLOAD_FOLDER'], exist_ok=True)

def save_trusted_network(network_list):
    """Save the user's trusted network to a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'trusted_network.json')
    with open(filepath, 'w') as f:
        json.dump(network_list, f)

def load_trusted_network():
    """Load the user's trusted network from a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'trusted_network.json')
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return []

def save_icp_and_personas(icp_data):
    """Save ICP and Personas to a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'icp_and_personas.json')
    with open(filepath, 'w') as f:
        json.dump(icp_data, f)

def load_icp_and_personas():
    """Load ICP and Personas from a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'icp_and_personas.json')
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return {
            'icp': {
                'industry': 'Technology',
                'company_size': '50-1000 employees',
                'geography': 'North America',
                'other_criteria': ['B2B focused', 'Growth stage']
            },
            'buyer_persona': {
                'title': 'VP of Sales',
                'role': 'Decision maker',
                'pain_points': ['Low conversion rates', 'Inefficient sales process'],
                'search_terms': 'VP Sales OR Head of Sales OR Sales Director'
            },
            'user_persona': {
                'title': 'Sales Representative',
                'role': 'End user',
                'pain_points': ['Cold outreach difficulties', 'Low response rates'],
                'search_terms': 'Sales Representative OR Account Executive OR BDR'
            }
        }

def save_profile_data(profiles, filename='profiles.json'):
    """Save profiles to a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], filename)
    with open(filepath, 'w') as f:
        json.dump(profiles, f)

def load_profile_data(filename='profiles.json'):
    """Load profiles from a JSON file"""
    filepath = os.path.join(current_app.config['DATA_DIR'], filename)
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return []

def save_csill(csill_data):
    """Save the Connection-Sorted Intelligent Lead List"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'csill.json')
    with open(filepath, 'w') as f:
        json.dump(csill_data, f)

def load_csill():
    """Load the Connection-Sorted Intelligent Lead List"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'csill.json')
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except:
        return []

def save_message(profile_id, message, status='approve'):
    """Save an approved/edited message"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'messages.json')
    
    try:
        with open(filepath, 'r') as f:
            messages = json.load(f)
    except:
        messages = []
    
    # Create new message entry
    message_entry = {
        'profile_id': profile_id,
        'message': message,
        'status': status,
        'timestamp': datetime.now().isoformat()
    }
    
    messages.append(message_entry)
    
    # Write back to file
    with open(filepath, 'w') as f:
        json.dump(messages, f)
    
    return message_entry

def load_messages():
    """Load all saved messages"""
    filepath = os.path.join(current_app.config['DATA_DIR'], 'messages.json')
    try:
        with open(filepath, 'r') as f:
            messages = json.load(f)
        
        # Try to add profile info to messages
        csill = load_csill()
        for message in messages:
            profile_id = message.get('profile_id')
            if isinstance(profile_id, int) and profile_id < len(csill):
                message['profile'] = csill[profile_id]
            else:
                message['profile'] = {'name': 'Unknown', 'headline': '', 'location': ''}
        
        return messages
    except:
        return []

def import_trusted_network_from_csv(csv_path):
    """Import Trusted Network List from a CSV file"""
    try:
        df = pd.read_csv(csv_path)
        
        # Check for required columns
        if 'name' not in df.columns:
            raise ValueError("CSV must contain a 'name' column")
        
        # Convert to list of dicts
        tnl = []
        for _, row in df.iterrows():
            entry = {
                'name': row['name'],
                'trust_score': int(row['trust_score']) if 'trust_score' in row and not pd.isna(row['trust_score']) else 5,
                'notes': row['notes'] if 'notes' in row and not pd.isna(row['notes']) else ''
            }
            tnl.append(entry)
        
        # Save the imported TNL
        save_trusted_network(tnl)
        
        return tnl, None  # Return TNL and no error
    except Exception as e:
        return [], str(e)  # Return empty TNL and error message