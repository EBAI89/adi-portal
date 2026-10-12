'use strict';
/* ADI School of Social and Management Sciences — Academic Programme Handbook 2025–2026.
   Only what the Handbook states in full (code, title, credits, status, semester) is listed here as registrable courses.
   Row: [year, semester, code, title, credits, status (C compulsory / E elective / U university required), lecture h, tutorial h, practical h] */
const UNIV = [
  [1, 1, 'ENG101', 'Use of English I', 2, 'U', 20, 10, 0], [1, 1, 'FRE101', 'Functional French I', 2, 'U', 20, 10, 0], [1, 1, 'CVE100', 'Civics and Ethics', 2, 'U', 20, 5, 0],
  [1, 2, 'ENG102', 'Use of English II', 2, 'U', 20, 10, 0], [1, 2, 'FRE102', 'Functional French II', 2, 'U', 20, 10, 0], [1, 2, 'LOG100', 'Logic and Critical Thinking', 2, 'U', 20, 5, 0],
  [2, 1, 'LAW100', 'Law and Governance', 2, 'U', 20, 5, 0], [2, 2, 'SPT100', 'Sports and Physical Education', 1, 'U', 0, 0, 30], [3, 1, 'ENT200', 'Entrepreneurship and Innovation', 2, 'U', 20, 5, 0]
];
const ACC_BSC = [
  [1, 1, 'MGT201', 'Principles of Management', 6, 'C', 40, 10, 0], [1, 1, 'ACC201', 'Financial Accounting I', 6, 'C', 40, 10, 0], [1, 1, 'ECO201', 'Principles of Microeconomics', 6, 'C', 40, 10, 0], [1, 1, 'MTH201', 'Business Mathematics I', 6, 'C', 40, 10, 0],
  [1, 2, 'ACC202', 'Financial Accounting II', 6, 'C', 40, 10, 0], [1, 2, 'BFN202', 'Principles of Finance', 6, 'C', 40, 10, 0], [1, 2, 'ECO202', 'Principles of Macroeconomics', 6, 'C', 40, 10, 0], [1, 2, 'STA202', 'Business Statistics', 6, 'C', 40, 10, 0],
  [2, 1, 'ACC301', 'Cost and Management Accounting', 6, 'C', 40, 10, 0], [2, 1, 'ACC303', 'Financial Reporting', 6, 'C', 40, 10, 0], [2, 1, 'ACC305', 'Managerial Finance', 6, 'C', 40, 10, 0], [2, 1, 'ACC307', 'Principles of Auditing', 6, 'C', 40, 10, 0], [2, 1, 'MGT301', 'Organisational Behaviour', 6, 'E', 40, 10, 0],
  [2, 2, 'ACC302', 'Tax Accounting', 6, 'C', 40, 10, 0], [2, 2, 'ACC304', 'Public Sector Accounting', 6, 'C', 40, 10, 0], [2, 2, 'ACC306', 'Corporate Treasury Management', 6, 'C', 40, 10, 0], [2, 2, 'ACC308', 'Accounting Theory', 6, 'E', 40, 10, 0], [2, 2, 'MGT204', 'Business Law I (OHADA Focus)', 6, 'C', 40, 10, 0],
  [3, 1, 'BUS401', 'Research Methods for Business', 6, 'C', 40, 10, 0], [3, 1, 'ACC401', 'Advanced Financial Reporting', 6, 'C', 40, 10, 0], [3, 1, 'ACC403', 'Advanced Managerial Accounting', 6, 'C', 40, 10, 0], [3, 1, 'ACC405', 'Auditing and Assurance', 6, 'C', 40, 10, 0], [3, 1, 'ACC407', 'Computerised Accounting', 6, 'E', 30, 0, 30],
  [3, 2, 'BFN402', 'Financial Management', 6, 'C', 40, 10, 0], [3, 2, 'ACC412', 'Industrial Internship / Practicum', 6, 'C', 0, 0, 180], [3, 2, 'ACC498', 'Research Project / Long Essay', 12, 'C', 0, 20, 100], [3, 2, 'ACC402', 'Forensic Accounting', 6, 'E', 40, 10, 0], [3, 2, 'ACC406', 'International Financial Reporting (IFRS)', 6, 'E', 40, 10, 0]
];
const MGT_BSC = [[3, 2, 'MGT306', 'Industrial Attachment', 12, 'C', 0, 0, 0], [3, 2, 'MGT498', 'Research Project', 12, 'C', 0, 0, 0]];
const ACC_TOPUP = [
  [1, 1, 'ACC401', 'Advanced Financial Accounting', 6, 'C', 40, 10, 0], [1, 1, 'ACC403', 'Advanced Management Accounting', 6, 'C', 40, 10, 0], [1, 1, 'ACC405', 'Taxation: Principles & Practice', 6, 'C', 40, 10, 0], [1, 1, 'ACC407', 'Accounting Theory & Professional Ethics', 6, 'C', 40, 10, 0], [1, 1, 'MGT401', 'Business Research Methods', 6, 'C', 40, 10, 0],
  [1, 2, 'ACC402', 'Advanced Financial Accounting II', 6, 'C', 40, 10, 0], [1, 2, 'ACC404', 'Auditing and Assurance Services', 6, 'C', 40, 10, 0], [1, 2, 'ACC406', 'Corporate Governance & Business Law', 6, 'C', 40, 10, 0], [1, 2, 'ACC498', 'Research Project', 12, 'C', 0, 20, 100]
];
const THESIS = (code) => [[2, 2, code, "Master's Thesis", 30, 'C', 0, 0, 0]];
// level, specialty name (as in the portal catalogue), rows
const SETS = [
  ['BSC', 'Professional B.Sc. Accounting', UNIV.concat(ACC_BSC).filter((r, i, a) => a.findIndex(x => x[2] === r[2]) === i)],
  ['BSC', 'Professional B.Sc. Banking and Finance', UNIV],
  ['BSC', 'Professional B.Sc. Management', UNIV.concat(MGT_BSC)],
  ['BSC', 'Professional B.Sc. Transport and Logistics', UNIV],
  ['BSC', 'B.Sc. Accounting (Top-Up)', ACC_TOPUP],
  ['MSC', 'M.Sc. Accounting', THESIS('ACC698')],
  ['MSC', 'M.Sc. Banking and Finance', THESIS('BFN698')],
  ['MSC', 'M.Sc. Management', THESIS('MGT698')],
  ['MSC', 'M.Sc. Human Resource Management', THESIS('HRM698')],
  ['MSC', 'M.Sc. Project Management', THESIS('PJM698')],
  ['MSC', 'M.Sc. Transport and Logistics Management', THESIS('TML698')]
];
module.exports = { SETS };
