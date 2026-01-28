import { AttendanceSettings } from '../models/index.js';

export const seedAttendanceSettings = async () => {
    try {
        console.log('Seeding Attendance Settings...');

        // Check if settings already exist
        const existingSettings = await AttendanceSettings.findOne({});

        if (!existingSettings) {
            console.log('No attendance settings found. Creating default with geofencing...');
            await AttendanceSettings.create({
                work_start_time: '09:30',
                late_threshold_minutes: 15,
                minimum_work_hours: 9,
                early_checkout_threshold_hours: 8.5,
                allow_multiple_checkins: false,
                enable_geofencing: true,
                office_latitude: 28.39267838013335,
                office_longitude: 77.34004264294164,
                geofence_radius_meters: 500,
                week_off_days: [0], // Sunday
                require_checkout: true,
                auto_checkout_time: '23:59'
            });
            console.log('Upserted Attendance Settings with Geofencing Coordinates');
        } else {
            console.log('Attendance settings already exist. Skipping creation.');
            // Optional: If we want to FORCE update the coordinates every time, we could do that here.
            // For now, adhering to standard seed behavior (create if missing).

            // Uncomment the below if you want to force update coordinates on every seed run
            /*
            existingSettings.office_latitude = 28.39267838013335;
            existingSettings.office_longitude = 77.34004264294164;
            existingSettings.enable_geofencing = true;
            await existingSettings.save();
            console.log('Updated existing Attendance Settings with Geofencing Coordinates');
            */
        }
    } catch (error) {
        console.error('Error seeding attendance settings:', error);
    }
};
