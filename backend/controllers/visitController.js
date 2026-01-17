
import * as models from '../models/index.js';

// Start a Site Visit (Gate Pass)
export const startVisit = async (req, res) => {
    try {
        const { user_email, client_name, purpose, estimated_duration_minutes, location } = req.body;

        // Verify if user is checked in
        // In a real app, we check 'Attendance', but for simplicity/speed we proceed.

        // Check for active visit
        const activeVisit = await models.SiteVisit.findOne({
            user_email,
            status: 'ongoing'
        });

        if (activeVisit) {
            return res.status(400).json({ error: 'You already have an active site visit.' });
        }

        const visit = await models.SiteVisit.create({
            user_email,
            client_name,
            purpose,
            estimated_duration_minutes,
            location_start: location,
            start_time: new Date(),
            status: 'ongoing'
        });

        res.json({ success: true, data: visit });
    } catch (e) {
        console.error('Start Visit Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// End a Site Visit
export const endVisit = async (req, res) => {
    try {
        const { id } = req.params;
        const { notes, location } = req.body;

        const visit = await models.SiteVisit.findOne({ _id: id, status: 'ongoing' });
        if (!visit) {
            return res.status(404).json({ error: 'Active visit not found.' });
        }

        const endTime = new Date();
        const startTime = new Date(visit.start_time);
        const actualDuration = Math.round((endTime - startTime) / 60000); // Minutes

        visit.end_time = endTime;
        visit.actual_duration_minutes = actualDuration;
        visit.location_end = location;
        visit.notes = notes;
        visit.status = 'completed';

        await visit.save();

        res.json({ success: true, data: visit });
    } catch (e) {
        console.error('End Visit Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get Active Visit for User
export const getActiveVisit = async (req, res) => {
    try {
        const { email } = req.query;
        const visit = await models.SiteVisit.findOne({
            user_email: email,
            status: 'ongoing'
        });

        res.json({ success: true, data: visit });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};

// Update Visit Status (Approve/Reject)
export const updateVisitStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, rejection_reason, approved_by } = req.body;

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status update.' });
        }

        const visit = await models.SiteVisit.findById(id);
        if (!visit) {
            return res.status(404).json({ error: 'Visit not found.' });
        }

        visit.approval_status = status;
        if (status === 'approved') {
            visit.approved_by = approved_by;
        } else if (status === 'rejected') {
            visit.rejection_reason = rejection_reason;
            visit.approved_by = approved_by;

            // Calculate duration in hours
            if (visit.start_time && visit.end_time) {
                const start = new Date(visit.start_time);
                const end = new Date(visit.end_time);
                const durationMs = end - start;
                const durationHours = durationMs / (1000 * 60 * 60);

                // Find Attendance record for this day and user
                const visitDate = start.toISOString().split('T')[0];
                const attendance = await models.Attendance.findOne({
                    user_email: visit.user_email,
                    date: visitDate
                });

                if (attendance) {
                    attendance.rejected_hours = (attendance.rejected_hours || 0) + durationHours;
                    // Calculate effective hours (ensure non-negative)
                    const total = attendance.total_hours || 0;
                    attendance.effective_hours = Math.max(0, total - attendance.rejected_hours);
                    await attendance.save();
                    console.log(`Deducted ${durationHours.toFixed(2)} hours from ${visit.user_email} for date ${visitDate}`);
                }
            }
        }

        await visit.save();

        res.json({ success: true, data: visit });
    } catch (e) {
        console.error('Update Visit Status Error:', e);
        res.status(500).json({ error: e.message });
    }
};

// Get All Visits (with optional filter)
export const getVisits = async (req, res) => {
    try {
        const { status, approval_status } = req.query;
        const query = {};
        if (status) query.status = status;
        if (approval_status) query.approval_status = approval_status;

        const visits = await models.SiteVisit.find(query).sort({ created_at: -1 });
        res.json({ success: true, data: visits });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
