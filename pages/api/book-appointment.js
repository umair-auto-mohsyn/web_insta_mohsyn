import { bookAppointment } from '../../lib/automation';
import { createHubSpotTicket } from '../../lib/hubspot';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { formData, credentials } = req.body;

    try {
        const result = await bookAppointment({
            ...formData,
            username: credentials?.username || process.env.INSTACARE_USERNAME,
            password: credentials?.password || process.env.INSTACARE_PASSWORD
        });

        if (result.success) {
            // After successful booking, create HubSpot ticket
            try {
                console.log('Automation success, creating HubSpot ticket...');
                await createHubSpotTicket(formData);
            } catch (hsError) {
                console.error('HubSpot Error (Non-blocking):', hsError.message);
                // We return success anyway because the appointment WAS booked
            }
            res.status(200).json(result);
        } else {
            res.status(500).json(result);
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
}
