import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authService, AuthenticatedUser } from './authService.js';
import { storage } from './storage.js';
import { requireAdmin } from './adminRoutes.js';

const router = Router();

// Extend session interface
declare module 'express-session' {
  interface SessionData {
    user?: AuthenticatedUser;
    isAuthenticated?: boolean;
  }
}

// Validation schemas
const clientLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  organizationSlug: z.string().min(1, "Organization is required")
});

const adminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const clientRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  organizationSlug: z.string(),
  role: z.string().optional()
});

const adminRegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  isSuperuser: z.boolean().optional(),
  permissions: z.array(z.string()).optional()
});

const impersonationSchema = z.object({
  organizationId: z.string()
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8)
});

// Middleware for general authentication (any user)
export const requireAuth = async (req: Request, res: Response, next: any) => {
  // Auto-login in development for testing
  if (process.env.NODE_ENV === 'development' && (!req.session.user || !req.session.isAuthenticated)) {
    // Auto-login as test admin
    const testAdmin = await storage.getAdminUserByEmail('test@admin.com');
    if (testAdmin) {
      req.session.user = {
        id: testAdmin.id,
        email: testAdmin.email,
        name: `${testAdmin.firstName} ${testAdmin.lastName}`,
        firstName: testAdmin.firstName,
        lastName: testAdmin.lastName,
        role: 'super_user',
        userType: 'admin',
        permissions: ['admin', 'superuser'],
        isImpersonating: false
      };
      req.session.isAuthenticated = true;
      console.log('🔓 Auto-login enabled for testing - logged in as test@admin.com');
    }
  }
  
  if (!req.session.user || !req.session.isAuthenticated) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  next();
};

// Bootstrap endpoint for creating first admin when no admins exist
router.post('/bootstrap/admin', async (req: Request, res: Response) => {
  try {
    // Check if any admin users exist
    const existingAdmins = await storage.getAllAdminUsers();
    if (existingAdmins.length > 0) {
      return res.status(403).json({ 
        error: 'Bootstrap not allowed', 
        message: 'Admin users already exist in the system' 
      });
    }

    const { email, password, firstName, lastName } = adminRegisterSchema.parse(req.body);

    // Create first admin with superuser privileges
    const user = await authService.registerAdmin({
      email,
      password,
      firstName,
      lastName,
      isSuperuser: true,
      permissions: ['superuser', 'admin', 'user_management', 'system_settings']
    }, 'system-bootstrap');
    
    if (!user) {
      return res.status(400).json({ error: 'Admin creation failed' });
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperuser: true,
        permissions: user.permissions
      },
      message: 'Bootstrap admin created successfully'
    });
  } catch (error) {
    console.error('Bootstrap admin creation error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});


// Client authentication routes
router.post('/login/client', async (req: Request, res: Response) => {
  try {
    const { email, password, organizationSlug } = clientLoginSchema.parse(req.body);
    
    // Get organization by slug (required)
    const organization = await storage.getOrganizationBySlug(organizationSlug);
    if (!organization) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const user = await authService.authenticateClient(email, password, organization.id);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      // Create session
      const authenticatedUser = authService.userToAuthenticatedUser(user, 'client');
      req.session.user = authenticatedUser;
      req.session.isAuthenticated = true;
      req.session.save(() => {});

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          organizationId: user.organizationId
        },
        message: 'Login successful'
      });
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

router.post('/register/client', async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, organizationSlug, role } = clientRegisterSchema.parse(req.body);
    
    // Get organization by slug
    const organization = await storage.getOrganizationBySlug(organizationSlug);
    if (!organization) {
      return res.status(400).json({ error: 'Organization not found' });
    }

    const user = await authService.registerClient({
      email,
      password,
      firstName,
      lastName,
      organizationId: organization.id,
      role
    });
    
    if (!user) {
      return res.status(400).json({ error: 'User already exists or registration failed' });
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId
      },
      message: 'Registration successful'
    });
  } catch (error) {
    console.error('Client registration error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// Admin authentication routes
router.post('/login/admin', async (req: Request, res: Response) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);

    const user = await authService.authenticateAdmin(email, password);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Regenerate session to prevent fixation attacks
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ error: 'Session error' });
      }

      // Create session
      const authenticatedUser = authService.userToAuthenticatedUser(user, 'admin');
      req.session.user = authenticatedUser;
      req.session.isAuthenticated = true;
      req.session.save(() => {});

      res.json({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          userType: 'admin',
          isSuperuser: (user as any).isSuperuser,
          permissions: user.permissions,
          currentImpersonationTarget: user.currentImpersonationTarget
        },
        message: 'Admin login successful'
      });
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

router.post('/register/admin', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { email, password, firstName, lastName, isSuperuser, permissions } = adminRegisterSchema.parse(req.body);

    const user = await authService.registerAdmin({
      email,
      password,
      firstName,
      lastName,
      isSuperuser,
      permissions
    }, req.session.user!.id);
    
    if (!user) {
      return res.status(400).json({ error: 'Admin already exists or registration failed' });
    }

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperuser: (user as any).isSuperuser,
        permissions: user.permissions
      },
      message: 'Admin registration successful'
    });
  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// Session management
router.post('/logout', (req: Request, res: Response) => {
  if (req.session.user) {
    const userId = req.session.user.id;
    const userType = req.session.user.role;
    
    req.session.destroy((err) => {
      if (err) {
        console.error('Session destruction error:', err);
        return res.status(500).json({ error: 'Logout failed' });
      }
      
      // Clear session cookie (match the session name from config)
      res.clearCookie('gpnet.sid');
      
      // Audit logging will be handled by session middleware if implemented
      
      res.json({ message: 'Logout successful' });
    });
  } else {
    res.json({ message: 'No active session' });
  }
});

router.get('/session', (req: Request, res: Response) => {
  if (req.session.user && req.session.isAuthenticated) {
    res.json({
      user: req.session.user,
      isAuthenticated: true
    });
  } else {
    res.json({
      user: null,
      isAuthenticated: false
    });
  }
});

// Admin impersonation routes
router.post('/impersonate/start', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { organizationId } = impersonationSchema.parse(req.body);
    
    const updatedAdmin = await authService.startImpersonation(req.session.user!.id, organizationId);
    
    if (!updatedAdmin) {
      return res.status(400).json({ error: 'Impersonation failed' });
    }

    // Update session
    req.session.user!.isImpersonating = true;
    req.session.user!.impersonationTarget = organizationId;

    res.json({
      message: 'Impersonation started',
      impersonationTarget: organizationId
    });
  } catch (error) {
    console.error('Impersonation start error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

router.post('/impersonate/stop', requireAdmin, async (req: Request, res: Response) => {
  try {
    const updatedAdmin = await authService.stopImpersonation(req.session.user!.id);
    
    if (!updatedAdmin) {
      return res.status(400).json({ error: 'Stop impersonation failed' });
    }

    // Update session
    req.session.user!.isImpersonating = false;
    req.session.user!.impersonationTarget = undefined;

    res.json({
      message: 'Impersonation stopped'
    });
  } catch (error) {
    console.error('Impersonation stop error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Password management
router.post('/password/change', async (req: Request, res: Response) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { currentPassword, newPassword } = passwordChangeSchema.parse(req.body);
    
    const success = await authService.changePassword(
      req.session.user.id,
      currentPassword,
      newPassword,
      req.session.user.role === 'admin'
    );
    
    if (!success) {
      return res.status(400).json({ error: 'Password change failed' });
    }

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(400).json({ error: 'Invalid request data' });
  }
});

// Organization management for admins
router.get('/organizations', requireAdmin, async (req: Request, res: Response) => {
  try {
    const organizations = await storage.getAllOrganizations();
    res.json(organizations);
  } catch (error) {
    console.error('Get organizations error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Audit log access for admins
router.get('/audit', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { organizationId, eventType, startDate, endDate } = req.query;
    
    const filters: any = {};
    if (organizationId) filters.organizationId = organizationId as string;
    if (eventType) filters.eventType = eventType as string;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);

    const auditEvents = await storage.getAuditEvents(filters);
    res.json(auditEvents);
  } catch (error) {
    console.error('Get audit events error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


// Get current user endpoint
router.get('/me', async (req: Request, res: Response) => {
  try {
    if (!req.session.user || !req.session.isAuthenticated) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const sessionUser = req.session.user;
    
    res.json({
      id: sessionUser.id,
      name: sessionUser.firstName + ' ' + sessionUser.lastName,
      email: sessionUser.email,
      role: sessionUser.role,
      userType: sessionUser.userType, // Use actual session userType
      organizationId: sessionUser.organizationId,
      permissions: sessionUser.permissions || [],
      isImpersonating: sessionUser.isImpersonating || false,
      impersonationTarget: sessionUser.impersonationTarget
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});


export default router;