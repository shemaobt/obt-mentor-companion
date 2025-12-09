"""
Pytest configuration and fixtures for integration tests.
Functional approach - using pure functions for setup/teardown.
"""
import os
import psycopg2
from psycopg2.extras import RealDictCursor
import pytest
import requests
from typing import Dict, Any, Optional, Callable
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Test configuration
API_BASE_URL = os.getenv("TEST_API_URL", "http://localhost:5000")
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")


# ============================================================================
# Database Connection Functions
# ============================================================================

def create_db_connection(database_url: str = None):
    """Create a database connection (functional approach)."""
    url = database_url or TEST_DATABASE_URL
    if not url:
        raise ValueError("TEST_DATABASE_URL environment variable not set")
    return psycopg2.connect(url, cursor_factory=RealDictCursor)


def close_db_connection(conn):
    """Close database connection."""
    if conn and not conn.closed:
        conn.close()


def execute_query(conn, query: str, params: tuple = None) -> list:
    """Execute a query and return results."""
    with conn.cursor() as cur:
        cur.execute(query, params)
        if cur.description:  # SELECT query
            return cur.fetchall()
        conn.commit()
        return []


def execute_many(conn, query: str, params_list: list):
    """Execute a query multiple times with different parameters."""
    with conn.cursor() as cur:
        cur.executemany(query, params_list)
        conn.commit()


# ============================================================================
# Database Cleanup Functions
# ============================================================================

def clean_all_tables(conn):
    """Clean all tables in reverse dependency order."""
    tables = [
        'competency_evidence',
        'competency_change_history',
        'facilitator_competencies',
        'qualification_attachments',
        'facilitator_qualifications',
        'mentorship_activities',
        'quarterly_reports',
        'facilitators',
        'message_attachments',
        'messages',
        'chats',
        'chat_chains',
        'feedback',
        'documents',
        'api_usage',
        'api_keys',
        'users',
    ]
    
    for table in tables:
        execute_query(conn, f"DELETE FROM {table}")


def clean_user_data(conn, user_id: str):
    """Clean data for a specific user."""
    execute_query(conn, "DELETE FROM users WHERE id = %s", (user_id,))


# ============================================================================
# Test Data Creation Functions (Functional)
# ============================================================================

def create_test_user(
    conn,
    email: str = None,
    password: str = "Password123!",
    first_name: str = "Test",
    last_name: str = "User",
    is_admin: bool = False,
    approval_status: str = "approved"
) -> Dict[str, Any]:
    """Create a test user and return user data."""
    import bcrypt
    from faker import Faker
    
    fake = Faker()
    email = email or fake.email()
    
    # Hash password
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())
    
    query = """
        INSERT INTO users (email, password, first_name, last_name, is_admin, approval_status, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW(), NOW())
        RETURNING id, email, first_name, last_name, is_admin, approval_status
    """
    
    result = execute_query(
        conn,
        query,
        (email, hashed.decode('utf-8'), first_name, last_name, is_admin, approval_status)
    )
    
    user = dict(result[0]) if result else None
    if user:
        user['password'] = password  # Store plain password for testing
    return user


def create_test_facilitator(
    conn,
    user_id: str,
    region: str = "Test Region",
    mentor_supervisor: str = "Test Supervisor"
) -> Dict[str, Any]:
    """Create a facilitator profile for a user."""
    query = """
        INSERT INTO facilitators (user_id, region, mentor_supervisor, created_at, updated_at)
        VALUES (%s, %s, %s, NOW(), NOW())
        RETURNING id, user_id, region, mentor_supervisor, total_languages_mentored, total_chapters_mentored
    """
    
    result = execute_query(conn, query, (user_id, region, mentor_supervisor))
    facilitator = dict(result[0]) if result else None
    
    # Initialize all competencies for this facilitator
    if facilitator:
        init_facilitator_competencies(conn, facilitator['id'])
    
    return facilitator


def init_facilitator_competencies(conn, facilitator_id: str):
    """Initialize all 11 competencies for a facilitator."""
    competencies = [
        'interpersonal_skills',
        'intercultural_communication',
        'multimodal_skills',
        'translation_theory',
        'languages_communication',
        'biblical_languages',
        'biblical_studies',
        'planning_quality',
        'consulting_mentoring',
        'applied_technology',
        'reflective_practice',
    ]
    
    params_list = [
        (facilitator_id, comp_id, 'not_started', 'auto', 0)
        for comp_id in competencies
    ]
    
    query = """
        INSERT INTO facilitator_competencies 
        (facilitator_id, competency_id, status, status_source, auto_score, last_updated, created_at)
        VALUES (%s, %s, %s, %s, %s, NOW(), NOW())
    """
    
    execute_many(conn, query, params_list)


def create_test_qualification(
    conn,
    facilitator_id: str,
    course_title: str = "Test Course",
    institution: str = "Test University",
    course_level: str = "bachelor",
    description: str = "Test qualification description",
    completion_date: str = None
) -> Dict[str, Any]:
    """Create a test qualification."""
    query = """
        INSERT INTO facilitator_qualifications 
        (facilitator_id, course_title, institution, course_level, description, completion_date, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        RETURNING id, facilitator_id, course_title, institution, course_level, description
    """
    
    result = execute_query(
        conn,
        query,
        (facilitator_id, course_title, institution, course_level, description, completion_date)
    )
    
    return dict(result[0]) if result else None


def create_test_activity(
    conn,
    facilitator_id: str,
    activity_type: str = "translation",
    language_name: str = None,
    duration_years: int = None,
    chapters_count: int = None,
    description: str = "Test activity"
) -> Dict[str, Any]:
    """Create a test mentorship activity."""
    query = """
        INSERT INTO mentorship_activities 
        (facilitator_id, activity_type, language_name, duration_years, chapters_count, description, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, NOW())
        RETURNING id, facilitator_id, activity_type, language_name, duration_years, chapters_count
    """
    
    result = execute_query(
        conn,
        query,
        (facilitator_id, activity_type, language_name, duration_years, chapters_count, description)
    )
    
    return dict(result[0]) if result else None


# ============================================================================
# API Request Functions (Functional)
# ============================================================================

def make_api_request(
    method: str,
    endpoint: str,
    json_data: Dict = None,
    cookies: Dict = None,
    headers: Dict = None
) -> requests.Response:
    """Make an API request (functional wrapper)."""
    url = f"{API_BASE_URL}{endpoint}"
    return requests.request(
        method=method,
        url=url,
        json=json_data,
        cookies=cookies,
        headers=headers or {}
    )


def login_user(email: str, password: str) -> Optional[Dict[str, str]]:
    """Login a user and return cookies."""
    response = make_api_request(
        "POST",
        "/api/login",
        json_data={"email": email, "password": password}
    )
    
    if response.status_code == 200:
        return dict(response.cookies)
    return None


def get_user_competencies(cookies: Dict) -> list:
    """Get facilitator competencies."""
    response = make_api_request("GET", "/api/facilitator/competencies", cookies=cookies)
    if response.status_code == 200:
        return response.json()
    return []


def update_competency(
    cookies: Dict,
    competency_id: str,
    status: str,
    notes: str = None
) -> requests.Response:
    """Update a competency status."""
    data = {
        "competencyId": competency_id,
        "status": status,
    }
    if notes:
        data["notes"] = notes
    
    return make_api_request("POST", "/api/facilitator/competencies", json_data=data, cookies=cookies)


# ============================================================================
# Pytest Fixtures (using functional helpers)
# ============================================================================

@pytest.fixture(scope="session")
def db_connection():
    """Session-scoped database connection."""
    conn = create_db_connection()
    yield conn
    close_db_connection(conn)


@pytest.fixture(scope="function")
def clean_db(db_connection):
    """Clean database before each test."""
    clean_all_tables(db_connection)
    yield db_connection
    # Cleanup after test
    clean_all_tables(db_connection)


@pytest.fixture
def test_user(clean_db):
    """Create a test user."""
    user = create_test_user(clean_db)
    return user


@pytest.fixture
def test_facilitator(clean_db, test_user):
    """Create a test facilitator with initialized competencies."""
    facilitator = create_test_facilitator(clean_db, test_user['id'])
    return {
        'user': test_user,
        'facilitator': facilitator
    }


@pytest.fixture
def authenticated_user(test_facilitator):
    """Create authenticated user with cookies."""
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    return {
        **test_facilitator,
        'cookies': cookies
    }


@pytest.fixture
def facilitator_with_education(clean_db, test_facilitator):
    """Create facilitator with bachelor degree."""
    qualification = create_test_qualification(
        clean_db,
        test_facilitator['facilitator']['id'],
        course_title="Bachelor in Biblical Studies",
        institution="Test Seminary",
        course_level="bachelor",
        description="Comprehensive biblical studies program"
    )
    
    return {
        **test_facilitator,
        'qualification': qualification
    }


@pytest.fixture
def facilitator_with_experience(clean_db, test_facilitator):
    """Create facilitator with 5 years experience."""
    activity = create_test_activity(
        clean_db,
        test_facilitator['facilitator']['id'],
        activity_type="translation",
        language_name="Spanish",
        duration_years=5,
        chapters_count=27,
        description="Lead translation work for 5 years"
    )
    
    return {
        **test_facilitator,
        'activity': activity
    }


@pytest.fixture
def facilitator_with_both_pillars(clean_db, test_facilitator):
    """Create facilitator with both education and experience."""
    # Add education
    qualification = create_test_qualification(
        clean_db,
        test_facilitator['facilitator']['id'],
        course_title="Master in Translation",
        institution="Test University",
        course_level="master",
        description="Advanced translation studies"
    )
    
    # Add experience
    activity = create_test_activity(
        clean_db,
        test_facilitator['facilitator']['id'],
        activity_type="translation",
        language_name="Kosraean",
        duration_years=5,
        chapters_count=27,
        description="Lead OBT facilitator for 5 years"
    )
    
    return {
        **test_facilitator,
        'qualification': qualification,
        'activity': activity
    }

