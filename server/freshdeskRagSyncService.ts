import { freshdeskService } from "./freshdeskService.js";
import { embeddingService } from "./embeddingService.js";
import { freshdeskRagBackfillService, BackfillOptions } from "./freshdeskRagBackfillService.js";
import * as cron from "node-cron";

export interface SyncJobStatus {
  isRunning: boolean;
  lastRun?: Date;
  nextRun?: Date;
  lastResult?: {
    success: boolean;
    processedTickets: number;
    processedMessages: number;
    errors: string[];
    durationMs: number;
  };
}

/**
 * Service for incremental syncing of Freshdesk conversations into RAG system
 */
export class FreshdeskRagSyncService {
  private syncJob: any = null;
  private status: SyncJobStatus = { isRunning: false };

  /**
   * Start the daily sync job (runs at 2 AM daily)
   */
  startDailySync(): void {
    if (this.syncJob) {
      console.log('Daily sync job already running');
      return;
    }

    // Run at 2 AM every day
    this.syncJob = cron.schedule('0 2 * * *', async () => {
      await this.runIncrementalSync();
    });

    console.log('✅ Daily Freshdesk RAG sync job started (2 AM daily)');
    this.updateNextRunTime();
  }

  /**
   * Stop the daily sync job
   */
  stopDailySync(): void {
    if (this.syncJob) {
      this.syncJob.destroy();
      this.syncJob = null;
      console.log('⏹️ Daily Freshdesk RAG sync job stopped');
    }
  }

  /**
   * Run incremental sync manually
   */
  async runIncrementalSync(): Promise<SyncJobStatus> {
    if (this.status.isRunning) {
      console.log('Sync already in progress, skipping');
      return this.status;
    }

    console.log('🔄 Starting incremental Freshdesk RAG sync...');
    this.status.isRunning = true;
    this.status.lastRun = new Date();

    const startTime = Date.now();

    try {
      // Sync conversations from last 7 days (overlap to catch updates)
      const syncOptions: BackfillOptions = {
        months: 0.25, // ~7-8 days
        batchSize: 5, // Smaller batches for incremental sync
        includePrivateNotes: true,
        generateEmbeddings: true,
        dryRun: false
      };

      const result = await freshdeskRagBackfillService.backfillConversations(syncOptions);
      const durationMs = Date.now() - startTime;

      this.status.lastResult = {
        success: true,
        processedTickets: result.processedTickets,
        processedMessages: result.processedMessages,
        errors: result.errors,
        durationMs
      };

      console.log(`✅ Incremental sync completed: ${result.processedTickets} tickets, ${result.processedMessages} messages in ${durationMs}ms`);

    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error('❌ Incremental sync failed:', error);
      
      this.status.lastResult = {
        success: false,
        processedTickets: 0,
        processedMessages: 0,
        errors: [`Fatal error: ${error}`],
        durationMs
      };
    } finally {
      this.status.isRunning = false;
      this.updateNextRunTime();
    }

    return this.status;
  }

  /**
   * Run full backfill (manual operation)
   */
  async runFullBackfill(months = 12): Promise<SyncJobStatus> {
    if (this.status.isRunning) {
      throw new Error('Sync already in progress');
    }

    console.log(`🔄 Starting full Freshdesk RAG backfill (${months} months)...`);
    this.status.isRunning = true;
    this.status.lastRun = new Date();

    const startTime = Date.now();

    try {
      const backfillOptions: BackfillOptions = {
        months,
        batchSize: 10,
        includePrivateNotes: true,
        generateEmbeddings: true,
        dryRun: false
      };

      const result = await freshdeskRagBackfillService.backfillConversations(backfillOptions);
      const durationMs = Date.now() - startTime;

      this.status.lastResult = {
        success: true,
        processedTickets: result.processedTickets,
        processedMessages: result.processedMessages,
        errors: result.errors,
        durationMs
      };

      console.log(`✅ Full backfill completed: ${result.processedTickets} tickets, ${result.processedMessages} messages in ${durationMs}ms`);

    } catch (error) {
      const durationMs = Date.now() - startTime;
      console.error('❌ Full backfill failed:', error);
      
      this.status.lastResult = {
        success: false,
        processedTickets: 0,
        processedMessages: 0,
        errors: [`Fatal error: ${error}`],
        durationMs
      };
    } finally {
      this.status.isRunning = false;
    }

    return this.status;
  }

  /**
   * Get current sync status
   */
  getStatus(): SyncJobStatus {
    return { ...this.status };
  }

  /**
   * Update next run time based on cron schedule
   */
  private updateNextRunTime(): void {
    if (this.syncJob) {
      // Calculate next 2 AM
      const now = new Date();
      const nextRun = new Date();
      nextRun.setHours(2, 0, 0, 0);
      
      // If it's after 2 AM today, schedule for tomorrow
      if (now.getHours() >= 2) {
        nextRun.setDate(nextRun.getDate() + 1);
      }
      
      this.status.nextRun = nextRun;
    }
  }

  /**
   * Validate system health before sync
   */
  private async validateSystemHealth(): Promise<boolean> {
    try {
      // Check Freshdesk availability
      if (!freshdeskService.isAvailable()) {
        console.warn('Freshdesk service not available');
        return false;
      }

      // Check embedding service health
      const stats = await embeddingService.getEmbeddingStats();
      console.log(`System health: ${stats.totalMessages} messages, ${stats.embeddedMessages} embeddings`);
      
      return true;
    } catch (error) {
      console.error('System health check failed:', error);
      return false;
    }
  }
}

export const freshdeskRagSyncService = new FreshdeskRagSyncService();

// Auto-start sync job if not in test environment
if (process.env.NODE_ENV !== 'test') {
  setTimeout(() => {
    freshdeskRagSyncService.startDailySync();
  }, 5000); // Start after 5 seconds to let other services initialize
}