import {
    Attendance, SalaryRecord, SalaryPolicy, SalaryAdvance, SalaryAdjustment, LeaveRequest, User
} from '../models/index.js';

export const calculateMonthlySalary = async (req, res) => {
    try {
        const userRole = 'admin'; // Mock admin check for now, or use req.user.role if auth middleware exists
        if (userRole !== 'admin') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { month, employee_email } = req.body;
        if (!month) {
            return res.status(400).json({ error: 'Month required (YYYY-MM)' });
        }

        // Parse month
        const [year, monthNum] = month.split('-');
        const startDate = `${year}-${monthNum}-01`;
        const lastDay = new Date(year, monthNum, 0).getDate();
        const endDate = `${year}-${monthNum}-${lastDay}`;
        const totalCalendarDays = lastDay;

        // Fetch Attendance
        const attendanceFilter = {
            date: { $gte: startDate, $lte: endDate }
        };
        if (employee_email) attendanceFilter.user_email = employee_email;

        // Note: In Mongo, storing date as string YYYY-MM-DD makes string comparison work for dates
        const attendanceRecords = await Attendance.find(attendanceFilter);

        // Fetch Policies
        const allPolicies = await SalaryPolicy.find({ is_active: true });

        // Fetch Users
        const allUsers = await User.find({});
        const emailToName = {};
        allUsers.forEach(u => emailToName[u.email] = u.full_name);

        // Existing Salary Records
        const existingSalaryFilter = { month };
        if (employee_email) existingSalaryFilter.employee_email = employee_email;
        const existingSalaryRecords = await SalaryRecord.find(existingSalaryFilter);

        // Group by Employee
        const employeeSalaries = {};
        const uniqueUsers = [...new Set(attendanceRecords.map(a => a.user_email))];

        // Ensure we process employees who have an existing record even if no attendance
        existingSalaryRecords.forEach(r => {
            if (!uniqueUsers.includes(r.employee_email)) uniqueUsers.push(r.employee_email);
        });

        for (const userEmail of uniqueUsers) {
            const userAttendance = attendanceRecords.filter(a => a.user_email === userEmail);
            const policy = allPolicies.find(p => p.user_email === userEmail);
            const existingRecord = existingSalaryRecords.find(r => r.employee_email === userEmail);

            // Init calculations object
            const emp = {
                employee_email: userEmail,
                employee_name: emailToName[userEmail] || policy?.user_name || userEmail.split('@')[0],
                month,
                total_working_days: totalCalendarDays,
                total_paid_days: 0,
                present_days: 0,
                paid_leave_days: 0,
                unpaid_leave_days: 0,
                absent_days: 0,
                half_days: 0,
                paid_half_days: 0,
                unpaid_half_days: 0,
                weekoff_days: 0,
                holiday_days: 0,
                wfh_days: 0,
                late_count: 0,
                early_checkout_count: 0,
                overtime_hours: 0,
                // Financials
                basic_salary: 0, hra: 0, travelling_allowance: 0, children_education_allowance: 0, fixed_incentive: 0,
                per_day_rate: 0, base_earned_salary: 0,
                overtime_amount: 0, late_penalty: 0, early_checkout_penalty: 0, absent_deduction: 0, unpaid_leave_deduction: 0,
                gross_salary: 0, total_deductions: 0, net_salary: 0, cash_in_hand: 0,
                // Deductions
                employee_pf: 0, employee_esi: 0, labour_welfare_employee: 0, total_employee_deduction: 0,
                // Employer
                employer_pf: 0, employer_esi: 0, labour_welfare_employer: 0, ex_gratia: 0, employer_incentive: 0, total_employer_contribution: 0,
                ctc_monthly: 0, ctc_annual: 0,
                not_marked_days: 0, not_marked_dates: []
            };

            // Attendance Processing
            let attendanceAdjustments = 0;
            let consecutiveLateCheckIn = 0;
            let consecutiveEarlyCheckout = 0;
            const expectedCheckIn = 10; // 10:00 AM
            const expectedCheckOutStart = 17; // 5:00 PM
            const expectedCheckOutEnd = 18; // 6:00 PM
            const dailySalary = policy ? ((policy.basic_salary || 0) + (policy.hra || 0) + (policy.travelling_allowance || 0) + (policy.children_education_allowance || 0) + (policy.fixed_incentive || 0) + (policy.employer_incentive || 0)) / totalCalendarDays : 0;

            userAttendance.forEach(att => {
                if (['present', 'checked_out', 'work_from_home'].includes(att.status)) {
                    emp.present_days++;
                    emp.total_paid_days++;
                    if (att.status === 'work_from_home') emp.wfh_days++;
                } else if (att.status === 'absent') {
                    emp.absent_days++;
                } else if (att.status === 'half_day') {
                    emp.half_days++; emp.paid_half_days++; emp.total_paid_days += 0.5;
                } else if (['weekoff', 'holiday', 'leave', 'sick_leave', 'casual_leave'].includes(att.status)) {
                    // Weekoff/Holiday/PaidLeave count as paid
                    if (att.status === 'weekoff') emp.weekoff_days++;
                    if (att.status === 'holiday') emp.holiday_days++;
                    if (att.status.includes('leave')) emp.paid_leave_days++;
                    emp.total_paid_days++;
                }

                if (att.is_late) emp.late_count++;
                if (att.is_early_checkout) emp.early_checkout_count++;

                // Attendance-based adjustments
                if (['present', 'checked_out', 'work_from_home'].includes(att.status)) {
                    const checkInTime = att.check_in ? new Date(att.check_in) : null;
                    const checkOutTime = att.check_out ? new Date(att.check_out) : null;
                    let dailyAdjustment = 0;

                    // Check-in rules
                    if (checkInTime) {
                        const checkInHour = checkInTime.getHours();
                        const checkInMinute = checkInTime.getMinutes();
                        const checkInTotalMinutes = checkInHour * 60 + checkInMinute;
                        const expectedCheckInMinutes = expectedCheckIn * 60;

                        if (checkInTotalMinutes > expectedCheckInMinutes) {
                            // Check-in after 10 AM
                            if (checkInHour >= 10 && checkInHour < 11) {
                                // 10:01 - 11:00
                                consecutiveLateCheckIn++;
                                if (consecutiveLateCheckIn >= 3) {
                                    dailyAdjustment -= dailySalary * 0.25;
                                } else {
                                    dailyAdjustment -= dailySalary * 0.25;
                                }
                            } else if (checkInHour >= 11 && checkInHour < 12) {
                                // 11:00 - 12:00
                                dailyAdjustment -= dailySalary * 0.5;
                                consecutiveLateCheckIn = 0; // Reset streak
                            } else if (checkInHour >= 12 && checkInHour < 14) {
                                // 12:00 - 2:00
                                dailyAdjustment -= dailySalary * 0.5;
                                consecutiveLateCheckIn = 0;
                            } else if (checkInHour >= 14 && checkInHour < 16) {
                                // 2:00 - 4:00 (Deduction, not bonus)
                                dailyAdjustment -= dailySalary * 0.75;
                                consecutiveLateCheckIn = 0;
                            } else if (checkInHour >= 16) {
                                // 4:00 PM or onwards 
                                dailyAdjustment -= dailySalary;
                                consecutiveLateCheckIn = 0;
                            }
                        } else {
                            // Timely check-in
                            consecutiveLateCheckIn = 0;
                        }

                        // Check-out rules (only if check-in was timely)
                        if (checkInTotalMinutes <= expectedCheckInMinutes && checkOutTime) {
                            const checkOutHour = checkOutTime.getHours();
                            const checkOutMinute = checkOutTime.getMinutes();
                            const checkOutTotalMinutes = checkOutHour * 60 + checkOutMinute;

                            if (checkOutTotalMinutes < 14 * 60) {
                                // Before 2:00 PM
                                dailyAdjustment -= dailySalary;
                                consecutiveEarlyCheckout = 0;
                            } else if (checkOutTotalMinutes >= 14 * 60 && checkOutTotalMinutes < expectedCheckOutStart * 60) {
                                // 2:00 - 5:00 PM
                                dailyAdjustment -= dailySalary * 0.5;
                                consecutiveEarlyCheckout = 0;
                            } else if (checkOutTotalMinutes >= expectedCheckOutStart * 60 && checkOutTotalMinutes < expectedCheckOutEnd * 60) {
                                // 5:00 - 6:00 PM
                                consecutiveEarlyCheckout++;
                                if (consecutiveEarlyCheckout >= 3) {
                                    dailyAdjustment -= dailySalary * 0.25;
                                } else {
                                    dailyAdjustment -= dailySalary * 0.25;
                                }
                            } else {
                                // On time or after 6 PM
                                consecutiveEarlyCheckout = 0;
                            }
                        }
                    } else {
                        // Not present, reset streaks
                        consecutiveLateCheckIn = 0;
                        consecutiveEarlyCheckout = 0;
                    }

                    attendanceAdjustments += dailyAdjustment;
                }

                // Note: Overtime parsing from notes omitted for brevity, but can be added
            });

            // Absent Logic: First absent paid
            if (emp.absent_days > 0) emp.total_paid_days++;

            // Not Marked
            emp.not_marked_days = totalCalendarDays - userAttendance.length;

            // Salary Calculation
            if (policy) {
                const fullBasic = policy.basic_salary || 0;
                const fullHra = policy.hra || 0;
                const fullTa = policy.travelling_allowance || 0;
                const fullCea = policy.children_education_allowance || 0;
                const fullFi = policy.fixed_incentive || 0;

                // Per day rate based on MONTHLY GROSS (for informational/absent deduction metric only)
                const monthlyGross = fullBasic + fullHra + fullTa + fullCea + fullFi;
                emp.per_day_rate = monthlyGross / totalCalendarDays;

                const daysRatio = emp.total_paid_days / totalCalendarDays;

                // Earned Components (Prorated)
                emp.basic_salary = Math.round((fullBasic / totalCalendarDays) * emp.total_paid_days);
                emp.hra = Math.round((fullHra / totalCalendarDays) * emp.total_paid_days);
                emp.travelling_allowance = Math.round((fullTa / totalCalendarDays) * emp.total_paid_days);
                emp.children_education_allowance = Math.round((fullCea / totalCalendarDays) * emp.total_paid_days);
                emp.fixed_incentive = Math.round((fullFi / totalCalendarDays) * emp.total_paid_days);

                // Gross Salary (Earned) - Excludes Employer contributions/Incentives
                const earnedGross = emp.basic_salary + emp.hra + emp.travelling_allowance + emp.children_education_allowance + emp.fixed_incentive;
                emp.base_earned_salary = earnedGross;

                // Employer Incentive (Cost to Company, not part of Gross Salary usually, unless cash component)
                // Matching Frontend: Employer Incentive is separate from Gross
                emp.employer_incentive = policy.employer_incentive || 0;

                // Deductions & Contributions
                // Employee PF
                if (policy.employee_pf_percentage) emp.employee_pf = Math.round((emp.basic_salary * policy.employee_pf_percentage) / 100);
                else if (policy.employee_pf_fixed) emp.employee_pf = Math.round(policy.employee_pf_fixed * daysRatio);

                // Employee ESI
                if (policy.employee_esi_percentage) emp.employee_esi = Math.round((earnedGross * policy.employee_esi_percentage) / 100);
                else if (policy.employee_esi_fixed) emp.employee_esi = Math.round(policy.employee_esi_fixed * daysRatio);

                // LWF
                emp.labour_welfare_employee = Math.round((policy.labour_welfare_employee || 0) * daysRatio);

                emp.total_employee_deduction = emp.employee_pf + emp.employee_esi + emp.labour_welfare_employee;

                // Employer Contributions (For CTC)
                // PF
                if (policy.employer_pf_percentage) emp.employer_pf = Math.round((emp.basic_salary * policy.employer_pf_percentage) / 100);
                else if (policy.employer_pf_fixed) emp.employer_pf = Math.round(policy.employer_pf_fixed * daysRatio);

                // ESI
                if (policy.employer_esi_percentage) emp.employer_esi = Math.round((earnedGross * policy.employer_esi_percentage) / 100);
                else if (policy.employer_esi_fixed) emp.employer_esi = Math.round(policy.employer_esi_fixed * daysRatio);

                // LWF Employer
                emp.labour_welfare_employer = Math.round((policy.labour_welfare_employer || 0) * daysRatio);

                // Ex Gratia
                if (policy.ex_gratia_percentage) emp.ex_gratia = Math.round((emp.basic_salary * policy.ex_gratia_percentage) / 100);
                else if (policy.ex_gratia_fixed) emp.ex_gratia = Math.round(policy.ex_gratia_fixed * daysRatio);

                emp.total_employer_contribution = emp.employer_pf + emp.employer_esi + emp.labour_welfare_employer + emp.ex_gratia + emp.employer_incentive;

                // Penalties (Late)
                let lateMultiplier = 10; // Default
                if (policy.late_penalty_enabled === false) lateMultiplier = 0; // Explicitly disabled

                emp.late_penalty = emp.late_count * (policy.late_penalty_per_minute || 0) * lateMultiplier;

                // Absent Deduction: Display only (implicit in prorata)
                // We calculate it just for record keeping if needed, but DO NOT deduct from Gross again.
                if (emp.absent_days > 1) {
                    emp.absent_deduction = Math.round((emp.absent_days - 1) * emp.per_day_rate);
                } else {
                    emp.absent_deduction = 0;
                }
            }

            // Adjustments
            const adjustments = await SalaryAdjustment.find({ employee_email: userEmail, month });
            let bonus = 0, other_deductions = 0;
            adjustments.forEach(adj => {
                // Additions - Include approved adjustments and all incentives (auto-approved)
                if (adj.status === 'approved' && ['bonus', 'reimbursement', 'allowance', 'other'].includes(adj.adjustment_type) && adj.amount > 0) {
                    bonus += adj.amount;
                } else if (adj.adjustment_type === 'incentive' && adj.amount > 0) {
                    // Auto-include all incentive bonuses regardless of status
                    bonus += adj.amount;
                }
                // Deductions (Negative amounts or specific types)
                else if (['advance_deduction', 'penalty'].includes(adj.adjustment_type) || adj.amount < 0) {
                    other_deductions += Math.abs(adj.amount);
                }
            });

            // Advances
            const advances = await SalaryAdvance.find({ employee_email: userEmail, status: 'active' });
            let advance_recovery = 0;
            for (const adv of advances) {
                // Simple logic: if advance active and start month passed/current, deduct installment
                if (adv.recovery_start_month <= month) {
                    advance_recovery += Math.min(adv.installment_amount || 0, adv.remaining_balance);
                }
            }

            // Final Totals
            emp.gross_salary = emp.base_earned_salary + attendanceAdjustments;

            // Total Deductions = Statutory + Penalties + Other Deductions + Advance Recovery
            // NOT Absent Deduction (already handled by Prorata Gross)
            emp.total_deductions = emp.total_employee_deduction + emp.late_penalty + other_deductions + advance_recovery;

            // Net Salary = Gross + Additions - Deductions
            emp.net_salary = (emp.gross_salary + bonus) - emp.total_deductions;

            emp.cash_in_hand = emp.net_salary; // Usually same as Net for bank transfer

            emp.attendance_adjustments = attendanceAdjustments;
            emp.ctc_monthly = emp.gross_salary + emp.total_employer_contribution;

            employeeSalaries[userEmail] = emp;
        }

        // Upsert Results
        const results = [];
        for (const email in employeeSalaries) {
            const empData = employeeSalaries[email];
            const existing = await SalaryRecord.findOne({ employee_email: email, month });

            if (existing && !existing.locked) {
                Object.assign(existing, empData);
                await existing.save();
                results.push({ ...empData, id: existing._id, action: 'updated' });
            } else if (!existing) {
                const newRecord = new SalaryRecord(empData);
                await newRecord.save();
                results.push({ ...empData, id: newRecord._id, action: 'created' }); // .toObject() if needed
            } else {
                results.push({ ...existing.toObject(), action: 'skipped_locked' });
            }
        }

        res.json({ success: true, results, total_processed: results.length });

    } catch (error) {
        console.error('Salary Calculation Error:', error);
        res.status(500).json({ error: error.message });
    }
};
