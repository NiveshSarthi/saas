
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const leadSchema = new mongoose.Schema({
    lead_name: String,
    phone: String,
    email: String,
    company: String,
    location: String,
    status: String,
    contact_status: String,
    source: String,
    priority: String,
    assigned_to: String,
    import_batch_name: String,
    builder_id: String,
    notes: String,
    fb_lead_id: String,
    fb_form_id: String,
    fb_page_id: String,
    fb_created_time: Date,
    raw_facebook_data: mongoose.Schema.Types.Mixed,
    activity_log: [mongoose.Schema.Types.Mixed],
    last_activity_date: Date,
    created_by: String,
    created_date: { type: Date, default: Date.now }
});

const Lead = mongoose.model('Lead', leadSchema);

const deduplicate = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const allLeads = await Lead.find({});
        console.log(`Total leads before cleanup: ${allLeads.length}`);

        let deletedCount = 0;
        const fbIdMap = new Map();

        // Pass 1: Deduplicate by fb_lead_id (Strict)
        for (const lead of allLeads) {
            if (lead.fb_lead_id) {
                if (fbIdMap.has(lead.fb_lead_id)) {
                    const existing = fbIdMap.get(lead.fb_lead_id);
                    // Keep the one with more recent creation or update
                    const existingDate = new Date(existing.created_date || 0);
                    const currentDate = new Date(lead.created_date || 0);

                    if (currentDate > existingDate) {
                        // Current is newer, delete existing and keep current
                        console.log(`Deleting duplicate (older) lead with FB ID: ${lead.fb_lead_id} (ID: ${existing._id})`);
                        await Lead.deleteOne({ _id: existing._id });
                        fbIdMap.set(lead.fb_lead_id, lead);
                    } else {
                        // Existing is newer, delete current
                        console.log(`Deleting duplicate (newer/same) lead with FB ID: ${lead.fb_lead_id} (ID: ${lead._id})`);
                        await Lead.deleteOne({ _id: lead._id });
                    }
                    deletedCount++;
                } else {
                    fbIdMap.set(lead.fb_lead_id, lead);
                }
            }
        }

        console.log(`Deleted ${deletedCount} strict duplicates by FB Lead ID.`);

        // Pass 2: Clean up "undefined" or legacy leads that match the fresh ones
        // If we have a lead with fb_lead_id, and another lead with SAME email/phone but NO fb_lead_id, delete the one without fb_lead_id.
        const freshLeads = await Lead.find({ fb_lead_id: { $exists: true, $ne: null } });
        let legacyDeleted = 0;

        for (const freshLead of freshLeads) {
            const criteria = [];
            if (freshLead.email) criteria.push({ email: freshLead.email });
            if (freshLead.phone) criteria.push({ phone: freshLead.phone });

            if (criteria.length > 0) {
                const duplicates = await Lead.find({
                    $or: criteria,
                    fb_lead_id: { $exists: false }, // Only target ones without FB ID
                    _id: { $ne: freshLead._id } // Don't delete self
                });

                if (duplicates.length > 0) {
                    for (const dup of duplicates) {
                        console.log(`Deleting legacy duplicate for ${freshLead.lead_name} (Email: ${freshLead.email}). Legacy ID: ${dup._id}`);
                        await Lead.deleteOne({ _id: dup._id });
                        legacyDeleted++;
                    }
                }
            }
        }

        console.log(`Deleted ${legacyDeleted} legacy duplicates (matched by email/phone but missing FB ID).`);
        console.log('Deduplication complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

deduplicate();
