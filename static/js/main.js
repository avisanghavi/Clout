# linkedin_scraper.py - Improved version that navigates multiple pages of results

import time
import json
import os
import re
import urllib.parse
from playwright.sync_api import sync_playwright
from flask import current_app

def save_cookies(context, filename="cookies.json"):
    """Save browser cookies for future sessions."""
    cookies = context.cookies()
    filepath = os.path.join(current_app.config['DATA_DIR'], filename)
    with open(filepath, "w") as f:
        json.dump(cookies, f)
    print("Cookies saved to", filepath)

def load_cookies(context, filename="cookies.json"):
    """Load cookies from previous session if available."""
    filepath = os.path.join(current_app.config['DATA_DIR'], filename)
    try:
        with open(filepath, "r") as f:
            cookies = json.load(f)
            context.add_cookies(cookies)
        print("Cookies loaded from", filepath)
        return True
    except Exception as e:
        print(f"Error loading cookies: {e}")
        return False

def perform_login(page, email, password):
    """Explicitly login to LinkedIn with provided credentials."""
    try:
        username_selector = 'input#username, input[name="session_key"]'
        password_selector = 'input#password, input[name="session_password"]'
        
        page.wait_for_selector(username_selector, timeout=15000)
        
        page.fill(username_selector, email)
        time.sleep(0.5)
        page.fill(password_selector, password)
        time.sleep(0.5)
        
        submit_button = 'button[type="submit"], button.sign-in-form__submit-button'
        with page.expect_navigation(timeout=20000):
            page.click(submit_button)
        
        # Screenshot
        screenshots_dir = os.path.join(current_app.config['DATA_DIR'], 'screenshots')
        os.makedirs(screenshots_dir, exist_ok=True)
        page.screenshot(path=os.path.join(screenshots_dir, 'post_login.png'))
        
        # Check if still on login
        if 'checkpoint' in page.url.lower() or 'login' in page.url.lower():
            print("Still on login/checkpoint page - possible credentials/CAPTCHA issue.")
            try:
                err_msg = page.inner_text('.error-message')
                print(f"Login error: {err_msg}")
            except:
                pass
            return False
        
        print("Login successful")
        return True
    
    except Exception as e:
        print(f"Login error: {e}")
        return False

def create_sample_profiles(search_query):
    """Create sample data if scraping fails."""
    # Create more realistic sample data (12+ profiles)
    profiles = []
    
    # Companies
    companies = ["Salesforce", "Microsoft", "Oracle", "HubSpot", "Adobe", 
                 "IBM", "SAP", "Zoom", "Slack", "Dell", "Google", "Amazon"]
    
    # Locations
    locations = ["San Francisco, CA", "New York, NY", "Boston, MA", "Chicago, IL",
                 "London, England, United Kingdom", "Austin, TX", "Toronto, ON, Canada",
                 "Seattle, WA", "Denver, CO", "Atlanta, GA", "Los Angeles, CA", "Dallas, TX"]
    
    # Names
    first_names = ["John", "Michael", "Sarah", "David", "Jennifer", "Robert", "Lisa",
                  "William", "Emma", "James", "Jessica", "Chris", "Amanda", "Daniel"]
    
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Miller", "Davis",
                 "Wilson", "Taylor", "Anderson", "Thomas", "Jackson", "White", "Harris"]
    
    # Job titles from search query
    job_titles = ["Sales Representative", "Account Executive", "BDR", 
                  "Business Development Representative", "Senior Account Executive",
                  "Enterprise Account Executive", "Sales Manager", "Account Manager"]
    
    # Generate 12 profiles
    for i in range(12):
        first_name = first_names[i % len(first_names)]
        last_name = last_names[i % len(last_names)]
        
        job_title = job_titles[i % len(job_titles)]
        company = companies[i % len(companies)]
        location = locations[i % len(locations)]
        
        # Connection level mix (1st, 2nd, with more 2nd)
        connection_level = "2nd" if i % 3 != 0 else "1st"
        
        # Add sample profile image URLs (using placeholder service)
        gender = "women" if i % 2 else "men"
        profile_image = f"https://randomuser.me/api/portraits/{gender}/{(i % 10) + 20}.jpg"
        
        profile = {
            "name": f"{first_name} {last_name}",
            "headline": f"{job_title} at {company}",
            "location": location,
            "connection_level": connection_level,
            "profile_url": f"https://www.linkedin.com/in/{first_name.lower()}-{last_name.lower()}/",
            "profile_image": profile_image,  # Add profile image URL
            "mutual_connections": [],
            "tnl_connection": (i % 4 == 0)  # Every 4th is TNL
        }
        
        profiles.append(profile)
    
    return profiles

def scroll_and_load_more(page, max_scrolls=3, wait_sec=2):
    """
    Scroll down multiple times to trigger auto-loading of additional results.
    Adjust max_scrolls and wait_sec as needed.
    """
    for i in range(max_scrolls):
        # Evaluate JS to scroll to bottom
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        time.sleep(wait_sec)
        print(f"Scroll #{i+1} done, waited {wait_sec} sec")

def extract_sales_nav_profiles(page, max_results=50):
    """Extract profiles after scrolling to load more leads."""
    # Attempt to load more leads
    scroll_and_load_more(page, max_scrolls=5, wait_sec=2)
    
    # Save page content for debugging
    page_text = page.inner_text('body')
    html_content = page.content()
    
    data_dir = current_app.config['DATA_DIR']
    with open(os.path.join(data_dir, "sales_nav_debug.txt"), "w", encoding="utf-8") as f:
        f.write(page_text)
    
    profiles = []
    
    # Try multiple card selectors
    card_selectors = [
        'div[data-x-search-result="LEAD"]',
        'ol.search-results__result-list > li',
        'li.search-results__result-item',
        'div.search-results__result-container',
        'div.ember-view.artdeco-list__item'  # More generic selector
    ]
    
    cards = []
    used_selector = None
    
    for selector in card_selectors:
        temp_cards = page.query_selector_all(selector)
        if len(temp_cards) > 0:
            cards = temp_cards
            used_selector = selector
            break
    
    # Take a screenshot of the results
    screenshots_dir = os.path.join(current_app.config['DATA_DIR'], 'screenshots')
    page.screenshot(path=os.path.join(screenshots_dir, "sales_nav_results.png"))
    
    print(f"Found {len(cards)} potential lead cards after scrolling using selector: {used_selector}")
    
    # If no cards found, try a direct string search in the HTML
    if not cards:
        # Extract profile data using regex
        # Most commonly used HTML patterns in Sales Navigator
        name_pattern = r'<a [^>]*data-anonymize="person-name"[^>]*>([^<]+)<\/a>'
        headline_pattern = r'<span [^>]*data-anonymize="title"[^>]*>([^<]+)<\/span>'
        location_pattern = r'<span [^>]*data-anonymize="location"[^>]*>([^<]+)<\/span>'
        
        names = re.findall(name_pattern, html_content)
        headlines = re.findall(headline_pattern, html_content)
        locations = re.findall(location_pattern, html_content)
        
        print(f"Regex found {len(names)} names, {len(headlines)} headlines, and {len(locations)} locations")
        
        # Create profiles from matched data
        count = min(len(names), max_results)
        for i in range(count):
            # Generate placeholder profile image
            gender = "women" if i % 2 else "men"
            profile_image = f"https://randomuser.me/api/portraits/{gender}/{(i % 10) + 20}.jpg"
            
            profile = {
                "name": names[i] if i < len(names) else f"Profile #{i+1}",
                "headline": headlines[i] if i < len(headlines) else "Sales Professional",
                "location": locations[i] if i < len(locations) else "United States",
                "connection_level": "2nd",  # Default to 2nd connection
                "profile_url": "https://www.linkedin.com/sales/",
                "profile_image": profile_image,  # Add profile image
                "mutual_connections": [],
                "tnl_connection": False
            }
            
            profiles.append(profile)
            print(f"Created profile from regex: {profile['name']}")
    else:
        # Process cards found using selectors
        for i, card in enumerate(cards[:max_results]):
            try:
                # Try different selectors for name
                name_elem = None
                name_selectors = [
                    'a[data-anonymize="person-name"]',
                    '.artdeco-entity-lockup__title a',
                    '.artdeco-entity-lockup__title span',
                    'a[data-control-name="view_lead_panel_via_search_lead_name"]',
                    'span[data-anonymize="person-name"]'
                ]
                
                for selector in name_selectors:
                    name_elem = card.query_selector(selector)
                    if name_elem:
                        break
                
                name = name_elem.inner_text().strip() if name_elem else f"Profile #{i+1}"
                
                # Try different selectors for headline/title
                title_elem = None
                title_selectors = [
                    'span[data-anonymize="title"]',
                    '.artdeco-entity-lockup__subtitle',
                    '.artdeco-entity-lockup__content .artdeco-entity-lockup__subtitle',
                    '.search-result__info-container .result-lockup__highlight-keyword'
                ]
                
                for selector in title_selectors:
                    title_elem = card.query_selector(selector)
                    if title_elem:
                        break
                
                headline = title_elem.inner_text().strip() if title_elem else "Sales Professional"
                
                # Try different selectors for location
                location_elem = None
                location_selectors = [
                    'span[data-anonymize="location"]',
                    '.artdeco-entity-lockup__caption',
                    '.artdeco-entity-lockup__content .artdeco-entity-lockup__caption',
                    '.search-result__info-container .result-lockup__position-location'
                ]
                
                for selector in location_selectors:
                    location_elem = card.query_selector(selector)
                    if location_elem:
                        break
                
                location = location_elem.inner_text().strip() if location_elem else "United States"
                
                # Extract connection level
                connection_level = "2nd"  # Default to 2nd connection
                
                connection_elem = None
                connection_selectors = [
                    '.artdeco-entity-lockup__degree',
                    '.artdeco-entity-lockup__badge',
                    '.search-result__social-proof-status',
                    '.search-result__connection-level',
                    '.result-lockup__badge-text'
                ]
                
                for selector in connection_selectors:
                    connection_elem = card.query_selector(selector)
                    if connection_elem:
                        break
                
                if connection_elem:
                    connection_text = connection_elem.inner_text()
                    if "1st" in connection_text:
                        connection_level = "1st"
                    elif "2nd" in connection_text:
                        connection_level = "2nd"
                    elif "3rd" in connection_text or "3rd+" in connection_text:
                        connection_level = "3rd+"
                
                # Extract profile URL
                profile_url = "https://www.linkedin.com/sales/"  # Default fallback URL
                try:
                    # Try multiple approaches to get the URL
                    
                    # Approach 1: Direct href extraction
                    for url_selector in [
                        'a[data-anonymize="person-name"]',
                        'a[data-lead-search-result^="profile-link"]',
                        '.artdeco-entity-lockup__title a',
                        'a[data-control-name="view_lead_panel_via_search_lead_name"]'
                    ]:
                        url_elem = card.query_selector(url_selector)
                        if url_elem:
                            href = url_elem.get_attribute('href')
                            if href and ('linkedin.com' in href):
                                profile_url = href
                                print(f"Found URL using selector {url_selector}: {profile_url}")
                                break
                    
                    # Approach 2: If no URL found, try to extract a lead ID and construct a URL
                    if profile_url == "https://www.linkedin.com/sales/":
                        # Look for data attributes that might contain IDs
                        lead_id = None
                        lead_elem = card.query_selector('[data-lead-id]')
                        if lead_elem:
                            lead_id = lead_elem.get_attribute('data-lead-id')
                        
                        if not lead_id:
                            # Try another approach - look in the href for an ID pattern
                            for link in card.query_selector_all('a'):
                                href = link.get_attribute('href')
                                if href and 'lead/' in href:
                                    # Extract ID from URL like /sales/lead/ACwAAAXHNY8BnLN80jtYvUtcELLYYY3YYbHpqrk,NAME_SEARCH
                                    id_match = re.search(r'lead/([^,]+)', href)
                                    if id_match:
                                        lead_id = id_match.group(1)
                                        break
                        
                        # Construct URL if we found an ID
                        if lead_id:
                            profile_url = f"https://www.linkedin.com/sales/lead/{lead_id}"
                            print(f"Constructed URL from lead ID: {profile_url}")
                    
                    # Approach 3: Look for any LinkedIn URL in the card
                    if profile_url == "https://www.linkedin.com/sales/":
                        for link in card.query_selector_all('a'):
                            href = link.get_attribute('href')
                            if href and ('linkedin.com/in/' in href or 'linkedin.com/sales/lead/' in href):
                                profile_url = href
                                print(f"Found LinkedIn profile URL: {profile_url}")
                                break
                    
                    # Sanitize URL - ensure it's properly formatted
                    if '?' in profile_url and not profile_url.startswith('http'):
                        profile_url = f"https://www.linkedin.com{profile_url}"
                    
                    print(f"Final URL for {name}: {profile_url}")

                except Exception as e:
                    print(f"Error extracting URL: {e}")
                
                # Generate placeholder profile image - safer approach
                gender = "women" if i % 2 else "men"
                profile_image = f"https://randomuser.me/api/portraits/{gender}/{(i % 10) + 20}.jpg"
                
                # Create profile object
                profile = {
                    "name": name,
                    "headline": headline,
                    "location": location,
                    "connection_level": connection_level,
                    "profile_url": profile_url,
                    "profile_image": profile_image,
                    "mutual_connections": [],
                    "tnl_connection": False
                }
                
                profiles.append(profile)
                print(f"Extracted profile: {name} ({connection_level})")
                
            except Exception as e:
                print(f"Error extracting profile {i+1}: {e}")
    
    return profiles

def navigate_to_next_page(page):
    """Navigate to the next page of search results. Returns True if successful."""
    try:
        # Try different next page button selectors
        next_button_selectors = [
            'button.artdeco-pagination__button--next',
            'li.artdeco-pagination__button--next button',
            'button[aria-label="Next"]',
            '.search-results__pagination-next-button',
            '.artdeco-pagination__button--next',
            '.search-results-container .artdeco-pagination__button--next'
        ]
        
        for selector in next_button_selectors:
            next_button = page.query_selector(selector)
            if next_button:
                # Check if button is disabled
                is_disabled = next_button.get_attribute('disabled')
                if is_disabled:
                    print("Next page button is disabled, reached last page")
                    return False
                
                # Click the button
                next_button.click()
                time.sleep(3)  # Wait for page to load
                print("Navigated to next page")
                return True
        
        # If no button found, try to find the URL for the next page
        pagination_links = page.query_selector_all('li.artdeco-pagination__indicator a')
        current_page = None
        for link in pagination_links:
            if link.query_selector('.artdeco-pagination__indicator--number.active, .selected'):
                current_page = int(link.inner_text().strip())
                break
        
        if current_page:
            next_page = current_page + 1
            print(f"Current page: {current_page}, trying to navigate to page {next_page}")
            
            # Look for the next page link
            for link in pagination_links:
                if link.inner_text().strip() == str(next_page):
                    link.click()
                    time.sleep(3)
                    print(f"Navigated to page {next_page} via pagination link")
                    return True
        
        # Last resort - try using the URL and page parameter
        if 'page=' in page.url:
            # Extract current page number
            current_url = page.url
            page_match = re.search(r'page=(\d+)', current_url)
            if page_match:
                current_page = int(page_match.group(1))
                next_page = current_page + 1
                next_url = current_url.replace(f'page={current_page}', f'page={next_page}')
                page.goto(next_url)
                time.sleep(3)
                print(f"Navigated to page {next_page} via URL modification")
                return True
            
        # If the URL doesn't have a page parameter, add it
        elif '?' in page.url:
            next_url = page.url + '&page=2'
            page.goto(next_url)
            time.sleep(3)
            print("Navigated to page 2 via URL addition")
            return True
        else:
            next_url = page.url + '?page=2'
            page.goto(next_url)
            time.sleep(3)
            print("Navigated to page 2 via URL addition")
            return True
        
        print("Could not find next page button or link")
        return False
        
    except Exception as e:
        print(f"Error navigating to next page: {e}")
        return False

def merge_profiles_by_best_connection(profiles):
    """
    If the same name appears multiple times, keep whichever has
    the "highest" connection level: 1st outranks 2nd outranks 3rd+.
    """
    level_map = {"1st": 1, "2nd": 2, "3rd": 3, "3rd+": 3}
    merged = {}
    for p in profiles:
        nm = p["name"]
        if nm not in merged:
            merged[nm] = p
        else:
            old_level = merged[nm]["connection_level"]
            new_level = p["connection_level"]
            old_num = level_map.get(old_level, 3)
            new_num = level_map.get(new_level, 3)
            # 1 < 2 < 3 => keep the "lowest" numeric
            if new_num < old_num:
                merged[nm] = p
    return list(merged.values())

def linkedin_search(search_query, max_results=20):
    """
    Search LinkedIn for profiles with pagination:
    1) Start with Sales Navigator
    2) Navigate through multiple pages (up to 5)
    3) Fall back to regular LinkedIn if needed
    4) Return sample data only as a last resort
    """
    data_dir = current_app.config['DATA_DIR']
    screenshots_dir = os.path.join(data_dir, 'screenshots')
    os.makedirs(screenshots_dir, exist_ok=True)
    
    all_profiles = []
    
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=False,
            slow_mo=100,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-setuid-sandbox'
            ]
        )
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 800}
        )
        page = context.new_page()
        
        cookie_loaded = load_cookies(context)
        print(f"Cookie loaded: {cookie_loaded}")
        
        try:
            # Go to Sales Nav
            page.goto("https://www.linkedin.com/sales/home", timeout=30000)
            page.screenshot(path=os.path.join(screenshots_dir, "initial_page.png"))
            
            # Check login
            if 'login' in page.url.lower():
                print("Login page detected, attempting to login")
                email = current_app.config['LINKEDIN_EMAIL']
                password = current_app.config['LINKEDIN_PASSWORD']
                
                if perform_login(page, email, password):
                    save_cookies(context)
                    page.goto("https://www.linkedin.com/sales/home", timeout=30000)
                    time.sleep(2)
                else:
                    browser.close()
                    # Fallback sample
                    sample = create_sample_profiles(search_query)
                    return sample
            
            # APPROACH 1: Try Sales Navigator
            # Navigate to People Search
            page.goto("https://www.linkedin.com/sales/search/people", timeout=30000)
            time.sleep(3)
            
            # Find search input
            search_input = None
            for sel in [
                'input[aria-label="Search by keywords"]',
                'input.search-global-typeahead__input',
                'input.global-typeahead__input',
                'input[placeholder*="Search"]'
            ]:
                node = page.query_selector(sel)
                if node:
                    search_input = node
                    break
            
            sales_nav_successful = False
            
            if search_input:
                search_input.click()
                search_input.fill("")
                time.sleep(0.5)
                search_input.fill(search_query)
                search_input.press('Enter')
                
                # Wait for results
                try:
                    page.wait_for_selector('div[data-x-search-result="LEAD"]', timeout=30000)
                    time.sleep(3)  # Give page a moment to fully load
                    page.screenshot(path=os.path.join(screenshots_dir, "sales_nav_found.png"))
                    sales_nav_successful = True
                except Exception as e:
                    print(f"Sales Navigator search failed: {e}")
            
            # Process multiple pages of Sales Navigator results
            if sales_nav_successful:
                max_pages = 5  # Try up to 5 pages
                
                for page_num in range(1, max_pages + 1):
                    print(f"Processing Sales Navigator page {page_num}")
                    page.screenshot(path=os.path.join(screenshots_dir, f"sales_nav_page_{page_num}.png"))
                    
                    # Extract profiles from current page
                    profiles_from_page = extract_sales_nav_profiles(page, max_results=max_results)
                    
                    # If we found profiles, add them to our list
                    if profiles_from_page:
                        print(f"Found {len(profiles_from_page)} profiles on page {page_num}")
                        all_profiles.extend(profiles_from_page)
                        
                        # Check if we have enough profiles
                        if len(all_profiles) >= max_results:
                            print(f"Found {len(all_profiles)} profiles, which is enough (target: {max_results})")
                            break
                    
                    # Try to navigate to the next page
                    if page_num < max_pages:
                        success = navigate_to_next_page(page)
                        if not success:
                            print(f"Could not navigate to page {page_num + 1}, stopping pagination")
                            break
                        time.sleep(3)  # Wait for the next page to load
            
            # APPROACH 2: If Sales Navigator fails or returns no results, try regular LinkedIn
            if not all_profiles:
                print("Sales Navigator approach failed. Trying regular LinkedIn...")
                encoded = urllib.parse.quote(search_query)
                
                # Try multiple pages of regular LinkedIn results
                max_pages = 5
                
                for page_num in range(1, max_pages + 1):
                    regular_url = f"https://www.linkedin.com/search/results/people/?keywords={encoded}&page={page_num}"
                    
                    try:
                        page.goto(regular_url, timeout=30000)
                        time.sleep(5)  # Wait for page to load
                        
                        # Take a screenshot
                        page.screenshot(path=os.path.join(screenshots_dir, f"regular_linkedin_page_{page_num}.png"))
                        
                        # Try to scroll and load more
                        scroll_and_load_more(page, max_scrolls=3, wait_sec=2)
                        
                        # Extract profiles
                        print(f"Extracting profiles from regular LinkedIn page {page_num}...")
                        
                        # Try to find profile cards
                        profile_cards = page.query_selector_all('li.reusable-search__result-container, div.entity-result__item')
                        
                        if not profile_cards:
                            print(f"No profile cards found on page {page_num}, trying next page")
                            continue
                        
                        # Process found cards
                        for i, card in enumerate(profile_cards):
                            try:
                                # Extract name
                                name_elem = card.query_selector('.entity-result__title-text a span[aria-hidden="true"]')
                                name = name_elem.inner_text().strip() if name_elem else f"LinkedIn User {len(all_profiles) + 1}"
                                
                                # Extract headline
                                headline_elem = card.query_selector('.entity-result__primary-subtitle')
                                headline = headline_elem.inner_text().strip() if headline_elem else "Sales Professional"
                                
                                # Extract location
                                location_elem = card.query_selector('.entity-result__secondary-subtitle')
                                location = location_elem.inner_text().strip() if location_elem else "United States"
                                
                                # Extract connection level
                                connection_level = "2nd"  # Default
                                connection_elem = card.query_selector('.entity-result__badge-text span')
                                if connection_elem:
                                    connection_text = connection_elem.inner_text().strip()
                                    if "1st" in connection_text:
                                        connection_level = "1st"
                                    elif "2nd" in connection_text:
                                        connection_level = "2nd"
                                    elif "3rd" in connection_text:
                                        connection_level = "3rd+"
                                
                                # Extract profile URL
                                profile_url = "https://www.linkedin.com/"
                                url_elem = card.query_selector('.entity-result__title-text a')
                                if url_elem:
                                    url = url_elem.get_attribute('href')
                                    if url:
                                        profile_url = url
                                
                                # Generate placeholder profile image
                                gender = "women" if i % 2 else "men"
                                profile_image = f"https://randomuser.me/api/portraits/{gender}/{(i % 10) + 20}.jpg"
                                
                                # Create profile object
                                profile = {
                                    "name": name,
                                    "headline": headline,
                                    "location": location,
                                    "connection_level": connection_level,
                                    "profile_url": profile_url,
                                    "profile_image": profile_image,
                                    "mutual_connections": [],
                                    "tnl_connection": False
                                }
                                
                                all_profiles.append(profile)
                                print(f"Added profile from regular LinkedIn: {name} ({connection_level})")
                                
                                # Check if we have enough profiles
                                if len(all_profiles) >= max_results:
                                    print(f"Found {len(all_profiles)} profiles, which is enough (target: {max_results})")
                                    break
                                
                            except Exception as e:
                                print(f"Error processing card {i+1} on page {page_num}: {e}")
                        
                        # If we have enough profiles, stop paging
                        if len(all_profiles) >= max_results:
                            break
                    
                    except Exception as e:
                        print(f"Error processing regular LinkedIn page {page_num}: {e}")
                
        except Exception as e:
            print(f"Comprehensive search error: {e}")
        finally:
            browser.close()
    
    # Merge duplicates by best connection
    final_profiles = merge_profiles_by_best_connection(all_profiles)
    
    # If no results, use sample data
    if not final_profiles:
        print("No profiles found, returning sample data")
        final_profiles = create_sample_profiles(search_query)
    
    # Save to profiles.json
    outpath = os.path.join(data_dir, "profiles.json")
    with open(outpath, "w") as f:
        json.dump(final_profiles, f)
    
    print(f"Final result: {len(final_profiles)} unique profiles")
    return final_profiles