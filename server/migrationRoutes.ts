import { Router, Request, Response } from 'express';
import { requireSuperuser } from './adminRoutes.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// Endpoint to export development data
router.post('/export-dev-data', requireSuperuser, async (req: Request, res: Response) => {
  try {
    const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE } = process.env;
    
    if (!PGHOST || !PGUSER || !PGPASSWORD || !PGDATABASE) {
      return res.status(500).json({ error: 'Database configuration missing' });
    }

    // Export all critical tables
    const tables = [
      'tickets',
      'workers', 
      'organizations',
      'analyses',
      'form_submissions',
      'admin_users',
      'client_users',
      'email_threads',
      'medical_certificates'
    ];

    const exportPath = '/tmp/gpnet_production_export.sql';
    const tablesArg = tables.map(t => `-t ${t}`).join(' ');
    
    const command = `PGPASSWORD="${PGPASSWORD}" pg_dump -h ${PGHOST} -U ${PGUSER} -d ${PGDATABASE} ${tablesArg} --data-only --column-inserts > ${exportPath}`;
    
    await execAsync(command);

    // Read the file and send it
    const fs = await import('fs');
    const sqlContent = fs.readFileSync(exportPath, 'utf8');

    res.json({
      success: true,
      message: `Exported ${tables.length} tables`,
      sqlFile: sqlContent,
      instructions: 'Copy this SQL and run it in your production database via Replit Database interface'
    });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;
