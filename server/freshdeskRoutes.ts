import { Router } from 'express';
import { FreshdeskImportService } from './freshdeskImportService.js';
import { storage } from './storage.js';
import { requireAdmin } from './adminRoutes.js';

const router = Router();

// Initialize the import service
const freshdeskImportService = new FreshdeskImportService(storage);

/**
 * GET /api/freshdesk/status - Check Freshdesk connection status
 */
router.get('/status', requireAdmin, async (req, res) => {
  try {
    const status = FreshdeskImportService.getConnectionStatus();
    res.json(status);
  } catch (error) {
    console.error('Error checking Freshdesk status:', error);
    res.status(500).json({ 
      error: 'Failed to check Freshdesk status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/freshdesk/import - Import and categorize all tickets from Freshdesk
 */
router.post('/import', requireAdmin, async (req, res) => {
  try {
    console.log('Starting Freshdesk ticket import request...');
    
    const result = await freshdeskImportService.importAndCategorizeTickets();
    
    console.log('Freshdesk import completed successfully');
    res.json({
      success: true,
      message: 'Tickets imported and categorized successfully',
      data: result
    });

  } catch (error) {
    console.error('Freshdesk import failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to import tickets from Freshdesk',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/freshdesk/preview - Preview what would be imported (first 10 tickets)
 */
router.get('/preview', requireAdmin, async (req, res) => {
  try {
    console.log('Fetching Freshdesk preview...');
    
    // Import the service dynamically
    const { freshdeskService, FreshdeskService } = await import('./freshdeskService.js');
    
    if (!freshdeskService.isAvailable()) {
      return res.status(400).json({
        error: 'Freshdesk integration not configured',
        details: 'Please configure FRESHDESK_API_KEY and FRESHDESK_DOMAIN environment variables'
      });
    }

    // Use the public fetchAllTickets method but limit results
    const allTickets = await freshdeskService.fetchAllTickets();
    const allCompanies = await freshdeskService.fetchAllCompanies();

    // Take first 10 for preview
    const previewTickets = allTickets.slice(0, 10).map((ticket: any) => ({
      id: ticket.id,
      subject: ticket.subject,
      status: FreshdeskService.mapStatusToString(ticket.status),
      priority: FreshdeskService.mapPriorityToString(ticket.priority),
      company_id: ticket.company_id,
      created_at: ticket.created_at,
      age_days: FreshdeskService.calculateTicketAge(ticket.created_at)
    }));

    const previewCompanies = allCompanies.slice(0, 10).map((company: any) => ({
      id: company.id,
      name: company.name,
      domains: company.domains || []
    }));

    res.json({
      success: true,
      preview: {
        tickets: previewTickets,
        companies: previewCompanies,
        totalTickets: allTickets.length,
        totalCompanies: allCompanies.length,
        note: 'This is a preview of the first 10 tickets and companies. Use the import endpoint to process all data.'
      }
    });

  } catch (error) {
    console.error('Freshdesk preview failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch Freshdesk preview',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export { router as freshdeskRoutes };