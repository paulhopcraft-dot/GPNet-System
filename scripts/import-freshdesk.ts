#!/usr/bin/env tsx

/**
 * Import all non-closed tickets from Freshdesk
 * Run: npx tsx scripts/import-freshdesk.ts
 */

import { FreshdeskImportService } from '../server/freshdeskImportService.js';
import { storage } from '../server/storage.js';

async function main() {
  console.log('🚀 Starting Freshdesk import...');
  console.log('This will import all non-closed tickets from Freshdesk\n');

  try {
    const importService = new FreshdeskImportService(storage);
    const result = await importService.importAndCategorizeTickets();

    console.log('\n✅ Import completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   Total Tickets: ${result.totalTickets}`);
    console.log(`   Total Companies: ${result.totalCompanies}`);
    console.log(`   Open: ${result.summary.openTickets}`);
    console.log(`   Pending: ${result.summary.pendingTickets}`);
    console.log(`   Resolved: ${result.summary.resolvedTickets}`);
    console.log(`   Average Age: ${result.summary.avgTicketAge.toFixed(1)} days\n`);

    if (Object.keys(result.ticketsByCompany).length > 0) {
      console.log('📋 Tickets by Company:');
      for (const [companyName, data] of Object.entries(result.ticketsByCompany)) {
        console.log(`   ${companyName}: ${data.tickets.length} tickets`);
      }
    }

    if (result.unmappedTickets.length > 0) {
      console.log(`\n⚠️  Unmapped Tickets: ${result.unmappedTickets.length}`);
      console.log('   (These tickets don\'t have a company assigned)');
    }

    console.log('\n✨ All tickets are now synced to your GPNet2 Dashboard!');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Import failed:', error);
    if (error instanceof Error) {
      console.error('   Error:', error.message);
    }
    process.exit(1);
  }
}

main();
