# ChatGPT Integration Setup Guide

This guide will help you connect ChatGPT directly to your GPNet case management system, allowing you to interact with cases, workers, and health assessments through natural conversation.

## Overview

The ChatGPT integration provides:
- **Worker Search & Management**: Find and view worker information
- **Case Management**: Create, update, and track cases
- **Health Assessments**: View risk scores and recommendations
- **System Statistics**: Monitor case volumes and priorities
- **Case Notes**: Add notes and comments to cases

## Prerequisites

1. **ChatGPT Plus or Enterprise account** (required for Custom GPTs)
2. **Published Replit deployment** of your GPNet system
3. **API key** for authentication

## Step 1: Set Up Authentication

### 1.1 Generate an API Key

Create a secure API key for ChatGPT to access your system:

1. Go to your Replit Secrets (🔒 icon in left sidebar)
2. Add a new secret:
   - **Name**: `CHATGPT_API_KEY`
   - **Value**: Generate a secure random string (e.g., `gpnet_chatgpt_2024_YOUR_RANDOM_STRING`)

**Security Tip**: Use a strong, unique key. You can generate one with:
```bash
openssl rand -base64 32
```

### 1.2 Get Your Replit Domain

After publishing your Replit app, note your domain:
- Format: `https://YOUR-PROJECT-NAME.YOUR-USERNAME.replit.app`
- Example: `https://gpnet-case-management.johndoe.replit.app`

## Step 2: Create Custom GPT in ChatGPT

### 2.1 Access GPT Builder

1. Go to [ChatGPT](https://chat.openai.com)
2. Click your profile picture → **My GPTs**
3. Click **+ Create a GPT**

### 2.2 Configure GPT Details

In the **Create** tab:

**Name**: 
```
GPNet Case Manager
```

**Description**:
```
AI assistant for managing occupational health cases, workers, and assessments in GPNet. Search cases, update statuses, view health reports, and manage workflows.
```

**Instructions**:
```
You are an AI assistant for the GPNet occupational health case management system. You help users:

1. Search and view worker information
2. Find and manage cases (pre-employment, injury, mental health, return-to-work)
3. View health assessment results and risk scores
4. Update case statuses and next steps
5. Add notes to cases
6. Monitor system statistics

IMPORTANT BEHAVIORS:
- Always search for workers before accessing their cases
- When creating cases, verify the worker exists first
- Provide clear summaries of case information
- Highlight red flags and high-priority cases
- Suggest appropriate next steps based on case type and status

CASE STATUS WORKFLOW:
- NEW: Just created, needs initial review
- ANALYSING: Under assessment
- AWAITING_REVIEW: Needs manager review
- READY_TO_SEND: Report ready for delivery
- COMPLETE: Case closed

When users ask about cases, provide:
- Worker name and role
- Case type and status
- Priority level
- Risk flags (Red/Amber/Green)
- Next steps required
- Any health restrictions or recommendations
```

### 2.3 Add Actions (API Integration)

1. Switch to the **Configure** tab
2. Scroll to **Actions** section
3. Click **Create new action**
4. Click **Import from URL**
5. Enter your OpenAPI spec URL:
   ```
   https://YOUR-REPLIT-DOMAIN.replit.app/api/chatgpt/openapi.json
   ```
6. Click **Import**

### 2.4 Configure Authentication

After importing the OpenAPI spec:

1. In the **Authentication** section, select **API Key**
2. Configure:
   - **Auth Type**: API Key
   - **API Key**: Enter your `CHATGPT_API_KEY` value
   - **Auth Header Name**: `Authorization`
   - **Auth Header Value Format**: `Bearer {api_key}`

3. Click **Save**

### 2.5 Privacy Settings

Set the privacy level:
- **Only me**: Private, for your use only
- **Anyone with a link**: Share with your team
- **Public**: Listed in GPT store (not recommended for internal tools)

### 2.6 Publish Your GPT

1. Click **Save** in the top-right
2. Choose who can access it
3. Click **Confirm**

## Step 3: Test the Integration

### 3.1 Basic Tests

Try these prompts in your new GPT:

**Search Workers**:
```
Find a worker named John Smith
```

**View Cases**:
```
Show me all high-priority cases
```

**Get Case Details**:
```
Show me details for case [CASE_ID]
```

**Create a Case**:
```
Create a pre-employment case for worker [WORKER_ID]
```

**Update Status**:
```
Update case [CASE_ID] to AWAITING_REVIEW status
```

**Add Notes**:
```
Add a note to case [CASE_ID]: "Waiting for medical certificate"
```

**System Stats**:
```
What are the current system statistics?
```

### 3.2 Advanced Workflows

**Complex Case Management**:
```
Find all injury cases for workers at the Melbourne site, 
show their current status and next steps
```

**Health Assessment Review**:
```
Show me all cases with red flags that need urgent attention
```

**Worker Overview**:
```
Give me a complete overview of worker [NAME], including 
all their cases and current health status
```

## Step 4: Troubleshooting

### Common Issues

#### 401 Unauthorized Error
- **Cause**: API key mismatch
- **Fix**: Verify `CHATGPT_API_KEY` in Replit secrets matches the key in your GPT configuration

#### 404 Not Found
- **Cause**: Incorrect Replit domain or app not published
- **Fix**: Ensure your app is published and domain is correct in OpenAPI spec

#### No Data Returned
- **Cause**: Empty database or incorrect filters
- **Fix**: Check that you have test data in your system

#### Connection Timeout
- **Cause**: Replit app asleep or slow to wake
- **Fix**: Visit your Replit domain in a browser to wake the app, then retry

### Debug Mode

To debug API calls:

1. In ChatGPT, look for the "Used [Action Name]" indicator
2. Click to expand and view request/response
3. Check for error messages in the response

### Verify API Manually

Test your API with curl:

```bash
# Get stats
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://YOUR-REPLIT-DOMAIN.replit.app/api/chatgpt/stats

# Search workers
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://YOUR-REPLIT-DOMAIN.replit.app/api/chatgpt/workers/search?query=John"
```

## API Endpoints Reference

### Worker Endpoints
- `GET /api/chatgpt/workers/search?query={term}` - Search workers
- `GET /api/chatgpt/workers/{workerId}` - Get worker details

### Case Endpoints
- `GET /api/chatgpt/cases/search` - Search cases with filters
- `GET /api/chatgpt/cases/{caseId}` - Get case details
- `POST /api/chatgpt/cases` - Create new case
- `PATCH /api/chatgpt/cases/{caseId}/status` - Update status
- `POST /api/chatgpt/cases/{caseId}/notes` - Add note

### System Endpoints
- `GET /api/chatgpt/stats` - Get system statistics

## Security Best Practices

1. **Keep API Keys Secret**: Never share or commit API keys
2. **Rotate Keys Regularly**: Change your API key every 90 days
3. **Monitor Usage**: Check Replit logs for unauthorized access
4. **Limit Scope**: Only share GPT with authorized team members
5. **Use HTTPS**: Always use secure connections (Replit provides this)

## Next Steps

Once your integration is working:

1. **Train Your Team**: Share the GPT with case managers
2. **Create Workflows**: Define common prompts for daily tasks
3. **Monitor Usage**: Track how the integration improves efficiency
4. **Extend Functionality**: Add more endpoints as needed

## Support

For issues or questions:
- Check Replit logs for API errors
- Review ChatGPT action debug output
- Verify OpenAPI spec is accessible
- Ensure database has test data

## Example Conversations

### Daily Workflow
```
User: What cases need my attention today?
GPT: Let me check for you...
[Shows high-priority cases with next steps]

User: Update case XYZ to ready to send
GPT: I've updated the case status. The case is now ready for report delivery.

User: Add a note that medical certificate received
GPT: Note added successfully to the case thread.
```

### Worker Assessment
```
User: Find worker Sarah Johnson
GPT: I found Sarah Johnson...
[Shows worker details]

User: Show me her cases
GPT: Sarah has 2 cases:
1. Pre-employment check - Status: COMPLETE
2. Injury assessment - Status: AWAITING_REVIEW (High priority, Red flags)

User: What are the red flags?
GPT: [Shows detailed case info with risk factors]
```

---

**Congratulations!** You can now manage GPNet cases directly through ChatGPT. 🎉
