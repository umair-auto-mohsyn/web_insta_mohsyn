import React, { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useSession, signIn, signOut } from 'next-auth/react';
import {
    Calendar, Clock, User, Phone, Stethoscope, UserCheck, Share2, Send,
    MapPin, MessageSquare, Info, History, LogOut, CheckCircle, Lock, ShieldCheck
} from 'lucide-react';

export default function AppointmentPortal() {
    const { data: session, status } = useSession();
    const [patients, setPatients] = useState([]);
    const [benefactors, setBenefactors] = useState([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [benefactorSearch, setBenefactorSearch] = useState('');
    const [filteredPatients, setFilteredPatients] = useState([]);
    const [filteredBenefactors, setFilteredBenefactors] = useState([]);
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [showBenefactorDropdown, setShowBenefactorDropdown] = useState(false);
    const [patientIndex, setPatientIndex] = useState(-1);
    const [benefactorIndex, setBenefactorIndex] = useState(-1);
    const [showSuccess, setShowSuccess] = useState(false);

    // Instacare Credentials Session State
    const [instacareCreds, setInstacareCreds] = useState({ username: '', password: '' });
    const [hasCreds, setHasCreds] = useState(false);

    const patientListRef = useRef(null);
    const benefactorListRef = useRef(null);

    const [formData, setFormData] = useState({
        patientPhone: '',
        countryCode: '+92',
        patientName: '',
        mrNo: '',
        gender: '',
        ageYears: '',
        ageMonths: '',
        ageDays: '',
        location: 'Mohsyn',
        speciality: '',
        doctor: '',
        service: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '11:00 AM',
        endTime: '11:10 AM',
        appointmentType: 'Regular Checkup',
        appointmentSource: '',
        benefactor: '',
        complaints: '',
        notes: '',
        recurring: false
    });

    useEffect(() => {
        if (session) {
            async function loadData() {
                try {
                    const response = await fetch('/api/fetch-data');
                    const data = await response.json();
                    setPatients(data.patients || []);
                    setBenefactors(data.benefactors || []);
                } catch (error) {
                    console.error('Failed to load data:', error);
                }
            }
            loadData();
        }
    }, [session]);

    useEffect(() => {
        if (showPatientDropdown && patientIndex >= 0 && patientListRef.current) {
            const el = patientListRef.current.children[patientIndex];
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [patientIndex, showPatientDropdown]);

    useEffect(() => {
        if (showBenefactorDropdown && benefactorIndex >= 0 && benefactorListRef.current) {
            const el = benefactorListRef.current.children[benefactorIndex];
            if (el) el.scrollIntoView({ block: 'nearest' });
        }
    }, [benefactorIndex, showBenefactorDropdown]);

    const handlePatientSearch = (e) => {
        const val = e.target.value;
        setPatientSearch(val);
        setFormData({ ...formData, patientName: val, mrNo: '' });
        if (val.length > 0) {
            const filtered = patients.filter(p => p.name.toLowerCase().startsWith(val.toLowerCase()));
            setFilteredPatients(filtered);
            setShowPatientDropdown(true);
            setPatientIndex(-1);
        } else {
            setShowPatientDropdown(false);
        }
    };

    const handleBenefactorSearch = (e) => {
        const val = e.target.value;
        setBenefactorSearch(val);
        setFormData({ ...formData, benefactor: val });
        if (val.length > 0) {
            const filtered = benefactors.filter(b => b.name.toLowerCase().startsWith(val.toLowerCase()));
            setFilteredBenefactors(filtered);
            setShowBenefactorDropdown(true);
            setBenefactorIndex(-1);
        } else {
            setShowBenefactorDropdown(false);
        }
    };

    const selectPatient = (patient) => {
        setFormData({
            ...formData,
            patientName: patient.name,
            mrNo: patient.mrNo || '',
            patientPhone: patient.phone.startsWith('92') ? patient.phone.slice(2) : patient.phone
        });
        setPatientSearch(patient.name);
        setShowPatientDropdown(false);
    };

    const selectBenefactor = (benefactor) => {
        setFormData({
            ...formData,
            benefactor: benefactor.name,
            benefactorEmail: benefactor.email,
            benefactorCity: benefactor.city
        });
        setBenefactorSearch(benefactor.name);
        setShowBenefactorDropdown(false);
    };

    const [isBooking, setIsBooking] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsBooking(true);
        try {
            const response = await fetch('/api/book-appointment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    formData,
                    credentials: instacareCreds
                })
            });

            const result = await response.json();
            if (result.success) {
                setShowSuccess(true);
                setTimeout(() => setShowSuccess(false), 5000);
            } else {
                alert('Automation Error: ' + result.error);
            }
        } catch (error) {
            console.error('Booking failed:', error);
            alert('Failed to trigger automation.');
        } finally {
            setIsBooking(false);
        }
    };

    if (status === 'loading') return <div className="loading-screen">Loading Session...</div>;

    // 1. Google Auth Screen
    if (!session) {
        return (
            <div className="auth-container">
                <Head><title>Login | Portal</title></Head>
                <div className="auth-card">
                    <ShieldCheck size={48} color="#818cf8" />
                    <h1>Welcome</h1>
                    <p>Please sign in with Google account to continue.</p>
                    <button className="btn-google" onClick={() => signIn('google')}>
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
                        Sign in with Google
                    </button>
                </div>
            </div>
        );
    }

    // 2. Instacare Credentials Screen
    if (!hasCreds) {
        const handleCredsKeyDown = (e) => {
            if (e.key === 'Enter' && instacareCreds.username && instacareCreds.password) {
                setHasCreds(true);
            }
        };

        return (
            <div className="auth-container">
                <Head><title>Setup | Portal</title></Head>
                <div className="auth-card">
                    <Lock size={40} color="#818cf8" />
                    <h1>Connect to Portal</h1>
                    <p>Please enter your correct credentials</p>
                    <div className="creds-form">
                        <input
                            type="text"
                            placeholder="Username"
                            value={instacareCreds.username}
                            onChange={(e) => setInstacareCreds({ ...instacareCreds, username: e.target.value })}
                            onKeyDown={handleCredsKeyDown}
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={instacareCreds.password}
                            onChange={(e) => setInstacareCreds({ ...instacareCreds, password: e.target.value })}
                            onKeyDown={handleCredsKeyDown}
                        />
                        <button className="btn-save" onClick={() => setHasCreds(true)} disabled={!instacareCreds.username || !instacareCreds.password}>
                            Start Session
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const timeIntervals = [];
    for (let h = 0; h < 24; h++) {
        for (let m = 0; m < 60; m += 10) {
            const period = h < 12 ? 'AM' : 'PM';
            const displayH = h % 12 || 12;
            const displayM = m.toString().padStart(2, '0');
            timeIntervals.push(`${displayH}:${displayM} ${period}`);
        }
    }

    return (
        <div className="container">
            <Head><title>Instacare Appointment Portal</title></Head>

            {showSuccess && (
                <div className="success-overlay">
                    <div className="success-notif">
                        <CheckCircle size={50} color="#10b981" />
                        <h2>Appointment Booked!</h2>
                        <p>The appointment has been successfully scheduled on Instacare and synced to HubSpot.</p>
                    </div>
                </div>
            )}

            <div className="user-nav">
                <div className="user-info">
                    <img src={session.user.image} alt="" />
                    <span>{session.user.email}</span>
                </div>
                <button className="btn-logout" onClick={() => signOut()}>
                    <LogOut size={16} /> Logout
                </button>
            </div>

            <div className="card">
                <div className="header">
                    <h1>Appointment Portal</h1>
                    <p>Schedule patients efficiently on Instacare</p>
                </div>

                <form onSubmit={handleSubmit} className="form-grid">
                    {/* Form fields same as before... */}
                    <div className="form-group full-width" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
                        <label style={{ color: '#818cf8', fontSize: '0.9rem' }}>1. Patient Information</label>
                    </div>

                    <div className="form-group" style={{ position: 'relative' }}>
                        <label><User size={12} style={{ marginRight: 4 }} /> Patient Name</label>
                        <input type="text" placeholder="Enter Name" value={patientSearch} onChange={handlePatientSearch} required />
                        {showPatientDropdown && filteredPatients.length > 0 && (
                            <div className="autocomplete-dropdown" ref={patientListRef}>
                                {filteredPatients.map((p, i) => (
                                    <div key={i} className={`autocomplete-item ${patientIndex === i ? 'focused' : ''}`} onClick={() => selectPatient(p)}>{p.name}</div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group">
                        <label><Phone size={12} style={{ marginRight: 4 }} /> Patient Phone</label>
                        <div className="phone-input-container">
                            <select className="country-select" value={formData.countryCode} onChange={(e) => setFormData({ ...formData, countryCode: e.target.value })}>
                                <option value="+92">PK +92</option>
                                <option value="+1">US +1</option>
                                <option value="+44">UK +44</option>
                            </select>
                            <input type="text" placeholder="3001234450" value={formData.patientPhone} onChange={(e) => setFormData({ ...formData, patientPhone: e.target.value })} required style={{ flex: 1 }} />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Gender</label>
                        <select value={formData.gender} onChange={(e) => setFormData({ ...formData, gender: e.target.value })}>
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Age (Y / M / D)</label>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <input type="number" placeholder="YY" style={{ flex: 1 }} value={formData.ageYears} onChange={(e) => setFormData({ ...formData, ageYears: e.target.value })} />
                            <input type="number" placeholder="MM" style={{ flex: 1 }} value={formData.ageMonths} onChange={(e) => setFormData({ ...formData, ageMonths: e.target.value })} />
                            <input type="number" placeholder="DD" style={{ flex: 1 }} value={formData.ageDays} onChange={(e) => setFormData({ ...formData, ageDays: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-group full-width" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', margin: '0.25rem 0' }}>
                        <label style={{ color: '#818cf8', fontSize: '0.9rem' }}>2. Clinical & Appointment Details</label>
                    </div>

                    <div className="form-group"><label><MapPin size={12} style={{ marginRight: 4 }} /> Location</label><select value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })}><option value="Mohsyn">Mohsyn</option></select></div>
                    <div className="form-group"><label><Stethoscope size={12} style={{ marginRight: 4 }} /> Speciality</label><select value={formData.speciality} onChange={(e) => setFormData({ ...formData, speciality: e.target.value })}><option value="">Select Speciality</option>{['Acupuncturist', 'Cardiologist', 'Family Physician', 'General Physician', 'General Practitioner', 'Internal Medicine', 'Physician / Cardiologist', 'Physiotherapist', 'Psychologist'].map(s => (<option key={s} value={s}>{s}</option>))}</select></div>
                    <div className="form-group"><label><UserCheck size={12} style={{ marginRight: 4 }} /> Doctor</label><select value={formData.doctor} onChange={(e) => setFormData({ ...formData, doctor: e.target.value })} required><option value="">Select Doctor</option>{['Iqra Memon', 'Dr. Hassan Durrani', 'Farwa Batool', 'Dr. Waleed Usman', 'Dr.Sameer', 'Labeba Saya', 'Isha Ajmal', 'Dr. Mahad Younus', 'Elahha Mashrequi', 'Laiba Malik'].map(d => (<option key={d} value={d}>{d}</option>))}</select></div>
                    <div className="form-group"><label>Service (Mandatory)</label><select value={formData.service} onChange={(e) => setFormData({ ...formData, service: e.target.value })} required><option value="">Select Service</option><option value="Physotherapy">Physotherapy</option><option value="Treatment plan">Treatment plan</option></select></div>
                    <div className="form-group"><label><Calendar size={12} style={{ marginRight: 4 }} /> Date</label><input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required /></div>
                    <div className="form-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}><div><label><Clock size={12} style={{ marginRight: 4 }} /> Start</label><select value={formData.startTime} onChange={(e) => setFormData({ ...formData, startTime: e.target.value })} required style={{ width: '100%' }}>{timeIntervals.map((t, i) => <option key={i} value={t}>{t}</option>)}</select></div><div><label><Clock size={12} style={{ marginRight: 4 }} /> End</label><select value={formData.endTime} onChange={(e) => setFormData({ ...formData, endTime: e.target.value })} required style={{ width: '100%' }}>{timeIntervals.map((t, i) => <option key={i} value={t}>{t}</option>)}</select></div></div>
                    <div className="form-group"><label>Appointment Type</label><select value={formData.appointmentType} onChange={(e) => setFormData({ ...formData, appointmentType: e.target.value })}><option value="Regular Checkup">Regular Checkup</option><option value="Telemedicine">Telemedicine</option></select></div>
                    <div className="form-group"><label><Share2 size={12} style={{ marginRight: 4 }} /> Source (Mandatory)</label><select value={formData.appointmentSource} onChange={(e) => setFormData({ ...formData, appointmentSource: e.target.value })} required><option value="">Select Source</option><option value="Emergency">Emergency</option><option value="Regular/ Scheduled Visit">Regular/ Scheduled Visit</option><option value="Customer Requested">Customer Requested</option></select></div>

                    <div className="form-group full-width" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem', margin: '0.25rem 0' }}>
                        <label style={{ color: '#818cf8', fontSize: '0.9rem' }}>3. Additional Information (HubSpot)</label>
                    </div>

                    <div className="form-group full-width" style={{ position: 'relative' }}>
                        <label><Info size={12} style={{ marginRight: 4 }} /> Benefactor Name (Mandatory)</label>
                        <input type="text" placeholder="Search or type benefactor name..." value={benefactorSearch} onChange={handleBenefactorSearch} required />
                        {showBenefactorDropdown && filteredBenefactors.length > 0 && (
                            <div className="autocomplete-dropdown" ref={benefactorListRef}>
                                {filteredBenefactors.map((b, i) => (
                                    <div key={i} className={`autocomplete-item ${benefactorIndex === i ? 'focused' : ''}`} onClick={() => selectBenefactor(b)}>{b.name} <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>({b.email})</span></div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="form-group full-width"><label><MessageSquare size={12} style={{ marginRight: 4 }} /> Complaints / Reason</label><textarea placeholder="Enter purpose of appointment..." value={formData.complaints} onChange={(e) => setFormData({ ...formData, complaints: e.target.value })} rows={2} /></div>
                    <div className="form-group full-width"><label><Info size={12} style={{ marginRight: 4 }} /> Notes</label><textarea placeholder="Any additional notes..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2} /></div>

                    <div className="form-group full-width" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', marginTop: '0.5rem' }}>
                        <input type="checkbox" id="recurring" checked={formData.recurring} onChange={(e) => setFormData({ ...formData, recurring: e.target.checked })} style={{ width: 'auto', cursor: 'pointer' }} />
                        <label htmlFor="recurring" style={{ cursor: 'pointer', marginBottom: 0, textTransform: 'none', color: '#fff' }}><History size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> Mark as Recurring Appointment</label>
                    </div>

                    <button type="submit" className="btn-schedule" disabled={isBooking}>
                        {isBooking ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}><div className="spinner-gear"></div><span>Scheduling Appointment...</span></div>
                        ) : (
                            <><Send size={18} /> Schedule Appointment</>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
