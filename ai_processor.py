# ai_processor.py
import json
import os
import httpx
from openai import OpenAI
from random import randint, sample, choice
from flask import current_app


def configure_openai():
    """Initialize OpenAI client"""
    # Try multiple ways to get the API key
    api_key = None
    
    # 1. Try getting from app config
    try:
        api_key = current_app.config.get('OPENAI_API_KEY')
    except:
        pass
    
    # 2. If not found, try getting from environment directly
    if not api_key or api_key == 'your-openai-api-key-here':
        api_key = os.environ.get('OPENAI_API_KEY')
    
    # 3. If still not found, check for a .env file in the current directory
    if not api_key:
        try:
            from dotenv import load_dotenv
            # Try loading from .env file in current directory
            load_dotenv()
            api_key = os.environ.get('OPENAI_API_KEY')
        except:
            pass
    
    # Print debug info
    if not api_key or api_key == 'your-openai-api-key-here':
        print("WARNING: No valid OpenAI API key found! Using fallback methods.")
        
    # Create a custom HTTP client without proxies
    http_client = httpx.Client()
    
    # Create the OpenAI client with the custom HTTP client
    return OpenAI(
        api_key=api_key,
        http_client=http_client
    )

def generate_icp_and_personas(product_description):
    """Generate Ideal Customer Profile and Buyer/User Personas using AI"""
    # Use the configure_openai function to create the client
    client = configure_openai()
    
    prompt = f"""
    Based on this product description, generate an Ideal Customer Profile (ICP) and Buyer/User Personas:
    
    PRODUCT DESCRIPTION:
    {product_description}
    
    Please format your response as a JSON with the following structure:
    {{
        "icp": {{
            "industry": "Industry name",
            "company_size": "Company size range",
            "geography": "Geographic focus",
            "other_criteria": ["Criterion 1", "Criterion 2"]
        }},
        "buyer_persona": {{
            "title": "Typical title",
            "role": "Role in organization",
            "pain_points": ["Pain point 1", "Pain point 2"],
            "search_terms": "Search terms to find this persona on LinkedIn"
        }},
        "user_persona": {{
            "title": "Typical title",
            "role": "Role in organization",
            "pain_points": ["Pain point 1", "Pain point 2"],
            "search_terms": "Search terms to find this persona on LinkedIn"
        }}
    }}
    """
    
    try:
        response = client.chat.completions.create(
            model=current_app.config['GPT_MODEL'],
            messages=[{"role": "user", "content": prompt}],
            temperature=current_app.config['TEMPERATURE']
        )
        
        result_text = response.choices[0].message.content.strip()
        
        # Extract JSON from the response
        try:
            import re
            json_match = re.search(r'{.*}', result_text, re.DOTALL)
            if json_match:
                json_str = json_match.group(0)
                return json.loads(json_str)
            return json.loads(result_text)
        except Exception as e:
            print(f"Error parsing JSON: {e}")
            return {
                "icp": {
                    "industry": "Technology",
                    "company_size": "50-1000 employees",
                    "geography": "North America",
                    "other_criteria": ["B2B focused", "Growth stage"]
                },
                "buyer_persona": {
                    "title": "VP of Sales",
                    "role": "Decision maker",
                    "pain_points": ["Low conversion rates", "Inefficient sales process"],
                    "search_terms": "VP Sales OR Head of Sales OR Sales Director"
                },
                "user_persona": {
                    "title": "Sales Representative",
                    "role": "End user",
                    "pain_points": ["Cold outreach difficulties", "Low response rates"],
                    "search_terms": "Sales Representative OR Account Executive OR BDR"
                }
            }
    except Exception as e:
        print(f"Error generating ICP: {e}")
        return None

def find_mutual_connections(profile_list, trusted_network):
    """Find mutual connections between profiles and trusted network"""
    # This would require advanced LinkedIn scraping or use of the LinkedIn API
    # For simplification, we'll simulate finding mutual connections
    
    # Create a dictionary mapping connection levels to numbers (for sorting later)
    connection_level_map = {
        "1st": 1,
        "2nd": 2,
        "3rd+": 3
    }
    
    # Process each profile
    for profile in profile_list:
        # Get the connection level from the profile
        raw_connection = profile.get("connection_level", "3rd+")
        
        # Normalize the connection level text
        connection_level = "1st" if "1st" in raw_connection else "2nd" if "2nd" in raw_connection else "3rd+"
        profile["connection_level"] = connection_level
        
        # Set numeric connection level for sorting
        profile["connection_level_numeric"] = connection_level_map.get(connection_level, 3)
        
        # For 1st connections, no mutual connections needed
        if connection_level == "1st":
            profile["mutual_connections"] = []
            profile["tnl_connection"] = False
            continue
            
        # For 2nd connections, find or simulate mutual connections
        if connection_level == "2nd" and trusted_network:
            # In a real implementation, this would involve scraping LinkedIn
            # Only show trusted network connections (no random connections)
            if trusted_network:
                mutual_contacts = []
                
                # Determine how many TNL connections to show (1-3)
                num_tnl = randint(1, min(3, len(trusted_network)))
                
                # Select random TNL contacts without duplication
                selected_indices = set()
                for _ in range(num_tnl):
                    if len(selected_indices) >= len(trusted_network):
                        break
                    
                    # Find a new random index not already selected
                    while True:
                        idx = randint(0, len(trusted_network) - 1)
                        if idx not in selected_indices:
                            selected_indices.add(idx)
                            break
                    
                    mutual = trusted_network[idx]
                    mutual_contacts.append({
                        "name": mutual["name"],
                        "in_tnl": True,
                        "tnl_score": mutual.get("trust_score", 5)
                    })
                
                profile["mutual_connections"] = mutual_contacts
                profile["tnl_connection"] = len(mutual_contacts) > 0
            else:
                profile["mutual_connections"] = []
                profile["tnl_connection"] = False
        else:
            profile["mutual_connections"] = []
            profile["tnl_connection"] = False
    
    # Sort by: 1) TNL connection, 2) Connection level, 3) Number of mutual connections
    return sorted(
        profile_list,
        key=lambda p: (
            not p.get("tnl_connection", False),
            p.get("connection_level_numeric", 3),
            -len(p.get("mutual_connections", []))
        )
    )

def generate_outreach_message(profile, product_description=None, connection_path=None):
    """Generate a hyper-personalized outreach message based on the profile"""
    # Extract name
    full_name = profile.get('name', '')
    first_name = full_name.split(' ')[0] if full_name else "there"
    
    # Extract meaningful information from headline
    headline = profile.get('headline', '')
    
    # Remove connection degree text if present
    headline = headline.replace("1st degree connection", "").replace("2nd degree connection", "").replace("3rd+ degree connection", "").strip()
    
    # Try to extract company and role
    if " at " in headline:
        role_company = headline.split(" at ")
        role = role_company[0].strip()
        company = role_company[1].strip()
    else:
        role = headline
        company = ""
    
    # Build the connection path text
    connection_text = ""
    if connection_path:
        if connection_path.get("in_tnl", False):
            connection_text = f"I noticed we're both connected with {connection_path['name']}, who I work closely with."
        else:
            connection_text = f"I noticed we're both connected with {connection_path['name']}."
    
    # Determine message type
    if profile.get("connection_level") == "1st":
        message_type = "direct_existing"
    elif profile.get("tnl_connection", False) and profile.get("mutual_connections"):
        message_type = "intro_request"
    else:
        message_type = "cold_outreach"
    
    # Try to use OpenAI for message generation
    try:
        # Use the configure_openai function to create the client
        client = configure_openai()
        
        # Create base prompt with profile research instructions
        base_prompt = f"""
        Create a hyper-personalized LinkedIn message for {full_name}, who works as {role} {f"at {company}" if company else ""}.
        
        PROFILE CONTEXT:
        - Role: {role}
        - Company: {company if company else "Not specified"}
        - Location: {profile.get('location', 'Not specified')}
        - Connection Level: {profile.get('connection_level', 'Not specified')}
        - Mutual Connections: {len(profile.get('mutual_connections', [])) if profile.get('mutual_connections') else 0}
        
        PRODUCT CONTEXT:
        {product_description[:500] if product_description else ""}
        
        CONNECTION CONTEXT:
        {connection_text if connection_text else "No direct mutual connections."}
        
        PERSONALIZATION REQUIREMENTS:
        1. Research their role and company to identify specific pain points or opportunities
        2. Reference something unique about their professional background or recent company news
        3. Show genuine interest in their work and achievements
        4. Make a clear connection between their needs and {f"how our solution helps" if product_description else "potential collaboration opportunities"}
        5. Use a warm, professional tone that feels authentic
        6. Avoid generic phrases and obvious templated language
        7. Keep it concise and impactful
        """
        
        # Add message type specific instructions
        if message_type == "direct_existing":
            prompt = base_prompt + """
            ADDITIONAL REQUIREMENTS:
            1. Acknowledge the existing connection warmly
            2. Reference any past interactions if available
            3. Make a clear but soft ask for a conversation
            4. Keep it under 2000 characters
            """
        elif message_type == "intro_request":
            connection_name = profile["mutual_connections"][0]["name"] if profile["mutual_connections"] else "our mutual connection"
            prompt = base_prompt + f"""
            ADDITIONAL REQUIREMENTS:
            1. Write to {connection_name} requesting an introduction
            2. Explain clearly why connecting with {full_name} would be valuable
            3. Make it easy for them to make the introduction
            4. Keep it under 2000 characters
            """
        else:
            prompt = base_prompt + """
            ADDITIONAL REQUIREMENTS:
            1. Create a compelling reason for connecting
            2. Make the value proposition clear but subtle
            3. Keep it under 300 characters (LinkedIn connection request limit)
            """
        
        response = client.chat.completions.create(
            model=current_app.config.get('GPT_MODEL', 'gpt-4'),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
            max_tokens=800
        )
        
        message = response.choices[0].message.content.strip()
        
        # Clean up formatting
        if message.startswith('"') and message.endswith('"'):
            message = message[1:-1]
            
        # Ensure message fits LinkedIn character limit for connection requests
        if message_type == "cold_outreach" and len(message) > 300:
            message = message[:297] + "..."
            
    except Exception as e:
        print(f"Error generating message: {e}")
        # Fallback message generation without API
        message = create_fallback_message(first_name, role, company, profile, message_type, connection_path)
    
    return {
        "message": message,
        "type": message_type,
        "recipient": full_name if message_type != "intro_request" else profile["mutual_connections"][0]["name"] if profile.get("mutual_connections") else "Mutual Connection"
    }

def create_fallback_message(first_name, role, company, profile, message_type, connection_path=None):
    """Generate fallback message templates when API is unavailable"""
    if message_type == "direct_existing":
        # Direct message template
        templates = [
            f"Hi {first_name}, I've been following your work in {role}{' at '+company if company else ''} and would love to explore potential collaboration opportunities. Would you be open to a quick chat about how we might work together?",
            f"Hi {first_name}, your experience in {role} caught my attention, particularly your focus on {company if company else 'industry innovation'}. I'd love to connect and share ideas about {role.lower()} best practices.",
            f"Hi {first_name}, I noticed your impressive work in {role}{' at '+company if company else ''} and would value the opportunity to learn more about your approach to {role.lower()}. Would you have time for a brief discussion?"
        ]
        return templates[hash(first_name) % len(templates)]
        
    elif message_type == "intro_request":
        # Intro request template
        connection_name = profile["mutual_connections"][0]["name"].split()[0] if profile.get("mutual_connections") else "Hi"
        templates = [
            f"Hi {connection_name}, I noticed you're connected with {profile.get('name', 'your connection')} and their work in {role} aligns perfectly with some initiatives I'm working on. Would you be comfortable making an introduction?",
            f"Hi {connection_name}, would you be willing to introduce me to {profile.get('name', 'your connection')}? Their expertise in {role} is impressive, and I'd love to explore potential collaboration opportunities.",
            f"Hi {connection_name}, I see you know {profile.get('name', 'your connection')} who's doing great work in {role}. If you think it would be valuable, would you mind connecting us?"
        ]
        return templates[hash(connection_name) % len(templates)]
        
    else:
        # Cold outreach template
        connection_text = ""
        if connection_path:
            mutual_name = connection_path.get("name", "our mutual connection")
            connection_text = f"I noticed we're both connected with {mutual_name}. "
            
        templates = [
            f"Hi {first_name}, {connection_text}Your work in {role} caught my attention, particularly your focus on {company if company else 'industry innovation'}. I'd love to connect and share insights.",
            f"Hi {first_name}, {connection_text}I was impressed by your experience in {role}{' at '+company if company else ''} and would value connecting to share ideas and best practices.",
            f"Hi {first_name}, {connection_text}Your approach to {role.lower()} stands out, and I'd love to learn more about your professional journey."
        ]
        message = templates[hash(first_name) % len(templates)]
        
        # Ensure we stay within LinkedIn's 300 character limit
        if len(message) > 300:
            message = message[:297] + "..."
            
        return message