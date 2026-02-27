import axios from 'axios';
import Papa from 'papaparse';

const PATIENT_SHEET_URL = process.env.PATIENT_SHEET_URL;
const BENEFACTOR_SHEET_URL = process.env.BENEFACTOR_SHEET_URL;

export async function fetchPatients() {
    try {
        const response = await axios.get(PATIENT_SHEET_URL);
        // Remove the first line (the title line)
        const lines = response.data.split('\n');
        const csvData = lines.slice(1).join('\n');

        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        return parsed.data.map(p => {
            let name = p['Name'] || '';
            // New Aggressive Clean: Remove everything starting from " dr", " dr.", or " doctor"
            name = name.replace(/\s+(dr\.?|doctor).*$/i, '').trim();
            return {
                name: name,
                phone: p['Phone'],
                mrNo: p['MR Number'] // New hidden field for automation
            };
        }).filter(p => p.name);
    } catch (error) {
        console.error('Error fetching patients:', error);
        return [];
    }
}

export async function fetchBenefactors() {
    try {
        const response = await axios.get(BENEFACTOR_SHEET_URL);
        const parsed = Papa.parse(response.data, { header: true, skipEmptyLines: true });
        return parsed.data.map(b => {
            const firstName = b['[Contacts] First Name'] || '';
            const lastName = b['[Contacts] Last Name'] || '';
            const email = b['[Contacts] Email'] || '';
            const city = b['[Contacts] Serving City'] || '';
            return {
                name: `${firstName} ${lastName}`.trim(),
                email: email.trim(),
                city: city.trim()
            };
        }).filter(b => b.name);
    } catch (error) {
        console.error('Error fetching benefactors:', error);
        return [];
    }
}
