import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Attendance, User, AttendanceSettings } from './models/index.js';

dotenv.config();

const userEmail = 'ratnakerkumar56@gmail.com';

const generateAttendanceData = () => {
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-01-22');
  const data = [];

  // Specific scenarios to demonstrate rules
  const specificScenarios = [
    { date: '2026-01-01', type: 'on_time' },
    { date: '2026-01-02', type: 'late_20' },
    { date: '2026-01-03', type: 'late_30' },
    { date: '2026-01-06', type: 'late_25' }, // consecutive late
    { date: '2026-01-07', type: 'late_35' }, // consecutive late
    { date: '2026-01-08', type: 'late_40' }, // 3rd consecutive
    { date: '2026-01-09', type: 'on_time' }, // break consecutive
    { date: '2026-01-10', type: 'early_checkin_early_checkout' },
    { date: '2026-01-13', type: 'half_day' },
    { date: '2026-01-14', type: 'absent' },
    { date: '2026-01-15', type: 'leave' },
    { date: '2026-01-16', type: 'late_10' }, // within threshold
    { date: '2026-01-17', type: 'late_50' },
    { date: '2026-01-20', type: 'late_15' }, // exactly threshold
    { date: '2026-01-21', type: 'on_time' },
    { date: '2026-01-22', type: 'late_60' },
  ];

  const scenarioDefs = {
    on_time: { checkIn: '09:30', checkOut: '18:00', late: false, earlyCheckout: false },
    late_10: { checkIn: '10:10', checkOut: '18:00', late: true, lateMin: 10, earlyCheckout: false },
    late_15: { checkIn: '10:15', checkOut: '18:00', late: true, lateMin: 15, earlyCheckout: false },
    late_20: { checkIn: '10:20', checkOut: '18:00', late: true, lateMin: 20, earlyCheckout: false },
    late_25: { checkIn: '10:25', checkOut: '18:00', late: true, lateMin: 25, earlyCheckout: false },
    late_30: { checkIn: '10:30', checkOut: '18:00', late: true, lateMin: 30, earlyCheckout: false },
    late_35: { checkIn: '11:35', checkOut: '18:00', late: true, lateMin: 35, earlyCheckout: false },
    late_40: { checkIn: '11:40', checkOut: '18:00', late: true, lateMin: 40, earlyCheckout: false },
    late_50: { checkIn: '11:50', checkOut: '18:00', late: true, lateMin: 50, earlyCheckout: false },
    late_60: { checkIn: '12:00', checkOut: '18:00', late: true, lateMin: 60, earlyCheckout: false },
    early_checkin_early_checkout: { checkIn: '09:00', checkOut: '14:00', late: false, earlyCheckout: true },
    half_day: { status: 'half_day', checkIn: '09:30', checkOut: '13:00', late: false, earlyCheckout: true },
    absent: { status: 'absent' },
    leave: { status: 'leave' },
  };

  for (const scen of specificScenarios) {
    const def = scenarioDefs[scen.type];
    const record = {
      user_email: userEmail,
      user_name: 'Ratnaker',
      date: scen.date,
      status: def.status || 'present',
      check_in: def.checkIn ? new Date(`${scen.date}T${def.checkIn}:00+05:30`) : null,
      check_out: def.checkOut ? new Date(`${scen.date}T${def.checkOut}:00+05:30`) : null,
      is_late: def.late || false,
      late_minutes: def.lateMin || 0,
      is_early_checkout: def.earlyCheckout || false,
      notes: `Dummy data: ${scen.type}`,
    };
    data.push(record);
  }

  return data;
};

const main = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) throw new Error('MONGODB_URI not found');

    await mongoose.connect(mongoUri);
    console.log('Connected to DB');

    const user = await User.findOne({ email: userEmail });
    if (!user) {
      console.log('User not found, creating...');
      await User.create({
        email: userEmail,
        full_name: 'Ratnaker',
        role: 'user',
        role_id: 'team_member',
        is_active: true,
      });
    }

    // Ensure salary policy exists
    const existingPolicy = await SalaryPolicy.findOne({ user_email: userEmail });
    if (!existingPolicy) {
      console.log('Creating salary policy...');
      await SalaryPolicy.create({
        user_email: userEmail,
        user_name: 'Ratnaker',
        salary_type: 'monthly',
        basic_salary: 50000,
        late_penalty_enabled: true,
        late_penalty_per_minute: 10, // 10 rupees per minute late
        is_active: true,
      });
    }

    // Delete existing attendance for Jan 2026
    await Attendance.deleteMany({
      user_email: userEmail,
      date: { $gte: '2026-01-01', $lte: '2026-01-31' }
    });

    const data = generateAttendanceData();
    await Attendance.insertMany(data);
    console.log(`Inserted ${data.length} attendance records`);

  } catch (error) {
    console.error(error);
  } finally {
    mongoose.disconnect();
  }
};

main();