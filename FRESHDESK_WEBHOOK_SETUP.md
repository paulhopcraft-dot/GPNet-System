# Freshdesk Webhook Setup for Real-Time Sync

## Overview
Your GPNet system already has a webhook endpoint ready to receive real-time updates from Freshdesk. Follow these steps to configure Freshdesk to send notifications whenever tickets are created or updated.

## Step 1: Get Your Webhook URL

Your webhook endpoint URL will be:
```
https://your-replit-app.replit.app/api/medical-documents/freshdesk-webhook
```

Replace `your-replit-app` with your actual Replit app URL.

## Step 2: Configure Freshdesk Automation Rules

### Option A: Using Freshdesk Automation Rules (Recommended)

1. **Login to Freshdesk Admin Panel**
   - Go to: https://yourdomain.freshdesk.com/admin
   
2. **Navigate to Automation**
   - Click "Admin" → "Workflows" → "Automations"

3. **Create Ticket Creation Rule**
   - Click "New Rule" under "Ticket Creation"
   - Name: "Sync New Tickets to GPNet"
   - **Conditions**: All new tickets
   - **Actions**: 
     - Trigger Webhook → POST
     - URL: `https://your-replit-app.replit.app/api/medical-documents/freshdesk-webhook`
     - Content Type: JSON
     - Body: 
     ```json
     {
       "type": "ticket_created",
       "ticket": {
         "id": "{{ticket.id}}",
         "subject": "{{ticket.subject}}",
         "status": "{{ticket.status}}",
         "priority": "{{ticket.priority}}",
         "requester_id": "{{ticket.requester_id}}",
         "company_id": "{{ticket.company_id}}",
         "attachments": []
       },
       "requester": {
         "id": "{{ticket.requester_id}}",
         "name": "{{ticket.requester.name}}",
         "email": "{{ticket.requester.email}}"
       },
       "time_stamp": "{{ticket.created_at}}"
     }
     ```

4. **Create Ticket Update Rule**
   - Click "New Rule" under "Ticket Updates"
   - Name: "Sync Ticket Updates to GPNet"
   - **Conditions**: When ticket is updated
   - **Actions**: Same webhook as above, but change `"type": "ticket_updated"`

5. **Create Note Added Rule** (Optional)
   - Click "New Rule" under "Ticket Updates"
   - Name: "Sync Notes to GPNet"  
   - **Conditions**: When a note is added
   - **Actions**: Same webhook with `"type": "note_added"`

### Option B: Using Freshdesk Webhooks (If Available)

Some Freshdesk plans support native webhook configuration:

1. **Go to Admin → Workflows → Webhooks**
2. **Create New Webhook**
   - Name: "GPNet Real-Time Sync"
   - URL: `https://your-replit-app.replit.app/api/medical-documents/freshdesk-webhook`
   - Events to Monitor:
     - ✅ Ticket Created
     - ✅ Ticket Updated
     - ✅ Note Added (if you want notes synced)

3. **Save and Activate**

## Step 3: Optional - Add Webhook Secret for Security

For added security, you can configure a webhook secret:

1. **Add Secret to Replit**
   - Go to your Replit Secrets tab
   - Add: `FRESHDESK_WEBHOOK_SECRET` with a random string (e.g., `your-secret-key-123`)

2. **Configure Freshdesk** (if your plan supports it)
   - Some Freshdesk plans allow you to add custom headers
   - Add header: `X-Freshdesk-Signature` with your secret

**Note**: The webhook works WITHOUT a secret (it validates the payload structure), but adding a secret provides extra security.

## Step 4: Test the Integration

### Manual Test

Send a test webhook to verify it's working:

```bash
curl -X POST https://your-replit-app.replit.app/api/medical-documents/freshdesk-webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ticket_created",
    "ticket": {
      "id": 12345,
      "subject": "Test Ticket",
      "status": 2,
      "priority": 1,
      "requester_id": 67890,
      "company_id": 100,
      "attachments": []
    },
    "requester": {
      "id": 67890,
      "name": "Test User",
      "email": "test@example.com"
    },
    "time_stamp": "2024-01-15T10:30:00Z"
  }'
```

Expected response:
```json
{
  "success": true,
  "message": "Webhook processed successfully",
  "ticketSynced": true,
  "processed_attachments": 0
}
```

### Live Test in Freshdesk

1. **Create a Test Ticket** in Freshdesk
2. **Check Your GPNet2 Dashboard** - The ticket should appear within seconds
3. **Update the Ticket** in Freshdesk
4. **Refresh Dashboard** - Changes should sync immediately

## What Gets Synced in Real-Time

When webhooks are configured, the following updates sync instantly:

✅ **New Tickets** - Created in database immediately  
✅ **Ticket Updates** - Status, priority, subject changes  
✅ **Worker Information** - Requester name, email, company  
✅ **Attachments** - Medical documents downloaded and processed  
✅ **Risk Assessments** - Automatic analysis triggered  
✅ **Compliance Status** - Updated based on ticket data

## Troubleshooting

### Webhook Not Firing

1. **Check Freshdesk Automation Rules**
   - Go to Admin → Workflows → Automations
   - Check "Execution Log" to see if rules are running

2. **Verify URL is Correct**
   - Make sure the Replit app URL is accessible
   - Try accessing it in a browser (should return 404 for GET requests, which is normal)

3. **Check Webhook Logs**
   - In Replit, check the console logs
   - You should see: `"Received Freshdesk webhook for medical document processing"`

### Data Not Appearing in Dashboard

1. **Check Database Connection**
   - Verify `DATABASE_URL` is set in Replit Secrets

2. **Verify Freshdesk Credentials**
   - Check `FRESHDESK_API_KEY` and `FRESHDESK_DOMAIN` are set

3. **Check Organization Mapping**
   - Webhook creates tickets, but they need to be linked to an organization
   - Use the admin panel to verify organization settings

## Advanced Configuration

### Custom Webhook Payload

If you need to customize which fields are synced, modify the webhook body in Freshdesk automation:

```json
{
  "type": "ticket_updated",
  "ticket": {
    "id": "{{ticket.id}}",
    "subject": "{{ticket.subject}}",
    "status": "{{ticket.status}}",
    "priority": "{{ticket.priority}}",
    "requester_id": "{{ticket.requester_id}}",
    "company_id": "{{ticket.company_id}}",
    "custom_fields": {
      "cf_work_status": "{{ticket.cf_work_status}}",
      "cf_risk_level": "{{ticket.cf_risk_level}}"
    }
  }
}
```

### Rate Limiting

The webhook endpoint is configured to handle:
- **High volume**: Up to 5000 requests per 15 minutes for authenticated users
- **Automatic retries**: If webhook fails, Freshdesk will retry
- **Background processing**: Attachments processed asynchronously

## Summary

Once configured, your GPNet2 dashboard will automatically update whenever:
- A new ticket is created in Freshdesk
- An existing ticket is updated
- Attachments are added to tickets
- Notes are added (if configured)

**No manual sync needed!** The dashboard always shows the latest data from Freshdesk.

---

**Need Help?** Check the webhook execution logs in Replit console for detailed debugging information.
