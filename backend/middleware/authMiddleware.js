import jwt from 'jsonwebtoken';
import { User, Role } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'sarthi_jwt_secret_change_in_production';

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (req, res, next) => {
    try {
        // Check for token in Authorization header or x-mock-user-email for backward compatibility
        const authHeader = req.headers.authorization;
        const mockEmail = req.headers['x-mock-user-email'];

        let user = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                user = await User.findById(decoded.userId);
            } catch (err) {
                // Token invalid or expired
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        } else if (mockEmail) {
            // Backward compatibility with mock auth during transition
            user = await User.findOne({ email: mockEmail });
        }

        if (!user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        if (user.is_active === false) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // Attach user and their role to request
        req.user = user;

        // Load role permissions
        if (user.role_id) {
            const role = await Role.findOne({ id: user.role_id });
            req.role = role;
            req.permissions = role?.permissions || {};
        } else {
            req.permissions = {};
        }

        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ error: 'Authentication error' });
    }
};

/**
 * Check if user is admin
 */
export const isAdmin = (req) => {
    return req.user?.role === 'admin' ||
        req.role?.name === 'Admin' ||
        req.role?.name === 'Super Admin' ||
        req.user?.role_id === 'admin' ||
        req.user?.role_id === 'super_admin' ||
        req.user?.department_id === 'dept_hr';
};

/**
 * Check if user has a specific permission
 */
export const hasPermission = (req, module, action) => {
    if (isAdmin(req)) return true;
    return req.permissions?.[module]?.[action] === true;
};

/**
 * Middleware to require a specific permission
 */
export const requirePermission = (module, action) => {
    return (req, res, next) => {
        if (!hasPermission(req, module, action)) {
            return res.status(403).json({
                error: 'Permission denied',
                required: { module, action }
            });
        }
        next();
    };
};

/**
 * Middleware to require admin access
 */
export const requireAdmin = (req, res, next) => {
    if (!isAdmin(req)) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};

/**
 * Generate JWT token for user
 */
export const generateToken = (user) => {
    return jwt.sign(
        { userId: user._id, email: user.email },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
};

/**
 * Optional authentication - doesn't fail if not authenticated
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const mockEmail = req.headers['x-mock-user-email'];

        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            try {
                const decoded = jwt.verify(token, JWT_SECRET);
                req.user = await User.findById(decoded.userId);
                if (req.user?.role_id) {
                    const role = await Role.findOne({ id: req.user.role_id });
                    req.role = role;
                    req.permissions = role?.permissions || {};
                }
            } catch (err) {
                // Token invalid, continue without auth
            }
        } else if (mockEmail) {
            req.user = await User.findOne({ email: mockEmail });
            if (req.user?.role_id) {
                const role = await Role.findOne({ id: req.user.role_id });
                req.role = role;
                req.permissions = role?.permissions || {};
            }
        }

        next();
    } catch (error) {
        next();
    }
};

export default {
    authenticate,
    requirePermission,
    requireAdmin,
    generateToken,
    hasPermission,
    isAdmin,
    optionalAuth
};
