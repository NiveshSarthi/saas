import express from 'express';
import * as models from '../models/index.js';

const router = express.Router();

// Helper to get model by name (case insensitive)
const getModel = (entityName) => {
    const name = Object.keys(models).find(key => key.toLowerCase() === entityName.toLowerCase());
    return name ? models[name] : null;
};

// Filter (Search) - Emulates base44.entities.Entity.filter(query)
router.post('/:entity/filter', async (req, res) => {
    try {
        const Model = getModel(req.params.entity);
        if (!Model) return res.status(404).json({ error: 'Entity not found' });

        const filters = { ...req.body };
        const sort = filters._sort || { created_at: -1 };
        const limit = filters._limit || 1000;

        delete filters._sort;
        delete filters._limit;

        // Convert sort string "-name" to object { name: -1 }
        let sortObj = sort;
        if (typeof sort === 'string') {
            const desc = sort.startsWith('-');
            const field = desc ? sort.substring(1) : sort;
            sortObj = { [field]: desc ? -1 : 1 };
        }

        const results = await Model.find(filters).sort(sortObj).limit(limit);
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create
router.post('/:entity', async (req, res) => {
    try {
        const Model = getModel(req.params.entity);
        if (!Model) {
            console.error(`Entity not found: ${req.params.entity}`);
            return res.status(404).json({ error: 'Entity not found' });
        }

        console.log(`Creating ${req.params.entity}:`, req.body);
        const item = new Model(req.body);
        await item.save();
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update
router.patch('/:entity/:id', async (req, res) => {
    try {
        const Model = getModel(req.params.entity);
        if (!Model) return res.status(404).json({ error: 'Entity not found' });

        // Special validation for Task
        if (req.params.entity.toLowerCase() === 'task') {
            if (req.body.assignedFreelancerId) {
                const freelancer = await models.User.findOne({ email: req.body.assignedFreelancerId, role_id: 'freelancer' });
                if (!freelancer) {
                    return res.status(400).json({ error: 'Assigned user must have freelancer role' });
                }
            }
            if (req.body.assignmentType === 'FREELANCER') {
                req.body.hourlyTrackingEnabled = true;
            }
        }

        const updated = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get by ID
router.get('/:entity/:id', async (req, res) => {
    try {
        const Model = getModel(req.params.entity);
        if (!Model) return res.status(404).json({ error: 'Entity not found' });

        const item = await Model.findById(req.params.id);
        if (!item) return res.status(404).json({ error: 'Item not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete
router.delete('/:entity/:id', async (req, res) => {
    try {
        const Model = getModel(req.params.entity);
        if (!Model) return res.status(404).json({ error: 'Entity not found' });

        await Model.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get freelancers
router.get('/users/freelancers', async (req, res) => {
    try {
        const freelancers = await models.User.find({ role_id: 'freelancer' });
        res.json(freelancers);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start time tracking
router.post('/timeEntry/start', async (req, res) => {
    try {
        const { task_id, user_email } = req.body;

        // Check if task has freelancer assigned
        const task = await models.Task.findById(task_id);
        if (!task || task.assignedFreelancerId !== user_email) {
            return res.status(400).json({ error: 'Only assigned freelancer can log time' });
        }

        // Check if there's already an active timer for this user
        const activeEntry = await models.TimeEntry.findOne({ user_email, end_time: null });
        if (activeEntry) {
            return res.status(400).json({ error: 'Another timer is already running' });
        }

        const entry = new models.TimeEntry({
            user_email,
            task_id,
            start_time: new Date()
        });
        await entry.save();
        res.json(entry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Stop time tracking
router.post('/timeEntry/stop', async (req, res) => {
    try {
        const { user_email } = req.body;

        const activeEntry = await models.TimeEntry.findOne({ user_email, end_time: null });
        if (!activeEntry) {
            return res.status(400).json({ error: 'No active timer found' });
        }

        const endTime = new Date();
        const duration = Math.round((endTime - activeEntry.start_time) / (1000 * 60)); // minutes

        activeEntry.end_time = endTime;
        activeEntry.duration_minutes = duration;
        await activeEntry.save();

        res.json(activeEntry);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get time entries for task
router.get('/timeEntry/task/:taskId', async (req, res) => {
    try {
        const entries = await models.TimeEntry.find({ task_id: req.params.taskId }).sort({ created_at: -1 });
        res.json(entries);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get logged hours for task
router.get('/timeEntry/task/:taskId/hours', async (req, res) => {
    try {
        const entries = await models.TimeEntry.find({ task_id: req.params.taskId, end_time: { $ne: null } });
        const totalHours = entries.reduce((sum, entry) => sum + (entry.duration_minutes || 0), 0) / 60;
        res.json({ totalHours });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
