import { fetchPatients, fetchBenefactors } from '../../lib/google-sheets';

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const [patients, benefactors] = await Promise.all([
                fetchPatients(),
                fetchBenefactors()
            ]);

            res.status(200).json({ patients, benefactors });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch data' });
        }
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
