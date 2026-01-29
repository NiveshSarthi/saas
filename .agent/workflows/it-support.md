---
description: How to manage and use the IT Support ticketing system
---

# IT Support Workflow

This document outlines the complete lifecycle of an IT Support ticket, from creation to resolution, including backend auto-assignment logic.

## 1. Ticket Submission (User Flow)
- **Navigation**: Go to the **IT Support** page in the sidebar.
- **Action**: Click the **New Ticket** button.
- **Details**:
  - **Category**: Select the issue type (Hardware, Software, etc.).
  - **Priority**: Choose from Low, Medium, High, or Critical.
  - **Description**: Provide a detailed explanation of the issue.
  - **Asset ID**: (Optional) Link a specific device ID.
- **Outcome**: A new ticket is created with a unique ID (e.g., `IT-00001`).

## 2. Auto-Assignment & Approval (System Flow)
- **Direct Assignment**: Upon creation, the ticket is automatically assigned to the preferred technician: `ratnakerkumar56@gmail.com`.
- **Approval Queue**: The ticket status is set to `pending_approval`.
- **IT Head's Role**:
  - The IT Head (Department Manager) is notified of the new request.
  - The ticket remains locked until the IT Head reviews it.
  - **Actions**: Approve (starts the clock), Reject (with a reason), or Approve & Reassign to a different team member.

## 3. Ticket Management (Technician Flow)
- **Viewing**: `ratnakerkumar56@gmail.com` (or the re-assigned technician) sees the ticket in **Team Tickets** after approval.
- **Interaction**:
  - Click a ticket to open the **Ticket Detail** view.
  - **Status Updates**: After approval, technicians move tickets through `In Progress`, `On Hold`, and `Resolved`.
- **SLA Tracking**:
  - The SLA countdown starts **after** the IT Head approves the ticket.

## 4. Administration & Notifications (System)
- **Notifications**: Automated alerts are sent to:
  - The Technician (on initial assignment).
  - The IT Head (for approval requests).
  - The Creator (on approval or rejection).
- **Analytics**: Admins track resolution times and SLA breaches via the **Analytics** tab.

## 5. Backend Reference
- **Entity**: `ITTicket` (Head approval fields added)
- **Assignment Logic**: `autoAssignITTicket` (Simplified to preferred tech)
- **Review Logic**: `reviewITTicket` (Approve/Reject/Reassign handler)

// turbo-all
## Maintenance Commands
1. To synchronize IT support SLA configurations and departments:
```powershell
node backend/server.js
```
(Seeding runs automatically on startup if configs are missing)

2. To verify the auto-assignment logic:
```powershell
curl -X POST http://localhost:5000/functions/v1/invoke/autoAssignITTicket -H "Content-Type: application/json" -d '{"ticket_id": "[TICKET_ID]"}'
```
