#!/bin/bash
# JotForm Injury Webhook Test - Module 1 WIS Fields

WEBHOOK_URL="http://0.0.0.0:5000/api/webhook/injury"

echo "🧪 Testing JotForm Injury Webhook with Module 1 WIS Fields..."

curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Smith",
    "email": "john.smith@example.com",
    "phone": "0412345678",
    "employeeId": "EMP001",
    
    "managerName": "Sarah Johnson",
    "managerEmail": "sarah.j@company.com",
    "managerPhone": "0423456789",
    
    "injuryDate": "2024-01-15T10:30:00",
    "injuryLocation": "Warehouse Bay 3",
    "description": "Worker slipped on wet floor while carrying boxes",
    "activityAtTime": "Moving stock from delivery to storage",
    "witnesses": "Mike Chen (0434567890)",
    
    "ambulanceCalled": "Yes",
    "hospitalAttended": "Yes",
    "hospitalName": "St Vincents Hospital",
    "doctorSeen": "Yes",
    "firstAidAdministered": "Yes",
    "firstAidDetails": "Ice pack applied to knee",
    
    "currentLocation": "In hospital",
    "workStatus": "Off work",
    "expectedTimeOff": "1 week",
    
    "underPerformanceManagement": "No",
    "previousInjuries": "No",
    "additionalInfo": "Floor was recently mopped, no warning sign visible",
    
    "caseId": "TEST-001",
    "companyId": "ORG-123"
  }'

echo -e "\n\n✅ Test payload sent! Check server logs for processing details."
