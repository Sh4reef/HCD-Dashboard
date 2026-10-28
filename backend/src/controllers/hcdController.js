const db = require('../db');
const sheetService = require('../services/sheetService');

// Domain Calculations & Business Logic Implementations

// 1. Auth & Domain Restriction Guard (@company.com)
exports.handleGoogleOAuthCallback = (req, res) => {
  const { email, hd } = req.body;

  if (!email || !hd) {
    return res.status(400).json({ error: 'Email and hd claims are required.' });
  }

  // PRD & TDD Rule: Restrict strictly to @company.com
  if (hd !== 'company.com' || !email.endsWith('@company.com')) {
    return res.status(403).json({
      error: 'HTTP 403 Forbidden: Access denied. Google hd claim must be @company.com.'
    });
  }

  // User Lookup
  const user = db.users.find(u => u.email === email && u.isActive);
  const employee = db.employees.find(e => e.email === email);

  if (!user && !employee) {
    return res.status(403).json({
      error: 'HTTP 403 Forbidden: User record not registered or inactive in employee directory.'
    });
  }

  const role = user ? user.role : 'HCD_OFFICER_SPECIALIST';

  res.json({
    message: 'Authentication successful',
    user: {
      email,
      fullName: employee ? employee.fullName : 'HCD User',
      role
    }
  });
};

// 2. Module 1: Internship Management & Certificate Gate Rule
exports.getInternships = (req, res) => {
  res.json({ data: db.internships, quotas: db.quotas });
};

exports.issueInternshipCertificate = (req, res) => {
  const { id } = req.params;
  const { certificateNumber } = req.body;

  const intern = db.internships.find(i => i.id === id);
  if (!intern) {
    return res.status(404).json({ error: 'Internship record not found.' });
  }

  // Certificate Issuance Gate Rule: MUST be SUBMITTED
  if (intern.reportStatus !== 'SUBMITTED') {
    return res.status(400).json({
      error: 'BUSINESS RULE VIOLATION: Certificate cannot be generated or issued until Internship Report status is SUBMITTED.'
    });
  }

  intern.certificateNumber = certificateNumber || `CERT/HCD/2026/${Math.floor(100 + Math.random() * 900)}`;
  intern.operationalStatus = 'FINISHED';
  intern.lifecycleStep = 6;

  res.json({
    message: 'Certificate successfully generated and issued.',
    intern
  });
};

// 3. Module 2: License Expiration & Archiving
exports.getLicenses = (req, res) => {
  const now = new Date();

  const processedLicenses = db.licenses.map(lic => {
    const exp = new Date(lic.expirationDate);
    const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return {
      ...lic,
      daysRemaining: diffDays,
      isCritical: diffDays <= 60
    };
  });

  res.json({ data: processedLicenses, archives: db.licenseArchives });
};

exports.renewLicense = (req, res) => {
  const { id } = req.params;
  const { newIssueDate, newDurationMonths } = req.body;

  const licIndex = db.licenses.findIndex(l => l.id === id);
  if (licIndex === -1) {
    return res.status(404).json({ error: 'License not found.' });
  }

  const currentLic = db.licenses[licIndex];

  // Move current to Archive
  db.licenseArchives.push({
    id: `arch-${Date.now()}`,
    licenseId: currentLic.id,
    nik: currentLic.nik,
    certificateTitle: currentLic.certificateTitle,
    registrationNumber: currentLic.registrationNumber,
    issueDate: currentLic.issueDate,
    expirationDate: currentLic.expirationDate,
    archivedReason: 'RENEWED',
    archivedAt: new Date().toISOString()
  });

  // Calculate new expiration date
  const issue = new Date(newIssueDate || Date.now());
  const months = parseInt(newDurationMonths || currentLic.validityDurationMonths, 10);
  const newExp = new Date(issue);
  newExp.setMonth(newExp.getMonth() + months);

  currentLic.issueDate = issue.toISOString().split('T')[0];
  currentLic.validityDurationMonths = months;
  currentLic.expirationDate = newExp.toISOString().split('T')[0];

  res.json({ message: 'License renewed and previous record archived.', updatedLicense: currentLic });
};

// 4. Module 3: Employee Training Programs & 24h Deficit Queue
exports.getUnderTrainedQueue = (req, res) => {
  const queue = db.employees
    .filter(e => e.annualLearningHours < 24.0)
    .map(e => ({
      nik: e.nik,
      fullName: e.fullName,
      email: e.email,
      branchId: e.branchId,
      annualLearningHours: e.annualLearningHours,
      deficitHours: (24.0 - e.annualLearningHours).toFixed(2)
    }))
    .sort((a, b) => parseFloat(b.deficitHours) - parseFloat(a.deficitHours));

  res.json({ underTrainedQueue: queue, mandatoryTarget: 24.0 });
};

exports.updateParticipantStatus = (req, res) => {
  const { participantId } = req.params;
  const { status } = req.body;

  const participant = db.trainingParticipants.find(tp => tp.id === participantId);
  if (!participant) {
    return res.status(404).json({ error: 'Participant record not found.' });
  }

  const program = db.trainingPrograms.find(tp => tp.id === participant.programId);

  participant.status = status;
  if (status === 'CERTIFIED') {
    participant.awardedHours = program ? program.creditHours : 8.0;
  } else {
    participant.awardedHours = 0.0;
  }

  const empParticipants = db.trainingParticipants.filter(tp => tp.nik === participant.nik && tp.status === 'CERTIFIED');
  const totalHours = empParticipants.reduce((sum, tp) => sum + tp.awardedHours, 0);

  const emp = db.employees.find(e => e.nik === participant.nik);
  if (emp) {
    emp.annualLearningHours = totalHours;
  }

  res.json({
    message: `Participant status updated to ${status}. Learning hours recalculated.`,
    participant,
    updatedEmployeeTotalHours: emp ? emp.annualLearningHours : 0
  });
};

// 5. Module 4: KPI Polarity Scoring Engine
exports.getKpis = (req, res) => {
  const processedKpis = db.kpis.map(kpi => {
    let achievement = 0;
    const A = parseFloat(kpi.actualValue);
    const T = parseFloat(kpi.targetValue);

    if (kpi.polarity === 'MAXIMIZE') {
      achievement = Math.min((A / T) * 100, 120);
    } else if (kpi.polarity === 'MINIMIZE') {
      if (A <= T) {
        achievement = 100;
      } else {
        achievement = Math.max((1 - (A - T) / T) * 100, 0);
      }
    }

    const weightedScore = (achievement * kpi.weight) / 100;

    let healthStatus = 'RED';
    if (achievement >= 100) healthStatus = 'GREEN';
    else if (achievement >= 85) healthStatus = 'AMBER';

    return {
      ...kpi,
      achievementPercent: parseFloat(achievement.toFixed(2)),
      weightedScore: parseFloat(weightedScore.toFixed(2)),
      healthStatus
    };
  });

  const aggregateScore = processedKpis.reduce((sum, k) => sum + k.weightedScore, 0);

  res.json({ kpis: processedKpis, aggregateWeightedScore: parseFloat(aggregateScore.toFixed(2)) });
};

// 6. Module 5 & Halo HC SLA Breach Engine
exports.getHaloHcTickets = (req, res) => {
  const now = new Date();

  const processedTickets = db.haloHcTickets.map(tkt => {
    const opened = new Date(tkt.openedAt);
    const elapsedHours = (now - opened) / (1000 * 60 * 60);
    const isBreached = tkt.status !== 'RESOLVED' && tkt.status !== 'CLOSED' && elapsedHours > tkt.slaTargetHours;

    return {
      ...tkt,
      elapsedHours: parseFloat(elapsedHours.toFixed(1)),
      isBreached
    };
  });

  res.json({ data: processedTickets });
};

// 7. Module 6: Executive Analytics Dashboard
exports.getExecutiveAnalytics = (req, res) => {
  const now = new Date();

  const kpiRes = db.kpis.map(kpi => {
    const A = parseFloat(kpi.actualValue);
    const T = parseFloat(kpi.targetValue);
    const ach = kpi.polarity === 'MAXIMIZE' ? Math.min((A / T) * 100, 120) : (A <= T ? 100 : Math.max((1 - (A - T) / T) * 100, 0));
    return (ach * kpi.weight) / 100;
  });
  const totalKpiScore = kpiRes.reduce((a, b) => a + b, 0);

  const totalStaff = db.employees.length;
  const underTrainedStaff = db.employees.filter(e => e.annualLearningHours < 24.0).length;
  const underTrainedRate = ((underTrainedStaff / totalStaff) * 100).toFixed(1);

  const criticalLicenses = db.licenses.filter(l => {
    const exp = new Date(l.expirationDate);
    const days = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    return days <= 60;
  }).length;

  const totalPlan = db.trainingBudgets.reduce((s, b) => s + b.planBudget, 0);
  const totalPayment = db.trainingBudgets.reduce((s, b) => s + b.realizationPayment, 0);
  const budgetUtilization = totalPlan > 0 ? ((totalPayment / totalPlan) * 100).toFixed(1) : '0.0';

  res.json({
    kpiHealthScore: parseFloat(totalKpiScore.toFixed(1)),
    underTrainedRate: parseFloat(underTrainedRate),
    underTrainedCount: underTrainedStaff,
    totalStaff,
    criticalLicensesExpiring: criticalLicenses,
    totalActiveInterns: db.internships.filter(i => i.operationalStatus === 'ACTIVE').length,
    budgetPlan: totalPlan,
    budgetPayment: totalPayment,
    budgetUtilizationPercent: parseFloat(budgetUtilization),
    haloHcBreachedTickets: db.haloHcTickets.filter(t => t.isBreached).length
  });
};

// 8. Google Sheets Sync Execution Trigger with Live Parsing
exports.triggerSheetSync = async (req, res) => {
  const startTime = Date.now();

  try {
    const liveBudgets = await sheetService.syncBudgetSheet();
    const liveInternships = await sheetService.syncInternshipSheet();
    const liveLicenses = await sheetService.syncLicenseSheet();
    const liveTrainingPrograms = await sheetService.syncTrainingSheet();

    if (liveBudgets.length > 0) db.trainingBudgets = liveBudgets;
    if (liveInternships.length > 0) db.internships = liveInternships;
    if (liveLicenses.length > 0) db.licenses = liveLicenses;
    if (liveTrainingPrograms.length > 0) db.trainingPrograms = liveTrainingPrograms;

    const totalProcessed = liveBudgets.length + liveInternships.length + liveLicenses.length + liveTrainingPrograms.length;

    const syncLog = {
      id: `sync-${Date.now()}`,
      spreadsheetName: 'All 4 Master Spreadsheets (Realisasi Anggaran, Internship, License, Training)',
      status: 'SUCCESS',
      recordsProcessed: totalProcessed,
      triggeredBy: req.body.triggeredBy || 'HCD_SUPER_ADMIN',
      durationMs: Date.now() - startTime,
      createdAt: new Date().toISOString()
    };

    db.sheetSyncLogs.unshift(syncLog);

    res.json({
      message: `Google Spreadsheets synchronized successfully from live Google Sheets links! Ingested ${totalProcessed} live records.`,
      log: syncLog
    });
  } catch (err) {
    console.error('Error syncing Google Sheets:', err);
    res.status(500).json({ error: 'Failed to sync Google Spreadsheets', details: err.message });
  }
};
