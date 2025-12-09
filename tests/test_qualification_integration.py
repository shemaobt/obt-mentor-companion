"""
Integration tests for Qualification workflows.
Functional approach - testing qualification management through API.
"""
import pytest
from tests.conftest import (
    login_user,
    make_api_request,
    create_test_qualification,
    execute_query
)


# ============================================================================
# Helper Functions (Functional)
# ============================================================================

def create_qualification_via_api(cookies: dict, data: dict) -> dict:
    """Create a qualification via API."""
    response = make_api_request(
        "POST",
        "/api/facilitator/qualifications",
        json_data=data,
        cookies=cookies
    )
    return response


def get_qualifications_via_api(cookies: dict) -> list:
    """Get all qualifications for authenticated user."""
    response = make_api_request(
        "GET",
        "/api/facilitator/qualifications",
        cookies=cookies
    )
    if response.status_code == 200:
        return response.json()
    return []


def delete_qualification_via_api(cookies: dict, qualification_id: str) -> dict:
    """Delete a qualification via API."""
    response = make_api_request(
        "DELETE",
        f"/api/facilitator/qualifications/{qualification_id}",
        cookies=cookies
    )
    return response


# ============================================================================
# Qualification Creation Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_create_bachelor_qualification(clean_db, test_facilitator):
    """Test creating a Bachelor-level qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Bachelor of Biblical Studies",
        "institution": "Test Seminary",
        "courseLevel": "bachelor",
        "description": "Comprehensive biblical studies covering Old and New Testament",
        "completionDate": "2020-06-15"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['courseTitle'] == "Bachelor of Biblical Studies"
    assert data['courseLevel'] == "bachelor"
    assert 'id' in data


@pytest.mark.integration
@pytest.mark.qualification
def test_create_master_qualification(clean_db, test_facilitator):
    """Test creating a Master-level qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Master in Translation Studies",
        "institution": "University of Translation",
        "courseLevel": "master",
        "description": "Advanced translation theory and practice",
        "completionDate": "2022-05-20"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['courseLevel'] == "master"


@pytest.mark.integration
@pytest.mark.qualification
def test_create_doctoral_qualification(clean_db, test_facilitator):
    """Test creating a Doctoral-level qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "PhD in Linguistics",
        "institution": "Research University",
        "courseLevel": "doctoral",
        "description": "Doctoral research in applied linguistics and Bible translation",
        "completionDate": "2023-12-01"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['courseLevel'] == "doctoral"


@pytest.mark.integration
@pytest.mark.qualification
def test_create_certificate_qualification(clean_db, test_facilitator):
    """Test creating a Certificate-level qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "OBT Facilitator Training",
        "institution": "YWAM Training Center",
        "courseLevel": "certificate",
        "description": "Intensive OBT facilitator training program",
        "completionDate": "2021-08-10"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['courseLevel'] == "certificate"


@pytest.mark.integration
@pytest.mark.qualification
def test_create_introduction_qualification(clean_db, test_facilitator):
    """Test creating an Introduction-level qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Introduction to OBT Methods",
        "institution": "Online Course",
        "courseLevel": "introduction",
        "description": "Introductory course on oral Bible translation methods"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['courseLevel'] == "introduction"


# ============================================================================
# Qualification Validation Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_require_course_title(clean_db, test_facilitator):
    """Test that course title is required."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create without title
    response = create_qualification_via_api(cookies, {
        "institution": "Test University",
        "courseLevel": "bachelor",
        "description": "Test description"
    })
    
    # Should be rejected
    assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.qualification
def test_require_institution(clean_db, test_facilitator):
    """Test that institution is required."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create without institution
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Test Course",
        "courseLevel": "bachelor",
        "description": "Test description"
    })
    
    # Should be rejected
    assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.qualification
def test_require_description(clean_db, test_facilitator):
    """Test that description is required."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create without description
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Test Course",
        "institution": "Test University",
        "courseLevel": "bachelor"
    })
    
    # Should be rejected
    assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.qualification
def test_invalid_course_level(clean_db, test_facilitator):
    """Test that invalid course levels are rejected."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create with invalid level
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Test Course",
        "institution": "Test University",
        "courseLevel": "invalid_level",
        "description": "Test description"
    })
    
    # Should be rejected
    assert response.status_code == 400


# ============================================================================
# Qualification Retrieval Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_get_all_qualifications(clean_db, test_facilitator):
    """Test retrieving all qualifications."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    facilitator_id = test_facilitator['facilitator']['id']
    
    # Create multiple qualifications
    create_test_qualification(
        clean_db, facilitator_id,
        course_title="Bachelor Degree",
        course_level="bachelor",
        description="First qualification"
    )
    create_test_qualification(
        clean_db, facilitator_id,
        course_title="Master Degree",
        course_level="master",
        description="Second qualification"
    )
    
    # Get qualifications
    qualifications = get_qualifications_via_api(cookies)
    
    # Should have both
    assert len(qualifications) == 2
    titles = [q['courseTitle'] for q in qualifications]
    assert "Bachelor Degree" in titles
    assert "Master Degree" in titles


@pytest.mark.integration
@pytest.mark.qualification
def test_get_empty_qualifications(clean_db, test_facilitator):
    """Test retrieving qualifications when none exist."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get qualifications
    qualifications = get_qualifications_via_api(cookies)
    
    # Should be empty
    assert len(qualifications) == 0


# ============================================================================
# Qualification Update Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_update_qualification(clean_db, test_facilitator):
    """Test updating an existing qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create qualification
    response = create_qualification_via_api(cookies, {
        "courseTitle": "Original Title",
        "institution": "Original Institution",
        "courseLevel": "bachelor",
        "description": "Original description"
    })
    assert response.status_code == 200
    qualification_id = response.json()['id']
    
    # Update qualification
    update_response = make_api_request(
        "PUT",
        f"/api/facilitator/qualifications/{qualification_id}",
        json_data={
            "courseTitle": "Updated Title",
            "institution": "Updated Institution",
            "courseLevel": "master",
            "description": "Updated description"
        },
        cookies=cookies
    )
    
    # Should succeed
    assert update_response.status_code == 200
    data = update_response.json()
    assert data['courseTitle'] == "Updated Title"
    assert data['courseLevel'] == "master"


# ============================================================================
# Qualification Deletion Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_delete_qualification(clean_db, test_facilitator):
    """Test deleting a qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    facilitator_id = test_facilitator['facilitator']['id']
    
    # Create qualification
    qual = create_test_qualification(
        clean_db, facilitator_id,
        course_title="To Be Deleted",
        description="This will be deleted"
    )
    
    # Delete it
    response = delete_qualification_via_api(cookies, qual['id'])
    
    # Should succeed
    assert response.status_code == 200
    
    # Verify it's gone
    qualifications = get_qualifications_via_api(cookies)
    assert not any(q['id'] == qual['id'] for q in qualifications)


@pytest.mark.integration
@pytest.mark.qualification
def test_delete_nonexistent_qualification(clean_db, test_facilitator):
    """Test deleting a non-existent qualification."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to delete non-existent
    response = delete_qualification_via_api(cookies, "non-existent-id")
    
    # Should be rejected
    assert response.status_code in [404, 400]


# ============================================================================
# Qualification and Competency Integration Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_qualification_affects_auto_scoring(clean_db, test_facilitator):
    """Test that adding qualifications affects competency auto-scoring."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get initial competencies
    from tests.conftest import get_user_competencies
    initial_competencies = get_user_competencies(cookies)
    initial_biblical = next(c for c in initial_competencies if c['competencyId'] == 'biblical_studies')
    initial_score = initial_biblical.get('autoScore', 0)
    
    # Add Bachelor in Biblical Studies
    create_qualification_via_api(cookies, {
        "courseTitle": "Bachelor of Biblical Studies",
        "institution": "Seminary",
        "courseLevel": "bachelor",
        "description": "Comprehensive biblical studies program"
    })
    
    # Get updated competencies
    updated_competencies = get_user_competencies(cookies)
    updated_biblical = next(c for c in updated_competencies if c['competencyId'] == 'biblical_studies')
    updated_score = updated_biblical.get('autoScore', 0)
    
    # Score should have increased
    assert updated_score > initial_score, "Auto-score should increase after adding qualification"


@pytest.mark.integration
@pytest.mark.qualification
def test_multiple_qualifications_same_competency(clean_db, test_facilitator):
    """Test adding multiple qualifications in the same competency area."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Add multiple biblical studies qualifications
    qualifications_data = [
        {
            "courseTitle": "Certificate in Biblical Hebrew",
            "institution": "Language School",
            "courseLevel": "certificate",
            "description": "Hebrew language for Bible translation"
        },
        {
            "courseTitle": "Bachelor of Theology",
            "institution": "Seminary",
            "courseLevel": "bachelor",
            "description": "Theological studies with biblical languages"
        },
        {
            "courseTitle": "Master of Biblical Exegesis",
            "institution": "Graduate School",
            "courseLevel": "master",
            "description": "Advanced biblical interpretation"
        }
    ]
    
    # Create all qualifications
    for qual_data in qualifications_data:
        response = create_qualification_via_api(cookies, qual_data)
        assert response.status_code == 200, f"Failed to create {qual_data['courseTitle']}"
    
    # Verify all exist
    qualifications = get_qualifications_via_api(cookies)
    assert len(qualifications) == 3


# ============================================================================
# Authorization Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.qualification
def test_unauthenticated_cannot_create_qualification(clean_db):
    """Test that unauthenticated users cannot create qualifications."""
    response = create_qualification_via_api({}, {
        "courseTitle": "Test Course",
        "institution": "Test University",
        "courseLevel": "bachelor",
        "description": "Test description"
    })
    
    # Should be rejected
    assert response.status_code in [401, 403]


@pytest.mark.integration
@pytest.mark.qualification
def test_user_cannot_access_other_user_qualifications(clean_db, test_user):
    """Test that users can only see their own qualifications."""
    from tests.conftest import create_test_user, create_test_facilitator
    
    # Create two users with facilitators
    user1 = test_user
    user2 = create_test_user(clean_db, email="user2@example.com")
    
    facilitator1 = create_test_facilitator(clean_db, user1['id'])
    facilitator2 = create_test_facilitator(clean_db, user2['id'])
    
    # Add qualification for user2
    create_test_qualification(
        clean_db,
        facilitator2['id'],
        course_title="User 2's Qualification",
        description="Belongs to user 2"
    )
    
    # Login as user1
    cookies = login_user(user1['email'], user1['password'])
    
    # Try to get qualifications
    qualifications = get_qualifications_via_api(cookies)
    
    # Should not see user2's qualification
    assert not any(q['courseTitle'] == "User 2's Qualification" for q in qualifications)

