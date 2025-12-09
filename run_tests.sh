#!/bin/bash
#
# Integration Test Runner for OBT Mentor Companion
# Usage: ./run_tests.sh [options]
#

set -e

# Colors for output
RED='\033[0:31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}OBT Mentor Companion - Integration Test Runner${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}Virtual environment not found. Creating...${NC}"
    python3 -m venv venv
    echo -e "${GREEN}✓ Virtual environment created${NC}"
fi

# Activate virtual environment
echo -e "${YELLOW}Activating virtual environment...${NC}"
source venv/bin/activate
echo -e "${GREEN}✓ Virtual environment activated${NC}"
echo ""

# Install/update dependencies
echo -e "${YELLOW}Installing test dependencies...${NC}"
pip install -q -r requirements-test.txt
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Check if .env.test exists
if [ ! -f ".env.test" ]; then
    echo -e "${RED}ERROR: .env.test file not found!${NC}"
    echo -e "${YELLOW}Please create .env.test with your test configuration.${NC}"
    echo -e "${YELLOW}See .env.test.example for template.${NC}"
    exit 1
fi

# Load test environment
echo -e "${YELLOW}Loading test environment...${NC}"
export $(cat .env.test | grep -v '^#' | xargs)
echo -e "${GREEN}✓ Environment loaded${NC}"
echo ""

# Check database connection
echo -e "${YELLOW}Checking database connection...${NC}"
python3 -c "
import psycopg2
import os
try:
    conn = psycopg2.connect(os.getenv('TEST_DATABASE_URL'))
    conn.close()
    print('✓ Database connection successful')
except Exception as e:
    print(f'✗ Database connection failed: {e}')
    exit(1)
"
if [ $? -ne 0 ]; then
    echo -e "${RED}ERROR: Cannot connect to test database!${NC}"
    echo -e "${YELLOW}Please check TEST_DATABASE_URL in .env.test${NC}"
    exit 1
fi
echo ""

# Check if API server is running
echo -e "${YELLOW}Checking API server...${NC}"
if curl -s "${TEST_API_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API server is running at ${TEST_API_URL}${NC}"
else
    echo -e "${RED}ERROR: API server is not running!${NC}"
    echo -e "${YELLOW}Please start the server first:${NC}"
    echo -e "  ${YELLOW}npm run dev${NC}"
    exit 1
fi
echo ""

# Run tests
echo -e "${GREEN}Running integration tests...${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""

# Parse command line arguments
if [ "$1" == "--coverage" ]; then
    pytest tests/ -v --cov=server --cov-report=html --cov-report=term
    echo ""
    echo -e "${GREEN}Coverage report generated: htmlcov/index.html${NC}"
elif [ "$1" == "--quick" ]; then
    pytest tests/ -v --tb=short
elif [ "$1" == "--parallel" ]; then
    pytest tests/ -v -n auto
elif [ "$1" == "--competency" ]; then
    pytest tests/ -v -m competency
elif [ "$1" == "--qualification" ]; then
    pytest tests/ -v -m qualification
elif [ "$1" == "--activity" ]; then
    pytest tests/ -v -m activity
elif [ "$1" == "--workflow" ]; then
    pytest tests/ -v -m workflow
elif [ "$1" == "--failed" ]; then
    pytest tests/ -v --lf  # Run only failed tests from last run
elif [ -n "$1" ]; then
    # Run specific test file or pattern
    pytest tests/ -v -k "$1"
else
    # Run all tests
    pytest tests/ -v
fi

# Check test result
if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}================================================${NC}"
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${GREEN}================================================${NC}"
else
    echo ""
    echo -e "${RED}================================================${NC}"
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${RED}================================================${NC}"
    exit 1
fi

