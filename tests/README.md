# Integration Tests - OBT Mentor Companion

## Overview

This test suite provides comprehensive integration tests for the OBT Mentor Companion API using **pytest** with a **functional programming approach**.

### Key Features

- ✅ **Functional Approach**: Pure functions, no classes
- ✅ **Real Database**: Tests run against actual PostgreSQL database
- ✅ **API Testing**: Tests HTTP endpoints via REST API
- ✅ **Comprehensive Coverage**: Competencies, Qualifications, Activities, Reports, Full Workflows
- ✅ **Business Rule Validation**: Tests all critical business logic (downgrades, Advanced requirements, etc.)

## Prerequisites

### 1. Python Setup

```bash
# Install Python 3.9+ (if not already installed)
# On macOS:
brew install python@3.11

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install test dependencies
pip install -r requirements-test.txt
```

### 2. Database Setup

You need a separate test database to avoid affecting your development data:

```bash
# Create test database (PostgreSQL)
createdb obt_test

# Or using psql:
psql -U postgres -c "CREATE DATABASE obt_test;"
```

### 3. Environment Variables

Create a `.env.test` file in the project root:

```bash
# Test Database
TEST_DATABASE_URL=postgresql://username:password@localhost:5432/obt_test

# Test API URL (should be running locally)
TEST_API_URL=http://localhost:5000

# Copy from your main .env (needed to start server)
DATABASE_URL=postgresql://username:password@localhost:5432/obt_test
GOOGLE_API_KEY=your_key_here
QDRANT_URL=your_qdrant_url
QDRANT_API_KEY=your_qdrant_key
SESSION_SECRET=test-secret-key-32-chars-min
```

### 4. Start the API Server

Tests require the API server to be running:

```bash
# In a separate terminal
source .env.test  # Load test environment
npm run dev       # Start development server
```

## Running Tests

### Run All Tests

```bash
# Activate virtual environment
source venv/bin/activate

# Run all integration tests
pytest tests/

# Run with verbose output
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=server --cov-report=html
```

### Run Specific Test Files

```bash
# Run only competency tests
pytest tests/test_competency_integration.py -v

# Run only qualification tests
pytest tests/test_qualification_integration.py -v

# Run only activity tests
pytest tests/test_activity_integration.py -v

# Run only full workflow tests
pytest tests/test_full_workflow.py -v
```

### Run Tests by Marker

```bash
# Run only competency-related tests
pytest tests/ -m competency -v

# Run only qualification-related tests
pytest tests/ -m qualification -v

# Run only activity-related tests
pytest tests/ -m activity -v

# Run only workflow tests
pytest tests/ -m workflow -v
```

### Run Specific Tests

```bash
# Run a single test function
pytest tests/test_competency_integration.py::test_prevent_competency_downgrade -v

# Run all tests matching a pattern
pytest tests/ -k "advanced" -v  # All tests with "advanced" in name
pytest tests/ -k "downgrade" -v  # All tests with "downgrade" in name
```

### Parallel Execution

```bash
# Install pytest-xdist
pip install pytest-xdist

# Run tests in parallel (faster)
pytest tests/ -n auto
```

## Test Structure

```
tests/
├── __init__.py                    # Package marker
├── conftest.py                    # Fixtures and test utilities
├── test_competency_integration.py # Competency workflow tests
├── test_qualification_integration.py # Qualification workflow tests
├── test_activity_integration.py   # Activity workflow tests
└── test_full_workflow.py          # End-to-end workflow tests
```

## Test Categories

### 1. Competency Tests (`test_competency_integration.py`)

Tests competency update logic and business rules:

- ✅ Prevent competency downgrades
- ✅ Reject Advanced without education
- ✅ Reject Advanced without experience
- ✅ Allow Advanced with both pillars
- ✅ Valid progression through levels
- ✅ Change history tracking
- ✅ Multiple competency updates
- ✅ Error handling

### 2. Qualification Tests (`test_qualification_integration.py`)

Tests qualification management:

- ✅ Create qualifications (all levels: Introduction, Certificate, Bachelor, Master, Doctoral)
- ✅ Validation rules (required fields, invalid levels)
- ✅ Retrieval and filtering
- ✅ Updates and deletion
- ✅ Auto-scoring impact on competencies
- ✅ Authorization checks

### 3. Activity Tests (`test_activity_integration.py`)

Tests mentorship activity tracking:

- ✅ Create activities (all types: Translation, Facilitation, Teaching, etc.)
- ✅ Translation activities with language and chapters
- ✅ Duration tracking (years + months)
- ✅ Totals calculation (languages, chapters)
- ✅ Validation rules
- ✅ Integration with competency scoring

### 4. Full Workflow Tests (`test_full_workflow.py`)

Tests complete user journeys:

- ✅ Complete journey to Advanced level
- ✅ Incomplete journey blocks Advanced
- ✅ Adding missing piece enables Advanced
- ✅ Multiple competencies at different paces
- ✅ Portfolio building and report generation
- ✅ Multiple reports over time
- ✅ Error recovery
- ✅ Concurrent operations
- ✅ Authentication requirements

## Functional Approach

All tests follow functional programming principles:

### Pure Functions

```python
# Good: Pure function
def create_test_user(conn, email: str) -> dict:
    """Create user and return data."""
    # No side effects outside database
    return execute_query(conn, query, params)

# Bad: Class-based (not used)
class UserFactory:
    def create_user(self):
        pass
```

### Composable Helpers

```python
# Compose operations
user = create_test_user(conn, "test@example.com")
facilitator = create_test_facilitator(conn, user['id'])
cookies = login_user(user['email'], user['password'])
response = update_competency(cookies, 'translation_theory', 'advanced')
```

### Immutable Data

```python
# Data flows through functions
data = {
    "courseTitle": "Bachelor",
    "courseLevel": "bachelor",
    "description": "Test"
}

response = create_qualification_api(cookies, data)
# data remains unchanged
```

## Key Business Rules Tested

### 1. Advanced Competency Requirements

**Rule**: Advanced level requires BOTH:
- Education: Bachelor, Master, or Doctoral degree
- Experience: 3+ years in relevant activities

**Tests**:
- `test_reject_advanced_without_education`
- `test_reject_advanced_without_experience`
- `test_allow_advanced_with_both_pillars`

### 2. No Competency Downgrades

**Rule**: Once a competency reaches a level, it cannot be downgraded.

**Tests**:
- `test_prevent_competency_downgrade`

### 3. Valid Competency Progression

**Rule**: Competencies progress through: Not Started → Emerging → Growing → Proficient → Advanced

**Tests**:
- `test_allow_valid_progression`

### 4. Activity Totals

**Rule**: Translation activities update:
- `totalLanguagesMentored` (count of unique languages)
- `totalChaptersMentored` (sum of all chapters)

**Tests**:
- `test_activity_updates_language_count`
- `test_activity_updates_chapter_count`
- `test_multiple_translation_activities_cumulative`

## Troubleshooting

### Tests Fail with Database Connection Error

```bash
# Check database exists
psql -l | grep obt_test

# Check connection string in .env.test
echo $TEST_DATABASE_URL
```

### Tests Fail with 401/403 Errors

```bash
# Ensure API server is running
curl http://localhost:5000/health

# Check session configuration in server
```

### Tests Fail with "Table does not exist"

```bash
# Run database migrations
npm run db:push
```

### Clean Test Database

```bash
# If tests leave dirty data
psql -d obt_test -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Then re-run migrations
npm run db:push
```

## Continuous Integration

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: obt_test
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install Node dependencies
        run: npm install
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install Python dependencies
        run: pip install -r requirements-test.txt
      
      - name: Run migrations
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/obt_test
        run: npm run db:push
      
      - name: Start API server
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/obt_test
          NODE_ENV: test
        run: npm run dev &
      
      - name: Wait for server
        run: sleep 5
      
      - name: Run integration tests
        env:
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/obt_test
          TEST_API_URL: http://localhost:5000
        run: pytest tests/ -v
```

## Best Practices

1. **Always use fixtures**: Use `clean_db`, `test_user`, `test_facilitator` fixtures
2. **Test isolation**: Each test should be independent
3. **Clear assertions**: Use descriptive assertion messages
4. **Test both success and failure**: Test happy path and error cases
5. **Functional composition**: Build complex scenarios from simple functions
6. **Meaningful test names**: Name tests after what they verify

## Contributing

When adding new tests:

1. Follow functional programming style (no classes)
2. Use existing fixtures and helpers from `conftest.py`
3. Add appropriate pytest markers (`@pytest.mark.integration`, etc.)
4. Document complex test scenarios
5. Ensure tests are independent and repeatable

## Support

For issues or questions:
1. Check this README
2. Review test examples in existing files
3. Check `conftest.py` for available fixtures and helpers
4. Run tests with `-v` for detailed output

