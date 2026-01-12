import express from 'express';
import { User } from '../models/index.js';

const router = express.Router();

// Mock Auth logic for simplicity - In real app, use BCrypt + JWT
router.get('/me', async (req, res) => {
    // For local dev, allow switching user via query param or header
    // e.g. /auth/me?email=pm@sarthi.com
    let email = req.query.email || req.headers['x-mock-user-email'];
    console.log(`Auth Check: ${email} (Headers: ${JSON.stringify(req.headers)})`);

    // Default to admin if not specified (and no global session yet)
    // In a real app, this would check req.session or JWT
    if (!email) {
        // Look for "last logged in" simulation or just default admin
        email = 'admin@sarthi.com';
    }

    let user = await User.findOne({ email });

    if (!user) {
        // Fallback to create admin if even admin doesn't exist
        if (email === 'admin@sarthi.com') {
            user = await User.create({
                email: 'admin@sarthi.com',
                full_name: 'Admin User',
                role: 'admin',
                role_id: 'admin'
            });
        } else {
            return res.status(404).json({ error: 'User not found' });
        }
    } else if (email === 'admin@sarthi.com' && (user.role !== 'admin' || user.role_id !== 'admin')) {
        // Enforce admin privileges for this email
        user.role = 'admin';
        user.role_id = 'admin';
        await user.save();
    }

    res.json(user);
});

router.post('/login', async (req, res) => {
    console.log('Login Attempt:', req.body);
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ token: 'mock_token', user });
});

export default router;
