import express from 'express';
import bcrypt from 'bcryptjs';
import { User, Role, AuditLog } from '../models/index.js';
import { authenticate, requirePermission, hasPermission, isAdmin, generateToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Create a new user (requires users.create permission or admin)
 */
router.post('/', authenticate, async (req, res) => {
    try {
        // Check permission
        if (!hasPermission(req, 'users', 'create') && !isAdmin(req)) {
            return res.status(403).json({ error: 'Permission denied: Cannot create users' });
        }

        const { email, full_name, password, role_id, department_id, project_ids, job_title } = req.body;

        // Validate required fields
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Hash password if provided
        let password_hash = null;
        if (password) {
            password_hash = await bcrypt.hash(password, 10);
        }

        // Create user
        const user = new User({
            email: email.toLowerCase(),
            full_name,
            password_hash,
            role_id: role_id || 'team_member',
            department_id,
            project_ids: project_ids || [],
            job_title,
            is_active: true,
            created_by: req.user.email
        });

        await user.save();

        // Audit log
        await AuditLog.create({
            user_email: req.user.email,
            action: 'user_created',
            module: 'users',
            details: JSON.stringify({ created_user: email, role_id })
        });

        // Return user without password hash
        const userResponse = user.toObject();
        delete userResponse.password_hash;

        res.status(201).json(userResponse);
    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Change user password (requires admin or users.manage_password permission)
 * Can also change own password with current password verification
 */
router.patch('/:id/password', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { current_password, new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isSelf = req.user._id.toString() === id;
        const canManagePasswords = hasPermission(req, 'users', 'manage_password') || isAdmin(req);

        // If changing own password, require current password
        if (isSelf && !canManagePasswords) {
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required' });
            }

            if (targetUser.password_hash) {
                const isMatch = await bcrypt.compare(current_password, targetUser.password_hash);
                if (!isMatch) {
                    return res.status(401).json({ error: 'Current password is incorrect' });
                }
            }
        } else if (!canManagePasswords) {
            // Not self and no permission
            return res.status(403).json({ error: 'Permission denied: Cannot change other users passwords' });
        }

        // Hash and update password
        const password_hash = await bcrypt.hash(new_password, 10);
        targetUser.password_hash = password_hash;
        targetUser.password_reset_token = null;
        targetUser.password_reset_expires = null;
        await targetUser.save();

        // Audit log
        await AuditLog.create({
            user_email: req.user.email,
            action: 'password_changed',
            module: 'users',
            details: JSON.stringify({ target_user: targetUser.email, changed_by: req.user.email })
        });

        res.json({ success: true, message: 'Password updated successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Activate/deactivate user
 */
router.patch('/:id/activate', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        // Check permission
        if (!hasPermission(req, 'users', 'update') && !isAdmin(req)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Prevent deactivating yourself
        if (req.user._id.toString() === id && is_active === false) {
            return res.status(400).json({ error: 'Cannot deactivate your own account' });
        }

        targetUser.is_active = is_active;
        await targetUser.save();

        // Audit log
        await AuditLog.create({
            user_email: req.user.email,
            action: is_active ? 'user_activated' : 'user_deactivated',
            module: 'users',
            details: JSON.stringify({ target_user: targetUser.email })
        });

        res.json({ success: true, is_active: targetUser.is_active });
    } catch (error) {
        console.error('Activate user error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get all users (requires users.read permission)
 */
router.get('/', authenticate, async (req, res) => {
    try {
        if (!hasPermission(req, 'users', 'read') && !isAdmin(req)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const users = await User.find({}).select('-password_hash -password_reset_token');
        res.json(users);
    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get user by ID
 */
router.get('/:id', authenticate, async (req, res) => {
    try {
        if (!hasPermission(req, 'users', 'read') && !isAdmin(req)) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const user = await User.findById(req.params.id).select('-password_hash -password_reset_token');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user);
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Set initial password for user (admin only) - for users without passwords
 */
router.post('/:id/set-password', authenticate, async (req, res) => {
    try {
        if (!isAdmin(req)) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const { id } = req.params;
        const { password } = req.body;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const targetUser = await User.findById(id);
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        const password_hash = await bcrypt.hash(password, 10);
        targetUser.password_hash = password_hash;
        await targetUser.save();

        // Audit log
        await AuditLog.create({
            user_email: req.user.email,
            action: 'password_set',
            module: 'users',
            details: JSON.stringify({ target_user: targetUser.email })
        });

        res.json({ success: true, message: 'Password set successfully' });
    } catch (error) {
        console.error('Set password error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
