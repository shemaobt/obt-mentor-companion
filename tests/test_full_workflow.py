"""
Integration tests for full end-to-end workflows.
Functional approach - testing complete user journeys.
"""
import pytest
from tests.conftest import (
    login_user,
    update_competency,
    get_user_competencies,
    make_api_request,
    execute_query
)


# ============================================================================
# Helper Functions
# ============================================================================

def create_qualification_api(cookies: dict, data: dict):
    """Create qualification via API."""
    return make_api_request(
        "POST",
        "/api/facilitator/qualifications",
        json_data=data,
        cookies=cookies
    )


def create_activity_api(cookies: dict, data: dict):
    """Create activity via API."""
    return make_api_request(
        "POST",
        "/api/facilitator/activities",
        json_data=data,
        cookies=cookies
    )


def generate_report_api(cookies: dict, period_start: str, period_end: str):
    """Generate quarterly report via API."""
    return make_api_request(
        "POST",
        "/api/facilitator/reports/generate",
        json_data={
            "periodStart": period_start,
            "periodEnd": period_end
        },
        cookies=cookies
    )


def get_reports_api(cookies: dict) -> list:
    """Get all reports via API."""
    response = make_api_request(
        "GET",
        "/api/facilitator/reports",
        cookies=cookies
    )
    if response.status_code == 200:
        return response.json()
    return []


# ============================================================================
# Complete Facilitator Journey Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_complete_facilitator_journey_to_advanced(clean_db, test_facilitator):
    """
    Test complete journey:
    1. Add education (Bachelor)
    2. Add experience (5 years)
    3. Progress through competency levels
    4. Reach Advanced status
    5. Generate report
    """
    # Step 1: Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    assert cookies is not None, "Login failed"
    
    # Step 2: Add Bachelor degree
    qual_response = create_qualification_api(cookies, {
        "courseTitle": "Bachelor in Biblical Studies",
        "institution": "Test Seminary",
        "courseLevel": "bachelor",
        "description": "Comprehensive biblical studies program covering Old and New Testament, hermeneutics, and biblical languages"
    })
    assert qual_response.status_code == 200, "Failed to create qualification"
    
    # Step 3: Add 5 years of translation experience
    activity_response = create_activity_api(cookies, {
        "activityType": "translation",
        "languageName": "Kosraean",
        "durationYears": 5,
        "chaptersCount": 27,
        "description": "Lead OBT facilitator for Kosraean translation project, mentored translation team for 5 years"
    })
    assert activity_response.status_code == 200, "Failed to create activity"
    
    # Step 4: Progress through competency levels
    competency_id = 'biblical_studies'
    
    # 4a: Update to emerging
    response = update_competency(cookies, competency_id, 'emerging', 'Starting to demonstrate understanding')
    assert response.status_code == 200
    
    # 4b: Update to growing
    response = update_competency(cookies, competency_id, 'growing', 'Showing consistent application')
    assert response.status_code == 200
    
    # 4c: Update to proficient
    response = update_competency(cookies, competency_id, 'proficient', 'Demonstrated competence in practice')
    assert response.status_code == 200
    
    # 4d: Update to advanced (should work - has both pillars)
    response = update_competency(cookies, competency_id, 'advanced', 'Demonstrated expertise through education and extensive experience')
    assert response.status_code == 200, f"Failed to reach Advanced: {response.json()}"
    
    # Step 5: Verify Advanced status
    competencies = get_user_competencies(cookies)
    biblical_comp = next(c for c in competencies if c['competencyId'] == competency_id)
    assert biblical_comp['status'] == 'advanced', "Should be at Advanced level"
    
    # Step 6: Generate quarterly report
    report_response = generate_report_api(cookies, "2024-01-01", "2024-03-31")
    assert report_response.status_code == 200, "Failed to generate report"
    
    # Step 7: Verify report contains all data
    report_data = report_response.json()
    assert 'reportData' in report_data or 'filePath' in report_data
    
    # Verify report includes our qualification
    if 'reportData' in report_data:
        report = report_data['reportData']
        if 'qualifications' in report:
            assert len(report['qualifications']) >= 1
        if 'activities' in report:
            assert len(report['activities']) >= 1
        if 'competencies' in report:
            has_advanced = any(
                c.get('competencyId') == competency_id and c.get('status') == 'advanced'
                for c in report['competencies']
            )
            assert has_advanced, "Report should show Advanced competency"


@pytest.mark.integration
@pytest.mark.workflow
def test_incomplete_journey_blocks_advanced(clean_db, test_facilitator):
    """
    Test that incomplete preparation blocks Advanced:
    1. Add only education (no experience)
    2. Try to reach Advanced
    3. Should be blocked
    """
    # Step 1: Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Step 2: Add Bachelor degree (education only)
    qual_response = create_qualification_api(cookies, {
        "courseTitle": "Bachelor in Theology",
        "institution": "Seminary",
        "courseLevel": "bachelor",
        "description": "Theological studies"
    })
    assert qual_response.status_code == 200
    
    # Step 3: Progress to proficient
    competency_id = 'biblical_studies'
    update_competency(cookies, competency_id, 'emerging')
    update_competency(cookies, competency_id, 'growing')
    update_competency(cookies, competency_id, 'proficient')
    
    # Step 4: Try to reach Advanced (should be blocked)
    response = update_competency(
        cookies,
        competency_id,
        'advanced',
        'Trying without experience'
    )
    
    # Should be rejected
    assert response.status_code == 400
    error_msg = response.json().get('error', '').lower()
    assert 'experience' in error_msg or 'years' in error_msg
    
    # Step 5: Verify still at proficient
    competencies = get_user_competencies(cookies)
    comp = next(c for c in competencies if c['competencyId'] == competency_id)
    assert comp['status'] == 'proficient'


@pytest.mark.integration
@pytest.mark.workflow
def test_add_experience_then_upgrade_to_advanced(clean_db, test_facilitator):
    """
    Test adding missing piece enables Advanced:
    1. Start with education + try Advanced (fails)
    2. Add experience
    3. Try Advanced again (succeeds)
    """
    # Step 1: Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Step 2: Add education
    create_qualification_api(cookies, {
        "courseTitle": "Master in Translation",
        "institution": "University",
        "courseLevel": "master",
        "description": "Advanced translation studies"
    })
    
    # Step 3: Set to proficient
    competency_id = 'translation_theory'
    facilitator_id = test_facilitator['facilitator']['id']
    execute_query(
        clean_db,
        "UPDATE facilitator_competencies SET status = 'proficient' WHERE facilitator_id = %s AND competency_id = %s",
        (facilitator_id, competency_id)
    )
    
    # Step 4: Try Advanced (should fail - no experience)
    response = update_competency(cookies, competency_id, 'advanced')
    assert response.status_code == 400
    
    # Step 5: Add experience
    create_activity_api(cookies, {
        "activityType": "translation",
        "languageName": "Spanish",
        "durationYears": 5,
        "chaptersCount": 30,
        "description": "5 years translation experience"
    })
    
    # Step 6: Try Advanced again (should succeed now)
    response = update_competency(
        cookies,
        competency_id,
        'advanced',
        'Now has both pillars'
    )
    assert response.status_code == 200
    
    # Verify
    competencies = get_user_competencies(cookies)
    comp = next(c for c in competencies if c['competencyId'] == competency_id)
    assert comp['status'] == 'advanced'


# ============================================================================
# Multiple Competency Progression Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_progress_multiple_competencies_different_paces(clean_db, facilitator_with_both_pillars):
    """
    Test progressing multiple competencies at different rates:
    - Some to Advanced
    - Some to Proficient
    - Some to Growing
    """
    # Login
    user = facilitator_with_both_pillars['user']
    cookies = login_user(user['email'], user['password'])
    
    # Competency 1: Progress to Advanced
    update_competency(cookies, 'biblical_studies', 'emerging')
    update_competency(cookies, 'biblical_studies', 'growing')
    update_competency(cookies, 'biblical_studies', 'proficient')
    response = update_competency(cookies, 'biblical_studies', 'advanced')
    assert response.status_code == 200
    
    # Competency 2: Progress to Proficient
    update_competency(cookies, 'interpersonal_skills', 'emerging')
    update_competency(cookies, 'interpersonal_skills', 'growing')
    update_competency(cookies, 'interpersonal_skills', 'proficient')
    
    # Competency 3: Progress to Growing
    update_competency(cookies, 'multimodal_skills', 'emerging')
    update_competency(cookies, 'multimodal_skills', 'growing')
    
    # Verify all states
    competencies = get_user_competencies(cookies)
    
    biblical = next(c for c in competencies if c['competencyId'] == 'biblical_studies')
    assert biblical['status'] == 'advanced'
    
    interpersonal = next(c for c in competencies if c['competencyId'] == 'interpersonal_skills')
    assert interpersonal['status'] == 'proficient'
    
    multimodal = next(c for c in competencies if c['competencyId'] == 'multimodal_skills')
    assert multimodal['status'] == 'growing'


# ============================================================================
# Report Generation Workflow Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_full_portfolio_to_report_workflow(clean_db, test_facilitator):
    """
    Test complete portfolio building and report generation:
    1. Add multiple qualifications
    2. Add multiple activities
    3. Update multiple competencies
    4. Generate comprehensive report
    """
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Add qualifications
    qualifications = [
        {
            "courseTitle": "Certificate in OBT Methods",
            "institution": "YWAM",
            "courseLevel": "certificate",
            "description": "Introductory OBT training"
        },
        {
            "courseTitle": "Bachelor of Theology",
            "institution": "Seminary",
            "courseLevel": "bachelor",
            "description": "Theological foundation"
        },
        {
            "courseTitle": "Master in Biblical Languages",
            "institution": "Graduate School",
            "courseLevel": "master",
            "description": "Hebrew and Greek studies"
        }
    ]
    
    for qual in qualifications:
        response = create_qualification_api(cookies, qual)
        assert response.status_code == 200
    
    # Add activities
    activities = [
        {
            "activityType": "translation",
            "languageName": "Kosraean",
            "durationYears": 3,
            "chaptersCount": 15,
            "description": "Kosraean translation work"
        },
        {
            "activityType": "translation",
            "languageName": "Pohnpeian",
            "durationYears": 2,
            "chaptersCount": 12,
            "description": "Pohnpeian translation work"
        },
        {
            "activityType": "teaching",
            "title": "OBT Instructor",
            "organization": "Training Center",
            "durationYears": 4,
            "description": "Teaching OBT methods"
        }
    ]
    
    for activity in activities:
        response = create_activity_api(cookies, activity)
        assert response.status_code == 200
    
    # Update competencies
    competency_updates = [
        ('biblical_languages', 'proficient'),
        ('translation_theory', 'growing'),
        ('consulting_mentoring', 'emerging'),
    ]
    
    for comp_id, status in competency_updates:
        # Progress through levels
        if status == 'proficient':
            update_competency(cookies, comp_id, 'emerging')
            update_competency(cookies, comp_id, 'growing')
            update_competency(cookies, comp_id, 'proficient')
        elif status == 'growing':
            update_competency(cookies, comp_id, 'emerging')
            update_competency(cookies, comp_id, 'growing')
        else:
            update_competency(cookies, comp_id, status)
    
    # Generate report
    report_response = generate_report_api(cookies, "2024-01-01", "2024-03-31")
    assert report_response.status_code == 200
    
    # Verify report completeness
    report_data = report_response.json()
    assert report_data is not None


@pytest.mark.integration
@pytest.mark.workflow
def test_generate_multiple_reports_over_time(clean_db, test_facilitator):
    """
    Test generating reports for different periods:
    1. Generate Q1 report
    2. Add more data
    3. Generate Q2 report
    4. Verify both reports exist
    """
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Add some initial data
    create_qualification_api(cookies, {
        "courseTitle": "Initial Course",
        "institution": "University",
        "courseLevel": "bachelor",
        "description": "Initial qualification"
    })
    
    # Generate Q1 report
    q1_response = generate_report_api(cookies, "2024-01-01", "2024-03-31")
    assert q1_response.status_code == 200
    
    # Add more data
    create_activity_api(cookies, {
        "activityType": "translation",
        "languageName": "New Language",
        "durationYears": 2,
        "chaptersCount": 10,
        "description": "New translation work"
    })
    
    update_competency(cookies, 'translation_theory', 'emerging')
    
    # Generate Q2 report
    q2_response = generate_report_api(cookies, "2024-04-01", "2024-06-30")
    assert q2_response.status_code == 200
    
    # Get all reports
    reports = get_reports_api(cookies)
    
    # Should have at least 2 reports
    assert len(reports) >= 2


# ============================================================================
# Error Recovery Workflow Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_recover_from_failed_competency_update(clean_db, test_facilitator):
    """
    Test error recovery:
    1. Try invalid competency update
    2. Fix the issue
    3. Retry successfully
    """
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Try to jump to Advanced without prerequisites (should fail)
    response = update_competency(cookies, 'translation_theory', 'advanced')
    assert response.status_code == 400
    
    # Add prerequisites
    create_qualification_api(cookies, {
        "courseTitle": "Master Degree",
        "institution": "University",
        "courseLevel": "master",
        "description": "Graduate studies"
    })
    
    create_activity_api(cookies, {
        "activityType": "translation",
        "languageName": "Test",
        "durationYears": 5,
        "description": "Long experience"
    })
    
    # Progress properly
    facilitator_id = test_facilitator['facilitator']['id']
    execute_query(
        clean_db,
        "UPDATE facilitator_competencies SET status = 'proficient' WHERE facilitator_id = %s AND competency_id = 'translation_theory'",
        (facilitator_id,)
    )
    
    # Retry (should succeed now)
    response = update_competency(cookies, 'translation_theory', 'advanced')
    assert response.status_code == 200


# ============================================================================
# Concurrent Operations Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_add_qualification_and_activity_together(clean_db, test_facilitator):
    """
    Test adding qualification and activity in quick succession:
    1. Add qualification
    2. Immediately add activity
    3. Both should be reflected in profile
    """
    # Login
    user = test_facilitator['user']
    cookies = login_user(user['email'], user['password'])
    
    # Add qualification
    qual_response = create_qualification_api(cookies, {
        "courseTitle": "Bachelor Degree",
        "institution": "University",
        "courseLevel": "bachelor",
        "description": "Education pillar"
    })
    assert qual_response.status_code == 200
    
    # Immediately add activity
    activity_response = create_activity_api(cookies, {
        "activityType": "translation",
        "languageName": "Test Language",
        "durationYears": 5,
        "description": "Experience pillar"
    })
    assert activity_response.status_code == 200
    
    # Verify profile has both
    profile_response = make_api_request("GET", "/api/facilitator", cookies=cookies)
    assert profile_response.status_code == 200


# ============================================================================
# Permission and Authorization Workflow Tests
# ============================================================================

@pytest.mark.integration
@pytest.mark.workflow
def test_complete_workflow_requires_authentication(clean_db):
    """
    Test that all workflow steps require authentication:
    1. Try each operation without login
    2. All should fail
    """
    # No login - empty cookies
    empty_cookies = {}
    
    # Try to add qualification
    response = create_qualification_api(empty_cookies, {
        "courseTitle": "Test",
        "institution": "Test",
        "courseLevel": "bachelor",
        "description": "Test"
    })
    assert response.status_code in [401, 403]
    
    # Try to add activity
    response = create_activity_api(empty_cookies, {
        "activityType": "translation",
        "description": "Test"
    })
    assert response.status_code in [401, 403]
    
    # Try to update competency
    response = update_competency(empty_cookies, 'translation_theory', 'advanced')
    assert response.status_code in [401, 403]
    
    # Try to generate report
    response = generate_report_api(empty_cookies, "2024-01-01", "2024-03-31")
    assert response.status_code in [401, 403]

