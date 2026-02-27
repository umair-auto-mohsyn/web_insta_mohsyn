const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

function logToFile(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        fs.appendFileSync(path.join(process.cwd(), 'automation.log'), logMessage);
    } catch (e) {
        console.error('Failed to write to log file:', e);
    }
    console.log(message);
}

async function bookAppointment(data) {
    const startTime = Date.now();
    logToFile('Starting bookAppointment function (Fast-Lane V9 - Cloud Optimized)...');
    let browser;
    let page;
    try {
        logToFile('Launching browser...');
        if (process.env.BROWSERLESS_TOKEN) {
            logToFile('Connecting to Browserless.io...');
            browser = await chromium.connectOverCDP(
                `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}&--disable-notifications=true`
            );
        } else {
            logToFile('Running local browser (Development Mode)...');
            browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }

        const context = await browser.newContext({
            viewport: { width: 1280, height: 1000 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
        });
        page = await context.newPage();

        logToFile('Logging in...');
        await page.goto('https://app.instacare.pk/login', { waitUntil: 'domcontentloaded' });
        await page.fill('#Username', data.username || '03360565951');
        await page.fill('#Password', data.password || 'Automate');
        await page.click('#signInBtn');

        logToFile('Waiting for Dashboard/Sidebar...');
        await page.waitForURL('**/Dashboard', { timeout: 30000 });

        logToFile('Navigating to Appointments via Sidebar...');
        await page.click('a[href="/appointments"]');

        logToFile('Opening Appointment Portal...');
        const triggerSelector = '.open-appointment-portal, button:has-text("Add Appointment")';
        const trigger = await page.waitForSelector(triggerSelector, { timeout: 30000 });
        await trigger.click();

        const modal = await page.waitForSelector('.modal-content:visible', { timeout: 30000 });
        logToFile('Appointment modal opened.');

        const fillDate = async (targetDate) => {
            let formattedDate = targetDate;
            if (targetDate.includes('-')) {
                const parts = targetDate.split('-');
                formattedDate = `${parts[1]}/${parts[2]}/${parts[0]}`;
            }
            logToFile(`Typing Date: ${formattedDate}`);
            const dateInput = await modal.waitForSelector('label:has-text("Date") + input, .flatpickr-input');
            await dateInput.click();
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await dateInput.type(formattedDate, { delay: 100 });
            await page.keyboard.press('Enter');
            await page.keyboard.press('Tab');
            await waitForLoadingOverlay('Date Entry');
        };

        const waitForLoadingOverlay = async (contextName) => {
            const loadingOverlaySelector = 'div:has-text("LOADING DETAILS")';
            try {
                const isVisible = await page.waitForSelector(loadingOverlaySelector, { state: 'visible', timeout: 3000 }).catch(() => null);
                if (isVisible) {
                    logToFile(`Loading detected for ${contextName}, waiting...`);
                    // Optimized wait for loading overlay
                    const loadingSelector = '.loading-details-overlay'; // Hypothesis, checking if it exists
                    try {
                        await page.waitForSelector(loadingSelector, { state: 'attached', timeout: 1000 });
                        await page.waitForSelector(loadingSelector, { state: 'hidden', timeout: 5000 });
                    } catch (e) {
                        await page.waitForTimeout(2000); // Fallback shorter wait
                    }
                    await page.waitForSelector(loadingOverlaySelector, { state: 'hidden', timeout: 30000 });
                }
            } catch (e) { }
            // Reduced from 3000 to 500ms for production speed
            await page.waitForTimeout(500);
        };

        const selectByLabel = async (labelText, value, optional = false) => {
            if (!value && labelText !== 'Service' && labelText !== 'Speciality' && labelText !== 'Gender') return;
            try {
                const label = await modal.$(`label:has-text("${labelText}")`);
                if (!label) return;

                let select = await modal.$(`select:near(label:has-text("${labelText}"))`);
                if (!select) {
                    const formGroup = await label.evaluateHandle(el => el.closest('.form-group, .col-md-6, div'));
                    select = await formGroup.$('select');
                }

                if (select) {
                    const options = await select.$$eval('option', opts => opts.map(o => o.label || o.textContent.trim()));

                    if (!value || value === '' || value.toLowerCase().includes('select')) {
                        logToFile(`${labelText} left as default or skipped.`);
                        return;
                    }

                    const normalize = (s) => {
                        let norm = s.toLowerCase().replace(/[^a-z0-9]/g, '');
                        if (labelText.includes('Time')) norm = norm.replace(/^0/, '');
                        return norm;
                    };
                    const nv = normalize(value);

                    const match = options.find(o => {
                        const no = normalize(o);
                        if (labelText.includes('Time')) {
                            const reqIsPM = value.toUpperCase().includes('PM');
                            const optIsPM = o.toUpperCase().includes('PM');
                            return no === nv && reqIsPM === optIsPM;
                        }
                        return no === nv || no.includes(nv);
                    });

                    if (match) {
                        await select.selectOption({ label: match });
                        logToFile(`Selected ${labelText}: ${match}`);
                        await waitForLoadingOverlay(labelText);
                    } else if (!optional) {
                        throw new Error(`${value} not found in ${labelText}. Top options: [${options.slice(0, 10).join(', ')}]`);
                    }
                }
            } catch (e) {
                logToFile(`Error in ${labelText}: ${e.message}`);
                if (!optional) throw e;
            }
        };

        // 1. Patient Info
        const searchTerms = [data.patientPhone, data.patientName].filter(t => t && t.length > 2);
        logToFile(`Searching Patient with terms: ${searchTerms.join(', ')}`);

        const phoneInput = await modal.waitForSelector('input[placeholder*="03001234450"]');
        let patientFound = false;

        for (const term of searchTerms) {
            logToFile(`Trying search term: ${term}`);
            await phoneInput.click();
            await page.keyboard.press('Control+A');
            await page.keyboard.press('Backspace');
            await phoneInput.type(term, { delay: 100 });

            // Wait for dropdown results to appear
            try {
                const resultItem = await page.waitForSelector('.ui-autocomplete .ui-menu-item:visible', { timeout: 6000 });
                if (resultItem) {
                    logToFile(`Found patient result for term: ${term}. Clicking it...`);
                    await resultItem.click();
                    patientFound = true;
                    break;
                }
            } catch (e) {
                logToFile(`No dropdown result for term: ${term}`);
            }
        }

        if (!patientFound) {
            logToFile('WARNING: No patient found via search. Typing manually as fallback...');
            await phoneInput.fill(data.patientPhone || '');
            const nameInput = await modal.$('input[placeholder*="Full Name"]');
            if (nameInput) await nameInput.fill(data.patientName || '');
        }

        await waitForLoadingOverlay('Patient Selection');

        await selectByLabel('Gender', data.gender, true);
        await selectByLabel('Location', data.location || 'Mohsyn');
        await selectByLabel('Speciality', data.speciality, true);
        await selectByLabel('Doctor', data.doctor);
        // Note: 'Service' is for HubSpot only as per user request, skipping Instacare selection
        await selectByLabel('Appointment Type', data.appointmentType);
        await selectByLabel('Appointment Source', data.appointmentSource);

        const benefactorInput = await modal.$('input:near(label:has-text("Benefactor"))');
        if (benefactorInput && data.benefactor) await benefactorInput.fill(data.benefactor);

        // Fill Complaints/Reason and Notes (New Fix)
        const complaintsArea = await modal.$('textarea:near(label:has-text("Complaints/Reason"))');
        if (complaintsArea && data.complaints) {
            logToFile('Filling Complaints/Reason...');
            await complaintsArea.fill(data.complaints);
        }

        const notesArea = await modal.$('textarea:near(label:has-text("Notes"))');
        if (notesArea && data.notes) {
            logToFile('Filling Notes...');
            await notesArea.fill(data.notes);
        }

        // 5. DATE AT END - TRIPLE SHAKE NUDGE
        logToFile('Triggering Double-Shake Date Nudge...');
        // Correcting year formatting and using shorter interval
        const currentYear = new Date().getFullYear();
        await page.fill('#AppointmentDate', `12/31/${currentYear + 1}`);
        await page.press('#AppointmentDate', 'Enter');
        await page.waitForTimeout(300);
        await page.fill('#AppointmentDate', data.date);
        await page.press('#AppointmentDate', 'Enter');
        await page.waitForTimeout(1000); // Wait for slots to settle

        // EXTREME SYNC CHECK (V6 logic enhanced)
        logToFile('Verifying Slots Context...');
        const checkSlots = async () => {
            const startSelect = await modal.$('select:near(label:has-text("Start Time"))');
            return startSelect ? await startSelect.$$eval('option', os => os.filter(o => !o.text.includes('Select') && !o.text.includes('Loading')).map(o => o.text)) : [];
        };

        let slots = await checkSlots();
        const reqIsPM = data.startTime.toUpperCase().includes('PM');
        let hasContext = reqIsPM ? slots.some(s => s.includes('PM')) : slots.some(s => s.includes('AM'));

        if (slots.length === 0 || !hasContext) {
            logToFile(`Context Mismatch. Triggering Location Shake...`);
            await selectByLabel('Location', 'Mohsyn'); // Select again to shake all dropdowns
            await page.waitForTimeout(2000);
            await fillDate(data.date);
            await page.waitForTimeout(10000);
            slots = await checkSlots();
        }

        logToFile(`Final Slot Peek: ${slots.slice(0, 10).join(', ')}`);

        // 6. TIME SLOTS
        await selectByLabel('Start Time', data.startTime);
        await page.waitForTimeout(1500); // Reduced from 4000
        await selectByLabel('End Time', data.endTime);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);
        logToFile(`Automation success in ${duration}s, creating HubSpot ticket...`);
        const scheduleBtn = await modal.waitForSelector('button:has-text("Schedule Appointment")');
        await scheduleBtn.click();

        // V8 Fix: Verify the modal actually closes or success is confirmed
        logToFile('Checking for submission success...');
        const finalS = `success-final-${Date.now()}.png`;
        await page.screenshot({ path: finalS });
        const modalClosed = await page.waitForSelector('.modal-content:visible', { state: 'hidden', timeout: 8000 }).then(() => true).catch(() => false);

        if (!modalClosed) {
            // Check for red validation messages on the page
            const errors = await modal.$$eval('.text-danger, .validation-summary-errors', els => els.map(el => el.textContent.trim()).filter(t => t.length > 3));
            throw new Error(`Submission failed! Modal is still open. Errors detected: [${errors.join('; ')}]`);
        }

        return {
            success: true,
            message: `Appointment for ${data.patientName} scheduled successfully for ${data.date} at ${data.startTime}.`,
            screenshot: finalS
        };

    } catch (e) {
        logToFile(`CRITICAL FAIL: ${e.message}`);
        const errS = `fail-${Date.now()}.png`;
        if (page) {
            try { await page.screenshot({ path: errS }); } catch (err) { }
        }
        return { success: false, error: e.message, screenshot: page ? errS : null };
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { bookAppointment };

