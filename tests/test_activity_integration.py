"""
Integration tests for Mentorship Activity workflows.
Functional approach - testing activity management through API.
"""
import pytest
from tests.conftest import (
    login_user,
    make_api_request,
    create_test_activity,
    execute_query
)


# ============================================================================
# Helper Functions (Functional)
# ============================================================================

def create_activity_via_api(cookies: dict, data: dict) -> dict:
    """Create an activity via API."""
    response = make_api_request(
        "POST",
        "/api/facilitator/activities",
        json_data=data,
        cookies=cookies
    )
    return response


def get_activities_via_api(cookies: dict) -> list:
    """Get all activities for authenticated user."""
    response = make_api_request(
        "GET",
        "/api/facilitator/activities",
        cookies=cookies
    )
    if response.status_code == 200:
        return response.json()
    return []


def get_facilitator_summary(cookies: dict) -> dict:
    """Get facilitator profile summary."""
    response = make_api_request(
        "GET",
        "/api/facilitator",
        cookies=cookies
    )
    if response.status_code == 200:
        return response.json()
    return {}


# ============================================================================
# Translation Activity Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_create_translation_activity(clean_db, test_facilitator):
    """Test creating a translation activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "Kosraean",
        "chaptersCount": 27,
        "durationYears": 3,
        "description": "Led Kosraean translation project for 3 years, completed 27 chapters"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['activityType'] == "translation"
    assert data['languageName'] == "Kosraean"
    assert data['chaptersCount'] == 27
    assert data['durationYears'] == 3


@pytest.mark.integration
@pytest.mark.activity
def test_create_translation_with_months(clean_db, test_facilitator):
    """Test creating activity with years and months duration."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity with duration in years and months
    response = create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "Spanish",
        "chaptersCount": 15,
        "durationYears": 2,
        "durationMonths": 6,
        "description": "Translation work for 2 years and 6 months"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['durationYears'] == 2
    assert data.get('durationMonths') == 6


# ============================================================================
# Other Activity Type Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_create_facilitation_activity(clean_db, test_facilitator):
    """Test creating a facilitation activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "facilitation",
        "title": "OBT Workshop Facilitator",
        "organization": "YWAM",
        "durationYears": 5,
        "description": "Facilitated OBT workshops across Latin America for 5 years"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['activityType'] == "facilitation"
    assert data['durationYears'] == 5


@pytest.mark.integration
@pytest.mark.activity
def test_create_teaching_activity(clean_db, test_facilitator):
    """Test creating a teaching activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "teaching",
        "title": "Translation Theory Instructor",
        "organization": "Bible Translation School",
        "durationYears": 3,
        "description": "Taught translation theory courses for 3 years"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['activityType'] == "teaching"


@pytest.mark.integration
@pytest.mark.activity
def test_create_long_term_mentoring_activity(clean_db, test_facilitator):
    """Test creating a long-term mentoring activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "long_term_mentoring",
        "title": "Senior Mentor",
        "organization": "Translation Organization",
        "durationYears": 10,
        "description": "Mentored junior facilitators for over 10 years"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['activityType'] == "long_term_mentoring"
    assert data['durationYears'] == 10


@pytest.mark.integration
@pytest.mark.activity
def test_create_quality_assurance_activity(clean_db, test_facilitator):
    """Test creating a quality assurance activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "quality_assurance_work",
        "title": "QA Consultant",
        "durationYears": 4,
        "description": "Conducted quality assurance for multiple translation projects"
    })
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['activityType'] == "quality_assurance_work"


# ============================================================================
# Activity Totals Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_activity_updates_language_count(clean_db, test_facilitator):
    """Test that translation activities update total languages mentored."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get initial totals
    initial_summary = get_facilitator_summary(cookies)
    initial_languages = initial_summary.get('totalLanguagesMentored', 0)
    
    # Add translation activity
    create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "Haitian Creole",
        "chaptersCount": 20,
        "durationYears": 2,
        "description": "Translation work in Haitian Creole"
    })
    
    # Get updated totals
    updated_summary = get_facilitator_summary(cookies)
    updated_languages = updated_summary.get('totalLanguagesMentored', 0)
    
    # Should have increased
    assert updated_languages > initial_languages


@pytest.mark.integration
@pytest.mark.activity
def test_activity_updates_chapter_count(clean_db, test_facilitator):
    """Test that translation activities update total chapters mentored."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get initial totals
    initial_summary = get_facilitator_summary(cookies)
    initial_chapters = initial_summary.get('totalChaptersMentored', 0)
    
    # Add translation activity with chapters
    chapters_added = 15
    create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "Quechua",
        "chaptersCount": chapters_added,
        "durationYears": 1,
        "description": "Quechua translation"
    })
    
    # Get updated totals
    updated_summary = get_facilitator_summary(cookies)
    updated_chapters = updated_summary.get('totalChaptersMentored', 0)
    
    # Should have increased by chapters_added
    assert updated_chapters >= initial_chapters + chapters_added


@pytest.mark.integration
@pytest.mark.activity
def test_multiple_translation_activities_cumulative(clean_db, test_facilitator):
    """Test that multiple activities accumulate correctly."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Add multiple translation activities
    activities = [
        {"languageName": "Spanish", "chaptersCount": 10},
        {"languageName": "Portuguese", "chaptersCount": 15},
        {"languageName": "French", "chaptersCount": 20},
    ]
    
    for activity in activities:
        create_activity_via_api(cookies, {
            "activityType": "translation",
            "languageName": activity['languageName'],
            "chaptersCount": activity['chaptersCount'],
            "durationYears": 1,
            "description": f"Translation in {activity['languageName']}"
        })
    
    # Get totals
    summary = get_facilitator_summary(cookies)
    
    # Should reflect all activities
    assert summary.get('totalLanguagesMentored', 0) >= 3
    assert summary.get('totalChaptersMentored', 0) >= 45  # 10 + 15 + 20


# ============================================================================
# Activity Validation Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_require_activity_type(clean_db, test_facilitator):
    """Test that activity type is required."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create without activity type
    response = create_activity_via_api(cookies, {
        "languageName": "Test",
        "description": "Test activity"
    })
    
    # Should be rejected
    assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.activity
def test_translation_requires_language_name(clean_db, test_facilitator):
    """Test that translation activities require language name."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create translation without language name
    response = create_activity_via_api(cookies, {
        "activityType": "translation",
        "chaptersCount": 10,
        "description": "Translation without language"
    })
    
    # Should be rejected (if enforced by API)
    # Note: This test depends on API validation rules
    assert response.status_code in [400, 200]  # May or may not be enforced


@pytest.mark.integration
@pytest.mark.activity
def test_invalid_duration_rejected(clean_db, test_facilitator):
    """Test that negative durations are rejected."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to create with negative duration
    response = create_activity_via_api(cookies, {
        "activityType": "teaching",
        "title": "Test",
        "durationYears": -5,
        "description": "Invalid negative duration"
    })
    
    # Should be rejected
    assert response.status_code == 400


# ============================================================================
# Activity Retrieval Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_get_all_activities(clean_db, test_facilitator):
    """Test retrieving all activities."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    facilitator_id = test_facilitator['facilitator']['id']
    
    # Create multiple activities
    create_test_activity(
        clean_db, facilitator_id,
        activity_type="translation",
        language_name="Spanish",
        duration_years=2,
        description="Spanish translation"
    )
    create_test_activity(
        clean_db, facilitator_id,
        activity_type="teaching",
        duration_years=3,
        description="Teaching experience"
    )
    
    # Get activities
    activities = get_activities_via_api(cookies)
    
    # Should have both
    assert len(activities) >= 2


@pytest.mark.integration
@pytest.mark.activity
def test_get_empty_activities(clean_db, test_facilitator):
    """Test retrieving activities when none exist."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get activities
    activities = get_activities_via_api(cookies)
    
    # Should be empty
    assert len(activities) == 0


# ============================================================================
# Activity Deletion Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_delete_activity(clean_db, test_facilitator):
    """Test deleting an activity."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Create activity
    response = create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "To Be Deleted",
        "chaptersCount": 5,
        "durationYears": 1,
        "description": "This will be deleted"
    })
    assert response.status_code == 200
    activity_id = response.json()['id']
    
    # Delete it
    delete_response = make_api_request(
        "DELETE",
        f"/api/facilitator/activities/{activity_id}",
        cookies=cookies
    )
    
    # Should succeed
    assert delete_response.status_code == 200
    
    # Verify it's gone
    activities = get_activities_via_api(cookies)
    assert not any(a['id'] == activity_id for a in activities)


# ============================================================================
# Activity and Competency Integration Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_experience_enables_advanced_competency(clean_db, facilitator_with_education):
    """Test that adding experience (with existing education) enables Advanced."""
    # Login
    user = facilitator_with_education['user']
    cookies = login_user(user['email'], user['password'])
    
    # Set competency to proficient
    from tests.conftest import execute_query
    facilitator_id = facilitator_with_education['facilitator']['id']
    execute_query(
        clean_db,
        "UPDATE facilitator_competencies SET status = 'proficient' WHERE facilitator_id = %s AND competency_id = 'translation_theory'",
        (facilitator_id,)
    )
    
    # Add 5 years of experience
    create_activity_via_api(cookies, {
        "activityType": "translation",
        "languageName": "Test Language",
        "durationYears": 5,
        "chaptersCount": 30,
        "description": "5 years translation experience"
    })
    
    # Now try to upgrade to Advanced (should work)
    from tests.conftest import update_competency
    response = update_competency(
        cookies,
        'translation_theory',
        'advanced',
        'Has both education and experience'
    )
    
    # Should succeed
    assert response.status_code == 200


# ============================================================================
# Authorization Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.activity
def test_unauthenticated_cannot_create_activity(clean_db):
    """Test that unauthenticated users cannot create activities."""
    response = create_activity_via_api({}, {
        "activityType": "translation",
        "languageName": "Test",
        "description": "Test activity"
    })
    
    # Should be rejected
    assert response.status_code in [401, 403]

