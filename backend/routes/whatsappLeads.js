import express from 'express';
import { Lead, Activity, Organization, Department, User, RELeadActivity } from '../models/index.js';

const router = express.Router();

const autoAssignLead = async (leadId) => {
  try {
    // 1. Check if auto-assign is paused
    const orgs = await Organization.find();
    if (orgs[0]?.settings?.autoAssignPaused) {
      console.log('Auto-assignment is paused in organization settings');
      return null;
    }

    const lead = await Lead.findById(leadId);
    if (!lead || lead.assigned_to) return null;

    // 2. Identify eligible sales members
    const salesDept = await Department.findOne({ name: /Sales/i });
    let eligibleUsers = [];

    if (salesDept) {
      eligibleUsers = await User.find({
        department_id: salesDept._id.toString(),
        is_active: true
      }).sort({ email: 1 });
    }

    if (eligibleUsers.length === 0) {
      eligibleUsers = await User.find({
        $or: [
          { job_title: /Sales/i },
          { role_id: /Sales/i }
        ],
        is_active: true
      }).sort({ email: 1 });
    }

    if (eligibleUsers.length === 0) {
      console.warn('No eligible sales users found for auto-assignment');
      return null;
    }

    // 3. Determine whose turn it is
    const lastAssignedLead = await Lead.findOne({
      source: 'whatsapp',
      assigned_to: { $exists: true, $ne: null }
    }).sort({ created_date: -1 });

    let nextAssigneeIndex = 0;
    if (lastAssignedLead) {
      const lastAssigneeEmail = lastAssignedLead.assigned_to;
      const lastIndex = eligibleUsers.findIndex(u => u.email === lastAssigneeEmail);
      if (lastIndex !== -1) {
        nextAssigneeIndex = (lastIndex + 1) % eligibleUsers.length;
      }
    }

    const selectedUser = eligibleUsers[nextAssigneeIndex];

    // 4. Perform assignment
    lead.assigned_to = selectedUser.email;
    await lead.save();

    // 5. Create activity record in RELeadActivity for consistency
    await RELeadActivity.create({
      lead_id: lead.id,
      activity_type: 'assignment',
      description: `Lead automatically assigned to ${selectedUser.full_name || selectedUser.email} via Round Robin`,
      actor_email: 'system_auto_assign',
      created_date: new Date()
    });

    console.log(`WhatsApp Lead ${leadId} auto-assigned to ${selectedUser.email}`);
    return selectedUser.email;
  } catch (err) {
    console.error('WhatsApp Auto-assignment failed:', err);
    return null;
  }
};

// Global helper for lead processing
const processLead = async (leadData, campaign_id) => {
  // Set defaults
  leadData.source = 'whatsapp';
  leadData.status = 'new';
  leadData.contact_status = 'not_contacted';

  // Add campaign metadata to notes
  if (campaign_id) {
    const campaignNote = `\nWhatsApp Campaign: ${campaign_id}`;
    leadData.notes = (leadData.notes || '') + campaignNote;
  }

  // Check for existing lead by phone
  const existingLead = await Lead.findOne({ phone: leadData.phone });

  let lead;
  let action;

  if (existingLead) {
    // Update existing lead
    lead = await Lead.findByIdAndUpdate(
      existingLead._id,
      {
        ...leadData,
        updated_at: new Date()
      },
      { new: true }
    );
    action = 'updated';
  } else {
    // Create new lead
    leadData.created_by = 'whatsapp_integration';

    lead = new Lead(leadData);
    await lead.save();
    action = 'created';

    // Auto-assign if not manually assigned
    if (!leadData.assigned_to) {
      await autoAssignLead(lead._id);
      // Refresh lead to get assigned_to
      lead = await Lead.findById(lead._id);
    }
  }

  // Create activity log entry
  if (lead) {
    await Activity.create({
      user_email: lead.assigned_to || leadData.assigned_to || 'whatsapp_integration',
      action: 'lead_created',
      entity_type: 'lead',
      entity_id: lead._id,
      description: `Lead ${action} via WhatsApp integration: ${leadData.lead_name}`
    });
  }

  return { lead, action };
};

// POST /api/whatsapp-leads/push (for JSON data from external systems)
router.post('/push', async (req, res) => {
  try {
    const { leads, campaign_id } = req.body;

    if (!leads || !Array.isArray(leads)) {
      return res.status(400).json({
        success: false,
        error: 'leads array is required'
      });
    }

    const results = {
      created: 0,
      updated: 0,
      errors: [],
      processed_leads: []
    };

    for (const data of leads) {
      try {
        if (!data.lead_name || !data.phone) {
          results.errors.push({
            data: data,
            error: 'Missing required fields: lead_name and/or phone'
          });
          continue;
        }

        const { lead, action } = await processLead(data, campaign_id);

        if (action === 'created') results.created++;
        else results.updated++;

        results.processed_leads.push({
          id: lead._id,
          lead_name: lead.lead_name,
          phone: lead.phone,
          action: action,
          assigned_to: lead.assigned_to
        });

      } catch (err) {
        results.errors.push({
          data: data,
          error: err.message
        });
      }
    }

    results.success = results.errors.length === 0;
    res.json(results);

  } catch (error) {
    console.error('WhatsApp JSON push error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/whatsapp-leads (Original endpoint for tab-separated data)
router.post('/', async (req, res) => {
  try {
    const { data, campaign_id } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        error: 'Data field is required'
      });
    }

    // Parse tab-separated data
    const lines = data.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Invalid data format - must contain headers and at least one data row'
      });
    }

    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const rows = lines.slice(1);

    const results = {
      created: 0,
      updated: 0,
      errors: [],
      leads: []
    };

    for (const row of rows) {
      if (!row.trim()) continue;

      try {
        const values = row.split('\t').map(v => v.trim());
        const leadData = {};

        // Map headers to fields
        headers.forEach((header, index) => {
          const value = values[index] || '';

          switch (header) {
            case 'name':
              leadData.lead_name = value;
              break;
            case 'phone_no.':
              // Clean phone number - remove any non-numeric characters except +
              leadData.phone = value.replace(/[^\d+]/g, '');
              break;
            case 'question_1':
              leadData.requirements = value;
              break;
            case 'question_2':
              leadData.budget = value;
              break;
            case 'question_3':
              leadData.location = value;
              break;
            case 'question_4':
              if (value && value !== '-') {
                leadData.notes = value;
              }
              break;
            case 'assigned_to':
              if (value && value !== '-') {
                leadData.assigned_to = value.toLowerCase().trim();
              }
              break;
          }
        });

        // Validate required fields
        if (!leadData.lead_name || !leadData.phone) {
          results.errors.push({
            row: row.substring(0, 50) + '...',
            error: 'Missing required fields: name and/or phone'
          });
          continue;
        }

        const { lead, action } = await processLead(leadData, campaign_id);

        if (action === 'created') results.created++;
        else results.updated++;

        results.leads.push({
          id: lead._id,
          lead_name: lead.lead_name,
          phone: lead.phone,
          action: action,
          assigned_to: lead.assigned_to
        });

      } catch (rowError) {
        results.errors.push({
          row: row.substring(0, 50) + '...',
          error: rowError.message
        });
      }
    }

    results.success = results.errors.length === 0;

    res.json(results);

  } catch (error) {
    console.error('WhatsApp leads import error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


export default router;
