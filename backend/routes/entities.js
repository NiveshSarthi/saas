import express from 'express';
import mongoose from 'mongoose';
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

        // Map 'id' to '_id' for Mongoose find, BUT ONLY if 'id' is not a dedicated field in the schema
        if (filters.id && !Model.schema.paths.id) {
            filters._id = filters.id;
            delete filters.id;
        }

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

        const id = req.params.id;
        if (!id || id === 'undefined') {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        let updated;
        const isObjectId = mongoose.Types.ObjectId.isValid(id);

        if (isObjectId) {
            updated = await Model.findByIdAndUpdate(id, req.body, { new: true });
        }

        // Fallback for custom 'id' field if not found by _id or if id is not a valid ObjectId
        if (!updated && Model.schema.paths.id) {
            updated = await Model.findOneAndUpdate({ id }, req.body, { new: true });
        }

        if (!updated) return res.status(404).json({ error: 'Item not found' });
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

        const id = req.params.id;
        if (!id || id === 'undefined') {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        let item;
        const isObjectId = mongoose.Types.ObjectId.isValid(id);

        if (isObjectId) {
            item = await Model.findById(id);
        }

        // Fallback for custom 'id' field
        if (!item && Model.schema.paths.id) {
            item = await Model.findOne({ id });
        }

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

        const id = req.params.id;
        if (!id || id === 'undefined') {
            return res.status(400).json({ error: 'Invalid ID' });
        }

        let deleted;
        const isObjectId = mongoose.Types.ObjectId.isValid(id);

        if (isObjectId) {
            deleted = await Model.findByIdAndDelete(id);
        }

        // Fallback for custom 'id' field
        if (!deleted && Model.schema.paths.id) {
            deleted = await Model.findOneAndDelete({ id });
        }

        if (!deleted) return res.status(404).json({ error: 'Item not found' });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
