"""
Integration tests for Competency workflows.
Functional approach - testing business rules through API.
"""
import pytest
from tests.conftest import (
    login_user,
    update_competency,
    get_user_competencies,
    make_api_request,
    create_test_qualification,
    create_test_activity,
    execute_query
)


# ============================================================================
# Helper Functions (Functional)
# ============================================================================

def get_competency_by_id(competencies: list, competency_id: str) -> dict:
    """Get a specific competency from list."""
    return next((c for c in competencies if c['competencyId'] == competency_id), None)


def set_competency_status_db(conn, facilitator_id: str, competency_id: str, status: str):
    """Directly set competency status in database (for test setup)."""
    query = """
        UPDATE facilitator_competencies 
        SET status = %s, last_updated = NOW()
        WHERE facilitator_id = %s AND competency_id = %s
    """
    execute_query(conn, query, (status, facilitator_id, competency_id))


# ============================================================================
# Competency Update Validation Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.competency
def test_prevent_competency_downgrade(clean_db, test_facilitator):
    """Test that competency downgrades are prevented."""
    # Setup: Set competency to proficient
    facilitator_id = test_facilitator['facilitator']['id']
    set_competency_status_db(clean_db, facilitator_id, 'translation_theory', 'proficient')
    
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    assert cookies is not None, "Login failed"
    
    # Attempt to downgrade to emerging
    response = update_competency(
        cookies,
        'translation_theory',
        'emerging',
        'Trying to downgrade'
    )
    
    # Should be rejected
    assert response.status_code == 400
    assert 'downgrade' in response.json().get('error', '').lower()
    
    # Verify database state unchanged
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'translation_theory')
    assert comp['status'] == 'proficient', "Status should remain proficient"


@pytest.mark.integration
@pytest.mark.competency
def test_reject_advanced_without_education(clean_db, facilitator_with_experience):
    """Test that Advanced level requires education."""
    # Setup: Facilitator has experience but no education
    facilitator_id = facilitator_with_experience['facilitator']['id']
    set_competency_status_db(clean_db, facilitator_id, 'translation_theory', 'proficient')
    
    # Login
    user = facilitator_with_experience['user']
    cookies = login_user(user['email'], user['password'])
    
    # Attempt to upgrade to Advanced
    response = update_competency(
        cookies,
        'translation_theory',
        'advanced',
        'Has experience, trying advanced'
    )
    
    # Should be rejected
    assert response.status_code == 400
    error_msg = response.json().get('error', '').lower()
    assert 'education' in error_msg or 'bachelor' in error_msg
    
    # Verify status unchanged
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'translation_theory')
    assert comp['status'] == 'proficient'


@pytest.mark.integration
@pytest.mark.competency
def test_reject_advanced_without_experience(clean_db, facilitator_with_education):
    """Test that Advanced level requires 3+ years experience."""
    # Setup: Facilitator has education but no experience
    facilitator_id = facilitator_with_education['facilitator']['id']
    set_competency_status_db(clean_db, facilitator_id, 'translation_theory', 'proficient')
    
    # Login
    user = facilitator_with_education['user']
    cookies = login_user(user['email'], user['password'])
    
    # Attempt to upgrade to Advanced
    response = update_competency(
        cookies,
        'translation_theory',
        'advanced',
        'Has education, trying advanced'
    )
    
    # Should be rejected
    assert response.status_code == 400
    error_msg = response.json().get('error', '').lower()
    assert 'experience' in error_msg or 'years' in error_msg
    
    # Verify status unchanged
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'translation_theory')
    assert comp['status'] == 'proficient'


@pytest.mark.integration
@pytest.mark.competency
def test_allow_advanced_with_both_pillars(clean_db, facilitator_with_both_pillars):
    """Test that Advanced is allowed when both education and experience present."""
    # Setup: Facilitator has both education and experience
    facilitator_id = facilitator_with_both_pillars['facilitator']['id']
    set_competency_status_db(clean_db, facilitator_id, 'translation_theory', 'proficient')
    
    # Login
    user = facilitator_with_both_pillars['user']
    cookies = login_user(user['email'], user['password'])
    
    # Upgrade to Advanced (should succeed)
    response = update_competency(
        cookies,
        'translation_theory',
        'advanced',
        'Has both education and experience'
    )
    
    # Should succeed
    assert response.status_code == 200
    data = response.json()
    assert data['status'] == 'advanced'
    assert data['competencyId'] == 'translation_theory'
    
    # Verify in database
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'translation_theory')
    assert comp['status'] == 'advanced'


@pytest.mark.integration
@pytest.mark.competency
def test_allow_valid_progression(clean_db, test_facilitator):
    """Test valid competency progression from not_started to proficient."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Progress through levels
    statuses = ['emerging', 'growing', 'proficient']
    
    for status in statuses:
        response = update_competency(
            cookies,
            'interpersonal_skills',
            status,
            f'Progressing to {status}'
        )
        
        assert response.status_code == 200, f"Failed to progress to {status}"
        data = response.json()
        assert data['status'] == status
    
    # Verify final state
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'interpersonal_skills')
    assert comp['status'] == 'proficient'


# ============================================================================
# Competency History Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.competency
def test_competency_change_creates_history(clean_db, test_facilitator):
    """Test that competency changes create audit trail."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    facilitator_id = test_facilitator['facilitator']['id']
    
    # Update competency
    response = update_competency(
        cookies,
        'biblical_studies',
        'emerging',
        'Starting biblical studies'
    )
    assert response.status_code == 200
    
    # Check history exists
    query = """
        SELECT * FROM competency_change_history
        WHERE facilitator_id = %s AND competency_id = %s
        ORDER BY changed_at DESC
    """
    history = execute_query(clean_db, query, (facilitator_id, 'biblical_studies'))
    
    assert len(history) > 0, "Change history should be created"
    latest = history[0]
    assert latest['new_status'] == 'emerging'


# ============================================================================
# Multiple Competency Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.competency
def test_update_multiple_competencies(clean_db, test_facilitator):
    """Test updating multiple competencies independently."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    competencies_to_update = [
        ('interpersonal_skills', 'growing'),
        ('multimodal_skills', 'emerging'),
        ('reflective_practice', 'proficient'),
    ]
    
    # Update each competency
    for comp_id, status in competencies_to_update:
        response = update_competency(cookies, comp_id, status)
        assert response.status_code == 200, f"Failed to update {comp_id}"
    
    # Verify all updates
    competencies = get_user_competencies(cookies)
    
    for comp_id, expected_status in competencies_to_update:
        comp = get_competency_by_id(competencies, comp_id)
        assert comp['status'] == expected_status, f"{comp_id} should be {expected_status}"


# ============================================================================
# Error Handling Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.competency
def test_invalid_competency_id(clean_db, test_facilitator):
    """Test updating non-existent competency."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to update invalid competency
    response = update_competency(
        cookies,
        'non_existent_competency',
        'advanced'
    )
    
    # Should be rejected
    assert response.status_code in [400, 404]


@pytest.mark.integration
@pytest.mark.competency
def test_invalid_status_value(clean_db, test_facilitator):
    """Test updating with invalid status value."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to use invalid status
    response = make_api_request(
        "POST",
        "/api/facilitator/competencies",
        json_data={
            "competencyId": "translation_theory",
            "status": "invalid_status"
        },
        cookies=cookies
    )
    
    # Should be rejected
    assert response.status_code == 400


@pytest.mark.integration
@pytest.mark.competency
def test_unauthenticated_access(clean_db, test_facilitator):
    """Test that unauthenticated users cannot update competencies."""
    # No login - no cookies
    
    response = update_competency(
        {},  # Empty cookies
        'translation_theory',
        'advanced'
    )
    
    # Should be rejected
    assert response.status_code in [401, 403]


# ============================================================================
# Competency Query Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.competency
def test_get_all_competencies(clean_db, test_facilitator):
    """Test retrieving all competencies."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Get competencies
    competencies = get_user_competencies(cookies)
    
    # Should have all 11 competencies
    assert len(competencies) == 11, "Should have all 11 core competencies"
    
    # Check all are initialized
    for comp in competencies:
        assert 'competencyId' in comp
        assert 'status' in comp
        assert comp['status'] == 'not_started'  # Initial state


@pytest.mark.integration
@pytest.mark.competency
def test_competencies_include_metadata(clean_db, test_facilitator):
    """Test that competency responses include all necessary metadata."""
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Update one competency
    update_competency(
        cookies,
        'translation_theory',
        'growing',
        'Progress notes'
    )
    
    # Get competencies
    competencies = get_user_competencies(cookies)
    comp = get_competency_by_id(competencies, 'translation_theory')
    
    # Check metadata
    assert comp is not None
    assert comp['status'] == 'growing'
    assert 'notes' in comp or 'lastUpdated' in comp
    assert 'statusSource' in comp or 'autoScore' in comp

