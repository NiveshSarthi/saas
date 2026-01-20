import express from 'express';
import { Lead, Activity } from '../models/index.js';

const router = express.Router();

// POST /api/whatsapp-leads
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
              leadData.requirements = value; // e.g., "Residential"
              break;
            case 'question_2':
              leadData.budget = value; // e.g., "70L - 1.5Cr"
              break;
            case 'question_3':
              leadData.location = value; // e.g., "Neher Par(Grt FDB)"
              break;
            case 'question_4':
              if (value && value !== '-') {
                leadData.notes = value;
              }
              break;
            case 'assigned_to':
              if (value) {
                // Clean email and convert to lowercase for consistency
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
          results.updated++;
          action = 'updated';
        } else {
          // Create new lead
          leadData.created_by = 'whatsapp_integration';

          lead = new Lead(leadData);
          await lead.save();
          results.created++;
          action = 'created';
        }

        // Create activity log entry
        if (lead) {
          await Activity.create({
            user_email: leadData.assigned_to || 'whatsapp_integration',
            action: 'lead_created',
            entity_type: 'lead',
            entity_id: lead._id,
            description: `Lead ${action} via WhatsApp integration: ${leadData.lead_name}`
          });

          results.leads.push({
            id: lead._id,
            lead_name: leadData.lead_name,
            phone: leadData.phone,
            action: action
          });
        }

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