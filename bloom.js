'use strict';
/* Bloom's taxonomy by qualification level — one source for the course outlines, the AI prompts and the printed materials.
   HND / BTS  : Understand + Apply (strong emphasis on Apply)   — operational principles, practical, procedural, technical tasks
   Bachelor's : Apply + Analyze, with introductory-to-moderate Evaluate — complex methods, systemic problems, standard data
   Master's   : Evaluate + Create                                — critical appraisal, independent research, original frameworks */
const T = {
  tech: {
    key: 'tech', lv: ['Understand', 'Apply'], lvFr: ['Comprendre', 'Appliquer'], lead: 'Apply',
    en: { name: 'Understand & Apply', short: 'Understand and Apply (heavy emphasis on Apply)',
      focus: 'Graduates grasp the operational principles of the field and execute practical, procedural and technical tasks in a professional setting (laboratory tests, balance sheets, administrative workflows, technical drawings).',
      verbs: ['explain', 'describe', 'interpret', 'classify', 'demonstrate', 'perform', 'operate', 'prepare', 'calculate', 'produce', 'implement', 'follow the procedure for'],
      assess: 'practical tests, workshop and laboratory work, procedural exercises, case-based tasks, portfolios of completed professional tasks, and a final examination weighted towards application',
      method: 'short demonstrations followed by supervised hands-on practice, worked examples, step-by-step procedures, simulations of workplace tasks and checklists',
      share: 'about 30% understanding and 70% application' },
    fr: { name: 'Comprendre et Appliquer', short: 'Comprendre et Appliquer (accent marqué sur Appliquer)',
      focus: 'Le diplômé maîtrise les principes de fonctionnement du domaine et exécute des tâches pratiques, procédurales et techniques en contexte professionnel (analyses de laboratoire, bilans comptables, procédures administratives, dessins techniques).',
      verbs: ['expliquer', 'décrire', 'interpréter', 'classer', 'démontrer', 'réaliser', 'manipuler', 'préparer', 'calculer', 'produire', 'mettre en œuvre', 'suivre la procédure de'],
      assess: 'épreuves pratiques, travaux d\'atelier et de laboratoire, exercices procéduraux, études de cas, portfolio de tâches professionnelles réalisées et examen final orienté vers l\'application',
      method: 'courtes démonstrations suivies de pratique encadrée, exemples résolus, procédures pas à pas, simulations de situations de travail et listes de contrôle',
      share: 'environ 30 % de compréhension et 70 % d\'application' } },
  bsc: {
    key: 'bsc', lv: ['Apply', 'Analyze', 'Evaluate (introductory to moderate)'], lvFr: ['Appliquer', 'Analyser', 'Évaluer (niveau introductif à modéré)'], lead: 'Analyze',
    en: { name: 'Apply & Analyze', short: 'Apply and Analyze, with introductory-to-moderate Evaluate',
      focus: 'Graduates combine broad theoretical understanding with the ability to execute complex methodologies, break down systemic problems and evaluate standard data, processing data and dissecting problems independently.',
      verbs: ['apply', 'solve', 'use', 'analyse', 'differentiate', 'compare', 'examine', 'organise', 'attribute', 'test', 'justify', 'assess (standard data and cases)'],
      assess: 'problem sets, data-handling and case analyses, structured reports, methodological exercises, projects and a final examination with analytical questions and some evaluative questions',
      method: 'lectures grounded in theory, tutorials on complex methods, case studies, datasets to process, guided problem decomposition and group analysis',
      share: 'about 30% application, 50% analysis and 20% introductory evaluation' },
    fr: { name: 'Appliquer et Analyser', short: 'Appliquer et Analyser, avec Évaluer à un niveau introductif à modéré',
      focus: 'Le diplômé allie une large compréhension théorique à la capacité d\'exécuter des méthodologies complexes, de décomposer des problèmes systémiques et d\'évaluer des données courantes, en traitant seul les données et en disséquant les problèmes.',
      verbs: ['appliquer', 'résoudre', 'utiliser', 'analyser', 'différencier', 'comparer', 'examiner', 'organiser', 'attribuer', 'tester', 'justifier', 'apprécier (données et cas courants)'],
      assess: 'séries de problèmes, analyses de données et de cas, rapports structurés, exercices méthodologiques, projets et examen final comportant des questions d\'analyse et quelques questions d\'évaluation',
      method: 'cours fondés sur la théorie, travaux dirigés sur les méthodes complexes, études de cas, jeux de données à traiter, décomposition guidée de problèmes et analyses en groupe',
      share: 'environ 30 % d\'application, 50 % d\'analyse et 20 % d\'évaluation introductive' } },
  msc: {
    key: 'msc', lv: ['Evaluate', 'Create'], lvFr: ['Évaluer', 'Créer'], lead: 'Create',
    en: { name: 'Evaluate & Create', short: 'Evaluate and Create',
      focus: 'Graduates appraise the literature and evidence critically, offer peer-level critique, conduct independent research and synthesise original frameworks or theses that generate new knowledge and challenge paradigms. Foundational recall and basic application are assumed.',
      verbs: ['critique', 'appraise', 'judge', 'defend', 'evaluate', 'synthesise', 'design', 'formulate', 'develop an original framework for', 'hypothesise', 'propose', 'challenge'],
      assess: 'critical literature reviews, research proposals, peer review exercises, seminar defences, original frameworks or policy models, a dissertation-style paper and a final examination of essay and appraisal questions',
      method: 'research seminars, journal-article critique, debate of competing paradigms, peer review, independent inquiry and supervised design of original frameworks',
      share: 'about 50% evaluation and 50% creation, building on assumed foundational knowledge' },
    fr: { name: 'Évaluer et Créer', short: 'Évaluer et Créer',
      focus: 'Le diplômé apprécie de façon critique la littérature et les preuves, formule une critique de niveau pair, mène une recherche autonome et élabore des cadres ou des thèses originaux qui produisent de nouvelles connaissances et remettent en question les paradigmes. La mémorisation de base et l\'application élémentaire sont supposées acquises.',
      verbs: ['critiquer', 'apprécier', 'juger', 'défendre', 'évaluer', 'synthétiser', 'concevoir', 'formuler', 'élaborer un cadre original pour', 'poser une hypothèse sur', 'proposer', 'remettre en question'],
      assess: 'revues critiques de la littérature, projets de recherche, exercices d\'évaluation par les pairs, soutenances en séminaire, cadres ou modèles originaux, article de type mémoire et examen final de dissertation et d\'appréciation',
      method: 'séminaires de recherche, critique d\'articles scientifiques, débat entre paradigmes concurrents, évaluation par les pairs, investigation autonome et conception encadrée de cadres originaux',
      share: 'environ 50 % d\'évaluation et 50 % de création, sur la base de connaissances fondamentales supposées acquises' } }
};
const tierOf = level => { const l = String(level || '').toUpperCase(); return l === 'MSC' || l === 'MASTER' ? T.msc : l === 'BSC' || l === 'BACHELOR' ? T.bsc : T.tech; };
const info = (level, fr) => { const t = tierOf(level), x = fr ? t.fr : t.en; return Object.assign({ key: t.key, levels: fr ? t.lvFr : t.lv }, x); };
/* one visible line for outlines, handouts, notes, slides and PDFs */
const line = (level, fr) => { const i = info(level, fr); return (fr ? 'Niveau cognitif (taxonomie de Bloom) : ' : 'Cognitive level (Bloom\'s taxonomy): ') + i.short + '.'; };
/* instruction block added to every AI system prompt */
function prompt(level, task) {
  const i = info(level, false);
  const how = {
    outline: 'Write the aims, the 5 to 7 learning outcomes, the teaching methods, the assessment and the weekly goals at this cognitive level. Every outcome must begin with a verb of this level.',
    deck: 'Pitch the slides, the examples and the quiz slides at this level; the teaching slides should move students through the levels named above, not stay at recall.',
    handout: 'Pitch explanations, worked examples, review questions and activities at this level; review questions must call for the thinking named above, not simple recall.',
    quiz: 'Pitch every question at this level (scenario, calculation, procedure, analysis or appraisal as appropriate); avoid pure recall questions.',
    work: 'Pitch the task, the deliverables and the marking criteria at this level; marking criteria must reward the thinking named above.'
  }[task] || '';
  return ' COGNITIVE LEVEL (Bloom\'s revised taxonomy), mandatory for this ' + (({ tech: 'HND/BTS', bsc: "Bachelor's", msc: "Master's" })[i.key]) + ' course: primary levels ' + i.name + ' (' + i.share + '). ' + i.focus + ' Preferred action verbs: ' + i.verbs.join(', ') + '. Typical assessment: ' + i.assess + '. Typical methods: ' + i.method + '. ' + how;
}
/* the reference table */
const table = fr => ['tech', 'bsc', 'msc'].map(k => { const i = info(k === 'tech' ? 'HND' : k === 'bsc' ? 'BSC' : 'MSC', fr); return { tier: k === 'tech' ? 'HND / BTS' : k === 'bsc' ? (fr ? 'Licence' : "Bachelor's") : 'Master', levels: i.levels, focus: i.focus }; });
module.exports = { info, line, prompt, table, tierOf };
