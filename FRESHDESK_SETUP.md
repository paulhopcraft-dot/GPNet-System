# Freshdesk Integration Setup

## Configuration Required

To connect your GPNet system with Freshdesk, please configure the following environment variables:

### Required Environment Variables:
- `FRESHDESK_API_KEY` - Your Freshdesk API key
- `FRESHDESK_DOMAIN` - Your Freshdesk domain (e.g., yourcompany.freshdesk.com)

### Where to Find Your Freshdesk Credentials:
1. **API Key**: Go to Freshdesk Admin → Profile Settings → Your API Key
2. **Domain**: The subdomain in your Freshdesk URL (e.g., if your URL is https://mycompany.freshdesk.com, then domain is "mycompany")

### How to Add Environment Variables:
1. In your Replit project, go to the "Secrets" tab 
2. Add the two environment variables listed above
3. Restart your application

Once configured, the Freshdesk integration will allow automatic ticket creation and synchronization between GPNet and your Freshdesk support system.

---
**Status**: Ready for configuration - all other system components are working properly.