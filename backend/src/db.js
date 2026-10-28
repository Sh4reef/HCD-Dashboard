// In-Memory Database Store simulating PostgreSQL Master Tables & Relations

class DatabaseStore {
  constructor() {
    this.reset();
  }

  reset() {
    this.branches = [
      { id: 'b-1', code: 'KR-2', name: 'Kantor Regional 2', regionalOffice: 'Kantor Regional 2' },
      { id: 'b-2', code: 'BR-SUB', name: 'Branch Surabaya', regionalOffice: 'Kantor Regional 2' },
      { id: 'b-3', code: 'BR-JKT', name: 'Branch Jakarta', regionalOffice: 'Kantor Regional 1' }
    ];

    this.employees = [
      { nik: '10001', fullName: 'Ahmad Subagyo', email: 'ahmad@company.com', branchId: 'b-1', division: 'HCD', position: 'HCD Officer', annualLearningHours: 18.0, status: 'PERMANENT' },
      { nik: '10002', fullName: 'Siti Rahma', email: 'siti@company.com', branchId: 'b-2', division: 'HCD', position: 'HCD Specialist', annualLearningHours: 28.5, status: 'PERMANENT' },
      { nik: '10003', fullName: 'Budi Santoso', email: 'budi@company.com', branchId: 'b-3', division: 'Operations', position: 'Branch Staff', annualLearningHours: 10.0, status: 'PERMANENT' },
      { nik: '10004', fullName: 'Rina Wijaya', email: 'rina@company.com', branchId: 'b-1', division: 'HCS & BS', position: 'Deputy Head', annualLearningHours: 32.0, status: 'PERMANENT' }
    ];

    this.users = [
      { id: 'u-1', nik: '10001', email: 'ahmad@company.com', role: 'HCD_SUPER_ADMIN', isActive: true },
      { nik: '10004', email: 'rina@company.com', role: 'DEPUTY_HEAD_HCS_BS', isActive: true }
    ];

    this.quotas = [
      { id: 'q-1', branchId: 'b-1', intakeBatch: '2026-Q1', quotaLimit: 10, currentUsage: 2 },
      { id: 'q-2', branchId: 'b-2', intakeBatch: '2026-Q1', quotaLimit: 5, currentUsage: 1 }
    ];

    this.internships = [
      {
        id: 'int-1',
        fullName: 'Dewi Lestari',
        nationalId: '3171012345670001',
        institution: 'Universitas Indonesia',
        major: 'Management',
        branchId: 'b-1',
        programType: 'OJT',
        startDate: '2026-01-15',
        endDate: '2026-07-15',
        operationalStatus: 'ACTIVE',
        lifecycleStep: 5,
        applicationStatus: 'OK',
        acceptanceLetterStatus: 'GIVEN_TO_INTERN',
        branchNotificationSent: true,
        reportStatus: 'NOT_SUBMITTED',
        certificateNumber: null
      },
      {
        id: 'int-2',
        fullName: 'Rian Pratama',
        nationalId: '3578012345670002',
        institution: 'ITS Surabaya',
        major: 'Industrial Engineering',
        branchId: 'b-2',
        programType: 'Magang',
        startDate: '2026-02-01',
        endDate: '2026-08-01',
        operationalStatus: 'FINISHED',
        lifecycleStep: 6,
        applicationStatus: 'OK',
        acceptanceLetterStatus: 'GIVEN_TO_INTERN',
        branchNotificationSent: true,
        reportStatus: 'SUBMITTED',
        certificateNumber: 'CERT/HCD/2026/001'
      }
    ];

    this.licenses = [
      {
        id: 'lic-1',
        nik: '10001',
        certificateTitle: 'Sertifikasi K3 Umum',
        issuingAuthority: 'Kementerian Ketenagakerjaan',
        registrationNumber: 'K3/2023/10293',
        classification: 'Mandatori Korporasi',
        issueDate: '2023-03-01',
        validityDurationMonths: 36,
        expirationDate: '2026-03-01', // Expiring within 60 days
        isActive: true
      },
      {
        id: 'lic-2',
        nik: '10003',
        certificateTitle: 'Lisensi Personel Penerbangan (Aviation Safety)',
        issuingAuthority: 'Kementerian Perhubungan',
        registrationNumber: 'KEMHUB/AV/2024/991',
        classification: 'Mandatori Regulasi',
        issueDate: '2024-01-15',
        validityDurationMonths: 24,
        expirationDate: '2026-01-15',
        isActive: true
      }
    ];

    this.licenseArchives = [];

    this.trainingBudgets = [
      { id: 'tb-1', fiscalYear: 2026, location: 'Kantor Regional 2', category: 'Mandatory Programs', planBudget: 500000000, realizationNka: 320000000, realizationPayment: 300000000 },
      { id: 'tb-2', fiscalYear: 2026, location: 'Kantor Regional 2', category: 'ISDP', planBudget: 300000000, realizationNka: 180000000, realizationPayment: 150000000 }
    ];

    this.trainingPrograms = [
      { id: 'tp-1', title: 'Aviation Safety & Compliance Refresher', category: 'MANDATORY_COMPLIANCE', modality: 'OFFLINE', provider: 'HCD Learning Center', creditHours: 8.0, cost: 50000000 },
      { id: 'tp-2', title: 'Strategic Leadership Mastery', category: 'LEADERSHIP', modality: 'HYBRID', provider: 'Executive Institute', creditHours: 16.0, cost: 75000000 }
    ];

    this.trainingParticipants = [
      { id: 'tpart-1', programId: 'tp-1', nik: '10001', status: 'CERTIFIED', awardedHours: 8.0 },
      { id: 'tpart-2', programId: 'tp-1', nik: '10003', status: 'ENROLLED', awardedHours: 0.0 }
    ];

    this.kpis = [
      { id: 'kpi-1', tier: 'TIER_1_DEPUTY', code: 'KPI-DEP-01', name: 'Workforce Mandatory Training Compliance Rate', weight: 30, targetValue: 100, actualValue: 95, polarity: 'MAXIMIZE', operationalCommentary: 'On track' },
      { id: 'kpi-2', tier: 'TIER_1_DEPUTY', code: 'KPI-DEP-02', name: 'License Expiration Audit Deficit', weight: 20, targetValue: 0, actualValue: 2, polarity: 'MINIMIZE', operationalCommentary: 'Follow up required' },
      { id: 'kpi-3', tier: 'TIER_2_HCD', code: 'KPI-HCD-01', name: 'Average Learning Hours per Employee', weight: 25, targetValue: 24, actualValue: 22.1, polarity: 'MAXIMIZE', operationalCommentary: 'Nearing 24h target' }
    ];

    this.culturePrograms = [
      { id: 'cult-1', programName: 'AKHLAK Culture Townhall', valuePillar: 'AKHLAK', executionDate: '2026-02-10', targetHeadcount: 200, actualHeadcount: 185, status: 'COMPLETED', avgInternalizationScore: 4.65 }
    ];

    this.innovationIdeas = [
      { id: 'inn-1', submissionCode: 'INOV-2026-01', title: 'Automated License Renewal Tracker', proposerNik: '10001', category: 'Digitalization', stage: 'Pilot / Prototype', expectedFinancialImpact: 120000000 }
    ];

    this.haloHcTickets = [
      { id: 'tkt-1', ticketNumber: 'HALO-2026-001', channel: 'WhatsApp', topicCategory: 'Training', requesterNik: '10003', requesterName: 'Budi Santoso', status: 'OPEN', slaTargetHours: 24, openedAt: new Date(Date.now() - 30 * 3600 * 1000).toISOString(), isBreached: true },
      { id: 'tkt-2', ticketNumber: 'HALO-2026-002', channel: 'Email', topicCategory: 'Certification', requesterNik: '10002', requesterName: 'Siti Rahma', status: 'RESOLVED', slaTargetHours: 24, openedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), isBreached: false }
    ];

    this.socialPosts = [
      { id: 'post-1', publicationDate: '2026-02-01', contentPillar: 'Culture Booster', format: 'REELS', titleTopic: 'AKHLAK In Action', grossImpressions: 12500, reach: 9800, likes: 850, comments: 42, shares: 30, saves: 110 }
    ];

    this.sheetSyncLogs = [
      { id: 'log-1', spreadsheetName: 'Realisasi Anggaran', status: 'SUCCESS', recordsProcessed: 4, durationMs: 450, createdAt: new Date().toISOString() }
    ];
  }
}

const db = new DatabaseStore();
module.exports = db;
