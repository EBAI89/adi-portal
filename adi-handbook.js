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

/* ---- Departments whose Handbook sections give course titles but not full tables (sections 11 to 15).
   Titles are the Handbook's own; credits follow its standard (6 per course, 12 per research project, 30 per Master's thesis, which reproduces
   the stated totals: 108 for the M.Sc., about 68-72 for the Top-Up). Codes and the semester placement are the departments' working numbering
   (prov = provisional, editable by the administration). */
const mk = (pre, spec) => spec.map(([y, s, n, title, cr]) => [y, s, pre + String(n).padStart(3, '0'), title, cr || 6, 'C', 0, 0, 0]);
const msc = (pre, mods, thesis) => mk(pre, mods.map((t, i) => { const k = mods.length === 12 ? [4, 8] : [5, 9]; const a = i < k[0] ? [1, 1, 601 + 2 * i] : i < k[1] ? [1, 2, 602 + 2 * (i - k[0])] : [2, 1, 611 + 2 * (i - k[1])]; return [a[0], a[1], a[2], t]; })).concat(THESIS(thesis));
const top = (pre, mods, n1) => mk(pre, mods.map((t, i) => i < n1 ? [1, 1, 401 + 2 * i, t] : [1, 2, 402 + 2 * (i - n1), t]).concat([[1, 2, 498, 'Research Project', 12]]));
const BFN_BSC = [[1, 1, 'ACC201', 'Financial Accounting I'], [1, 1, 'ECO201', 'Principles of Microeconomics'], [1, 1, 'MTH201', 'Business Mathematics I'],
  [1, 2, 'ACC202', 'Financial Accounting II'], [1, 2, 'ECO202', 'Principles of Macroeconomics'], [1, 2, 'STA202', 'Business Statistics'], [1, 2, 'BFN204', 'Corporate Finance I'],
  [2, 1, 'BFN301', 'Corporate Finance II'], [2, 1, 'BFN303', 'Practice of Banking'], [2, 1, 'ACC301', 'Cost and Management Accounting'],
  [2, 2, 'MGT204', 'Business Law I (OHADA Focus)'], [2, 2, 'BFN302', 'Financial Markets and Institutions'], [2, 2, 'BFN304', 'Principles of Insurance'],
  [3, 1, 'BFN401', 'Credit Analysis and Management'], [3, 1, 'BFN403', 'International Finance'], [3, 1, 'BFN405', 'Financial Risk Management'],
  [3, 2, 'BFN412', 'Industrial Attachment'], [3, 2, 'BFN498', 'Research Project', 12]].map(r => [r[0], r[1], r[2], r[3], r[4] || 6, 'C', 0, 0, 0]);
const MGT_KEY = [[1, 1, 'MGT201', 'Principles of Management'], [1, 2, 'MGT202', 'Marketing'], [2, 1, 'MGT301', 'Organisational Behaviour'], [2, 1, 'MGT303', 'Human Resource Management'],
  [2, 2, 'MGT302', 'Marketing Management'], [2, 2, 'BFN402', 'Financial Management'], [3, 1, 'MGT401', 'Operations Management'], [3, 1, 'MGT403', 'Strategic Management'],
  [3, 1, 'MGT405', 'International Business'], [3, 2, 'MGT402', 'Project Management'], [3, 2, 'MGT404', 'Business Ethics and Corporate Governance']].map(r => [r[0], r[1], r[2], r[3], 6, 'C', 0, 0, 0]);
const TML_BSC = [[1, 1, 'TML201', 'Principles of Logistics and Supply Chain'], [1, 1, 'MGT201', 'Principles of Management'], [1, 1, 'ECO201', 'Principles of Microeconomics'], [1, 1, 'MTH201', 'Business Mathematics I'],
  [1, 2, 'TML202', 'Introduction to Transport Systems'], [1, 2, 'ECO202', 'Principles of Macroeconomics'],
  [2, 1, 'TML301', 'Warehouse Management'], [2, 1, 'TML303', 'Procurement and Sourcing'], [2, 1, 'TML305', 'Inventory Management'],
  [2, 2, 'TML302', 'Transport Economics'], [2, 2, 'TML304', 'Freight Forwarding and Customs Procedures'],
  [3, 1, 'TML401', 'Logistics Information Systems'], [3, 1, 'TML403', 'International Logistics and Trade'], [3, 1, 'TML405', 'Port and Terminal Management'],
  [3, 2, 'TML402', 'Air and Maritime Transport Management'], [3, 2, 'TML404', 'Strategic Supply Chain Management'], [3, 2, 'TML406', 'Green Logistics and Sustainability'],
  [3, 2, 'TML412', 'Industrial Internship'], [3, 2, 'TML498', 'Research Project', 12]].map(r => [r[0], r[1], r[2], r[3], r[4] || 6, 'C', 0, 0, 0]);
const SETS2 = [
  ['BSC', 'Professional B.Sc. Banking and Finance', BFN_BSC],
  ['BSC', 'Professional B.Sc. Management', MGT_KEY],
  ['BSC', 'Professional B.Sc. Transport and Logistics', TML_BSC],
  ['BSC', 'B.Sc. Banking and Finance (Top-Up)', top('BFN', ['Corporate Finance', 'Management of Financial Institutions', 'Investment Analysis and Portfolio Management', 'Financial Markets and Instruments', 'Financial Law and Ethics', 'Business Research Methods', 'Financial Statement Analysis', 'Credit and Financial Risk Management', 'International Finance', 'Professional Practice and Seminar'], 6)],
  ['BSC', 'B.Sc. Human Resource Management (Top-Up)', top('HRM', ['Strategic Human Resource Management', 'Labour Law and Industrial Relations', 'Organisational Behaviour and Development', 'Recruitment, Selection and Talent Management', 'Business Ethics and Corporate Governance', 'Business Communication and Reporting', 'Performance and Compensation Management', 'Training, Development and Career Planning', 'Human Resource Information Systems (HRIS)'], 5)],
  ['BSC', 'B.Sc. Project Management (Top-Up)', top('PJM', ['Principles of Project Management', 'Project Scope and Time Management', 'Project Cost and Financial Management', 'Organisational Behaviour and Stakeholder Management', 'Business Law and Contract Management', 'Advanced Professional Communication', 'Project Risk and Quality Management', 'Agile Project Management and Scrum', 'Project Management Software and Tools (MS Project)', 'Professional Practice and PMP Exam Preparation'], 6)],
  ['BSC', 'B.Sc. Transport and Logistics (Top-Up)', top('TML', ['Principles of Supply Chain Management', 'Transport Economics and Policy', 'Procurement and Inventory Management', 'Warehouse and Distribution Management', 'Business Law and Contracts', 'Professional Communication and Negotiation', 'International Logistics and Freight Forwarding', 'Logistics Information Systems and Technology', 'Quality Management and Performance Metrics', 'Professional Practice and Seminar'], 6)],
  ['MSC', 'M.Sc. Accounting', msc('ACC', ['Advanced Financial Accounting I', 'Advanced Financial Accounting II', 'Advanced Management Accounting', 'Taxation', 'Accounting Theory and Professional Ethics', 'Auditing and Assurance', 'Corporate Governance and Business Law', 'Research Methods', 'Public Sector Accounting', 'Forensic Accounting', 'Strategic Performance Management', 'Accounting Information Systems and Data Analytics', 'Contemporary Issues Seminar'], 'ACC698')],
  ['MSC', 'M.Sc. Banking and Finance', msc('BFN', ['Advanced Corporate Finance', 'Investment Analysis and Management', 'Money, Banking and Financial Markets', 'Financial Econometrics', 'Bank Management and Operations', 'Financial Derivatives and Risk Management', 'Financial Reporting and Analysis', 'Research Methods', 'Portfolio Theory', 'International Finance', 'Financial Regulation and Ethics', 'FinTech and Financial Innovation', 'Contemporary Issues Seminar'], 'BFN698')],
  ['MSC', 'M.Sc. Management', msc('MGT', ['Managerial Theories and Practice', 'Managerial Finance', 'Marketing Management', 'Managerial Economics', 'Human Resource Management', 'Operations and Supply Chain Management', 'Managerial Accounting and Control', 'Business Research Methods', 'Strategic Management', 'International Business Management', 'Entrepreneurship and New Venture Creation', 'Business Ethics and Corporate Governance', 'Contemporary Issues Seminar'], 'MGT698')],
  ['MSC', 'M.Sc. Human Resource Management', msc('HRM', ['Strategic Human Resource Management', 'Organisational Behaviour and Theory', 'Talent Acquisition and Management', 'Labour Law and Industrial Relations', 'Performance and Compensation Management', 'Training, Development and Career Management', 'Research Methods for Social Sciences', 'HR Metrics and Analytics', 'Organisational Development and Change Management', 'International Human Resource Management', 'Human Resource Information Systems (HRIS)', 'Employee Counselling and Workplace Psychology', 'Contemporary Issues Seminar'], 'HRM698')],
  ['MSC', 'M.Sc. Project Management', msc('PJM', ['Principles of Project Management', 'Project Finance and Budgeting', 'Organisational Strategy and Project Selection', 'Project Scope, Time and Cost Management', 'Project Risk Management', 'Project Procurement and Contract Management', 'Research Methods', 'Agile and Hybrid Project Management', 'Programme and Portfolio Management', 'Stakeholder and Communications Management', 'Project Quality and Performance Management', 'Contemporary Issues Seminar'], 'PJM698')],
  ['MSC', 'M.Sc. Transport and Logistics Management', msc('TML', ['Strategic Supply Chain Management', 'Transport Economics and Policy', 'Quantitative Analysis for Logistics', 'Managerial Finance for Logisticians', 'Global Procurement and Sourcing', 'Warehouse and Distribution Management', 'International Trade and Freight Operations', 'Research Methods', 'Maritime and Port Management', 'Air Cargo and Aviation Management', 'Green Logistics and Sustainable Supply Chains', 'Logistics Information Systems and Data Analytics', 'Contemporary Issues Seminar'], 'TML698')]
];
module.exports = { SETS, SETS2 };
