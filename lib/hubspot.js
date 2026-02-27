const axios = require('axios');
const Papa = require('papaparse');

const HUBSPOT_TOKEN = process.env.HUBSPOT_TOKEN;
const HUBSPOT_API = 'https://api.hubapi.com';
const BENEFACTOR_SHEET_URL = process.env.BENEFACTOR_SHEET_URL;

const CITY_CODES = {
    'karachi': 'KHI',
    'lahore': 'LHR',
    'islamabad': 'ISL',
    'lodhran': 'LOD',
    'faisalabad': 'FSD',
    'rawalpindi': 'RWP',
    'multan': 'MUX'
};

/**
 * Creates a HubSpot ticket and associates it with a contact
 */
async function createHubSpotTicket(formData) {
    try {
        console.log('Creating HubSpot ticket for:', formData.patientName);

        // 0. Robust Data Lookup (Direct Fetch if city/email missing)
        let benefactorCity = (formData.benefactorCity || '').trim();
        let benefactorEmail = (formData.benefactorEmail || '').trim();

        if (!benefactorCity || !benefactorEmail) {
            console.log('City or Email missing in form, looking up benefactor data directly...');
            try {
                const sheetResponse = await axios.get(BENEFACTOR_SHEET_URL);
                const parsed = Papa.parse(sheetResponse.data, { header: true, skipEmptyLines: true });
                const found = parsed.data.find(b => {
                    const firstName = b['[Contacts] First Name'] || '';
                    const lastName = b['[Contacts] Last Name'] || '';
                    const fullName = `${firstName} ${lastName}`.trim();
                    return fullName.toLowerCase() === (formData.benefactor || '').toLowerCase();
                });

                if (found) {
                    benefactorCity = benefactorCity || found['[Contacts] Serving City'] || '';
                    benefactorEmail = benefactorEmail || found['[Contacts] Email'] || '';
                    console.log('Lookup successful:', { benefactorCity, benefactorEmail });
                } else {
                    console.log('Benefactor not found in sheet lookup.');
                }
            } catch (lookupError) {
                console.error('Direct benefactor lookup failed:', lookupError.message);
            }
        }

        // 1. Prepare Ticket Name
        const isDoctorTitle = /dr\.?/i.test(formData.doctor);
        const serviceLabel = isDoctorTitle ? 'Doctor' : 'Physio';

        const rawCity = (benefactorCity || '').trim().toLowerCase();
        let cityCode = CITY_CODES[rawCity];
        if (!cityCode && rawCity) {
            cityCode = rawCity.substring(0, 3).toUpperCase();
        }

        const ticketName = `Inhouse ${serviceLabel} Visit- ${formData.benefactor}-${cityCode ? ' ' + cityCode : ''}`;

        // 2. Determine Subcategory
        const isCustomerRequested = formData.appointmentSource === 'Customer Requested';

        let subcategory = '';
        if (isDoctorTitle) {
            subcategory = isCustomerRequested ? 'Mohsyn Doctor (Paid Visit)' : 'Mohsyn Doctor (Free Visit)';
        } else {
            subcategory = isCustomerRequested ? 'Physiotheraphy (Paid Visit)' : 'Physiotherapy (Free Visit)';
        }

        // 3. Generate Description
        const prefix = isDoctorTitle ? '' : 'Physiotherapist ';
        const description = `${prefix}${formData.doctor} will have a consultation visit with ${formData.benefactor} for ${formData.patientName} at ${formData.startTime} on ${formData.date}.`;

        // 4. Create Ticket Data
        const ticketData = {
            properties: {
                subject: ticketName,
                hs_pipeline: '0',
                hs_pipeline_stage: '1',
                ticket_category: 'Healthcare Services',
                ticket_sub_category: subcategory,
                content: description,
                serving_city: benefactorCity || ''
            }
        };

        console.log('Sending following properties to HubSpot:', JSON.stringify(ticketData.properties, null, 2));

        const ticketResponse = await axios.post(`${HUBSPOT_API}/crm/v3/objects/tickets`, ticketData, {
            headers: {
                Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        const ticketId = ticketResponse.data.id;
        console.log('Ticket created successfully:', ticketId);

        // 5. Associate with Contact
        if (benefactorEmail) {
            try {
                const contactId = await findContactByEmail(benefactorEmail);
                if (contactId) {
                    await associateTicketWithContact(ticketId, contactId);
                    console.log(`Associated ticket ${ticketId} with contact ${contactId}`);
                }
            } catch (assocError) {
                console.error('Failed to associate ticket:', assocError.message);
            }
        }

        return { success: true, ticketId };
    } catch (error) {
        console.error('HubSpot Ticket Error:', error.response?.data || error.message);
        throw error;
    }
}

async function findContactByEmail(email) {
    const response = await axios.post(`${HUBSPOT_API}/crm/v3/objects/contacts/search`, {
        filterGroups: [{
            filters: [{
                propertyName: 'email',
                operator: 'EQ',
                value: email
            }]
        }]
    }, {
        headers: {
            Authorization: `Bearer ${HUBSPOT_TOKEN}`,
            'Content-Type': 'application/json'
        }
    });

    return response.data.results?.[0]?.id;
}

async function associateTicketWithContact(ticketId, contactId) {
    await axios.put(
        `${HUBSPOT_API}/crm/v3/objects/tickets/${ticketId}/associations/contacts/${contactId}/ticket_to_contact`,
        {},
        {
            headers: {
                Authorization: `Bearer ${HUBSPOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );
}

module.exports = { createHubSpotTicket };
