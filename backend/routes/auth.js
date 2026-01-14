import express from 'express';
import bcrypt from 'bcryptjs';
import { User, Role } from '../models/index.js';
import { authenticate, generateToken, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        console.log('Login Attempt:', req.body?.email);
        const { email, password } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        if (user.is_active === false) {
            return res.status(403).json({ error: 'Account is deactivated' });
        }

        // If user has a password, verify it
        if (user.password_hash) {
            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            const isMatch = await bcrypt.compare(password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }
        }
        // If no password hash, allow login (legacy users during migration)

        // Update last login
        user.last_login = new Date();
        await user.save();

        // Generate token
        const token = generateToken(user);

        // Get role info
        let role = null;
        if (user.role_id) {
            role = await Role.findOne({ id: user.role_id });
        }

        // Return user without sensitive fields
        const userResponse = user.toObject();
        delete userResponse.password_hash;
        delete userResponse.password_reset_token;
        delete userResponse.password_reset_expires;

        res.json({
            token,
            user: userResponse,
            role: role ? { name: role.name, permissions: role.permissions } : null
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get current user info
 */
router.get('/me', optionalAuth, async (req, res) => {
    try {
        // For backward compatibility, check query param or header
        let email = req.query.email || req.headers['x-mock-user-email'];

        // If authenticated via token, use that user
        if (req.user) {
            const userResponse = req.user.toObject();
            delete userResponse.password_hash;
            delete userResponse.password_reset_token;
            return res.json(userResponse);
        }

        // Fallback for legacy mock auth
        console.log(`Auth Check: ${email}`);

        if (!email) {
            email = 'admin@sarthi.com';
        }

        let user = await User.findOne({ email });

        if (!user) {
            if (email === 'admin@sarthi.com') {
                // Auto-create admin if doesn't exist
                const bcryptHash = await bcrypt.hash('admin123', 10);
                user = await User.create({
                    email: 'admin@sarthi.com',
                    full_name: 'Admin User',
                    role: 'admin',
                    role_id: 'admin',
                    password_hash: bcryptHash,
                    is_active: true
                });
            } else {
                return res.status(404).json({ error: 'User not found' });
            }
        } else if (email === 'admin@sarthi.com' && (user.role !== 'admin' || user.role_id !== 'admin')) {
            user.role = 'admin';
            user.role_id = 'admin';
            await user.save();
        }

        const userResponse = user.toObject();
        delete userResponse.password_hash;
        delete userResponse.password_reset_token;

        res.json(userResponse);
    } catch (error) {
        console.error('Auth me error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Logout - client should remove token
 */
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * Change own password
 */
router.post('/change-password', authenticate, async (req, res) => {
    try {
        const { current_password, new_password } = req.body;

        if (!new_password || new_password.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }

        const user = await User.findById(req.user._id);

        // If user has existing password, verify current password
        if (user.password_hash) {
            if (!current_password) {
                return res.status(400).json({ error: 'Current password is required' });
            }

            const isMatch = await bcrypt.compare(current_password, user.password_hash);
            if (!isMatch) {
                return res.status(401).json({ error: 'Current password is incorrect' });
            }
        }

        // Hash and save new password
        user.password_hash = await bcrypt.hash(new_password, 10);
        await user.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Request password reset
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const user = await User.findOne({ email: email.toLowerCase() });
        if (!user) {
            // Don't reveal if user exists
            return res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
        }

        // Generate reset token
        const resetToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
        user.password_reset_token = resetToken;
        user.password_reset_expires = new Date(Date.now() + 3600000); // 1 hour
        await user.save();

        // In production, send email with reset link
        console.log(`Password reset token for ${email}: ${resetToken}`);

        res.json({ success: true, message: 'If the email exists, a reset link will be sent' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, new_password } = req.body;

        if (!token || !new_password) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const user = await User.findOne({
            password_reset_token: token,
            password_reset_expires: { $gt: new Date() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Update password
        user.password_hash = await bcrypt.hash(new_password, 10);
        user.password_reset_token = null;
        user.password_reset_expires = null;
        await user.save();

        res.json({ success: true, message: 'Password reset successfully' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
