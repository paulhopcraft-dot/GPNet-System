import cron from 'node-cron';
import { workerInfoSheetService } from './workerInfoSheetService';

/**
 * Background job to check and escalate Worker Info Sheets
 * Runs every 6 hours: 00:00, 06:00, 12:00, 18:00
 */
export function startWorkerInfoSheetJob() {
  // Run every 6 hours at the top of the hour
  // Cron expression: "0 */6 * * *" means "at minute 0 of every 6th hour"
  cron.schedule('0 */6 * * *', async () => {
    console.log('🕒 Worker Info Sheet escalation job started');
    
    try {
      await workerInfoSheetService.checkAndEscalate();
      console.log('✅ Worker Info Sheet escalation job completed successfully');
    } catch (error) {
      console.error('❌ Worker Info Sheet escalation job failed:', error);
    }
  }, {
    timezone: 'Australia/Sydney' // Adjust timezone as needed
  });

  console.log('✅ Worker Info Sheet escalation job scheduled (runs every 6 hours)');
  
  // Also run immediately on startup for testing
  setTimeout(async () => {
    console.log('🚀 Running initial Worker Info Sheet check on startup...');
    try {
      await workerInfoSheetService.checkAndEscalate();
      console.log('✅ Initial Worker Info Sheet check completed');
    } catch (error) {
      console.error('❌ Initial Worker Info Sheet check failed:', error);
    }
  }, 5000); // Wait 5 seconds after startup
}
