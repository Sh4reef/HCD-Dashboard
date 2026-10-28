// Common Types & Data Enums for HCD System

const UserRole = {
  HCD_SUPER_ADMIN: 'HCD_SUPER_ADMIN',
  DEPUTY_HEAD_HCS_BS: 'DEPUTY_HEAD_HCS_BS',
  HCD_OFFICER_SPECIALIST: 'HCD_OFFICER_SPECIALIST',
  CULTURE_COMM_PIC: 'CULTURE_COMM_PIC'
};

const ProgramModality = {
  OJT: 'OJT',
  MAGANG: 'Magang',
  PKL: 'PKL'
};

const ReportStatus = {
  NOT_SUBMITTED: 'NOT_SUBMITTED',
  SUBMITTED: 'SUBMITTED'
};

const LicenseClassification = {
  MANDATORI_REGULASI: 'Mandatori Regulasi',
  MANDATORI_KORPORASI: 'Mandatori Korporasi'
};

const ParticipantStatus = {
  ENROLLED: 'ENROLLED',
  ATTENDED: 'ATTENDED',
  CANCELLED: 'CANCELLED',
  CERTIFIED: 'CERTIFIED'
};

const KpiPolarity = {
  MAXIMIZE: 'MAXIMIZE',
  MINIMIZE: 'MINIMIZE'
};

const KpiHealth = {
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED: 'RED'
};

const InnovationStage = {
  IDEA_SUBMITTED: 'Idea Submitted',
  DESK_REVIEW: 'Desk Review',
  PILOT_PROTOTYPE: 'Pilot / Prototype',
  IMPLEMENTATION: 'Implementation',
  INSTITUTIONALIZED: 'Institutionalized'
};

module.exports = {
  UserRole,
  ProgramModality,
  ReportStatus,
  LicenseClassification,
  ParticipantStatus,
  KpiPolarity,
  KpiHealth,
  InnovationStage
};
