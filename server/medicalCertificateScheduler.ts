import type { IStorage } from './storage.js';
import { createMedicalCertificateReminderService } from './medicalCertificateReminderService.js';

/**
 * Medical Certificate Scheduler
 * Runs daily to check for expiring certificates and send reminders
 */
export class MedicalCertificateScheduler {
  private storage: IStorage;
  private reminderService: any;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor(storage: IStorage) {
    this.storage = storage;
    this.reminderService = createMedicalCertificateReminderService(storage);
  }

  /**
   * Start the medical certificate reminder scheduler
   * Runs daily to check for certificates expiring in 7 days
   */
  start(): void {
    if (this.schedulerInterval) {
      console.log('Medical certificate scheduler already running');
      return;
    }

    console.log('Starting medical certificate reminder scheduler (daily checks)');
    
    // Run immediately on startup
    this.runDailyCheck();
    
    // Then run every 24 hours
    this.schedulerInterval = setInterval(async () => {
      await this.runDailyCheck();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
      console.log('Medical certificate scheduler stopped');
    }
  }

  /**
   * Run the daily check for expiring certificates
   */
  private async runDailyCheck(): Promise<void> {
    try {
      console.log(`[${new Date().toISOString()}] Running daily medical certificate expiry check...`);
      
      await this.reminderService.checkExpiringCertificates();
      
      console.log('Daily medical certificate check completed successfully');
    } catch (error) {
      console.error('Error in daily medical certificate check:', error);
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; nextCheck?: Date; checkInterval: number } {
    return {
      isRunning: this.schedulerInterval !== null,
      nextCheck: this.schedulerInterval ? new Date(Date.now() + this.CHECK_INTERVAL) : undefined,
      checkInterval: this.CHECK_INTERVAL
    };
  }

  /**
   * Manually trigger a check (for testing/admin purposes)
   */
  async triggerManualCheck(): Promise<void> {
    console.log('Manual medical certificate check triggered');
    await this.runDailyCheck();
  }
}

// Export factory function instead of singleton
export const createMedicalCertificateScheduler = (storage: IStorage) => {
  return new MedicalCertificateScheduler(storage);
};