'use strict';
/* Academic standard by qualification level — one source for course outlines, AI prompts and printed materials.
   HND / BTS  : the MINESUP (Cameroon Ministry of Higher Education) HND/BTS programmes — competency-based, professional and practice-led.
   Bachelor's : international undergraduate standards (UK FHEQ Level 6 / QAA benchmarks, USA and Canada four-year bachelor's practice,
                European Bologna first cycle, EQF 6) together with the Cameroonian LMD Licence as applied at the University of Buea and other MINESUP-regulated universities.
   Master's   : international postgraduate standards (UK FHEQ Level 7, USA and Canada graduate practice, Bologna second cycle, EQF 7)
                together with the LMD Master as applied at the University of Buea and other MINESUP-regulated universities. */
const T = {
  tech: {
    key: 'tech',
    en: { name: 'MINESUP HND/BTS standard',
      framework: 'the MINESUP national HND/BTS programmes: competency-based, practice-led and aimed at immediate employability',
      focus: 'The course follows the MINESUP HND/BTS approach: the national syllabus and its competences guide the content; the emphasis is on practical, workplace-ready skills, with lectures (CM), tutorials (TD) and practical work (TP) taught so that every concept is shown, practised and assessed on realistic professional tasks.',
      method: 'short lectures, demonstrations, supervised practical work and workshops, worked procedures, workplace case studies from Cameroon, and guided practice with checklists',
      assess: 'continuous assessment (tests, practical work, assignments) and an end-of-semester examination with a strong practical component, in line with the MINESUP HND/BTS regulations; professional report and internship where the programme requires them',
      handout: 'step-by-step procedures, annotated examples, checklists, practice tasks with answers and workplace scenarios; plain, precise language and standard technical terms (English and French)',
      lead: 'a competence-based course following the MINESUP HND/BTS syllabus' },
    fr: { name: 'Référentiel MINESUP (HND/BTS)',
      framework: 'les programmes nationaux HND/BTS du MINESUP : approche par compétences, orientée pratique et insertion professionnelle',
      focus: 'Le cours suit l’approche MINESUP des HND/BTS : le programme national et ses compétences guident le contenu ; l’accent est mis sur les savoir-faire pratiques, directement utilisables en entreprise, avec des cours magistraux (CM), travaux dirigés (TD) et travaux pratiques (TP) conçus pour que chaque notion soit montrée, pratiquée et évaluée sur des tâches professionnelles réalistes.',
      method: 'cours courts, démonstrations, travaux pratiques encadrés et ateliers, procédures commentées, études de cas professionnelles au Cameroun et pratique guidée avec listes de contrôle',
      assess: 'contrôle continu (tests, travaux pratiques, devoirs) et examen de fin de semestre comportant une forte part pratique, conformément à la réglementation MINESUP des HND/BTS ; rapport professionnel et stage lorsque le programme les prévoit',
      handout: 'procédures pas à pas, exemples commentés, listes de contrôle, exercices pratiques corrigés et mises en situation professionnelles ; langage précis et termes techniques normalisés (anglais et français)',
      lead: 'un cours par compétences conforme au programme MINESUP des HND/BTS' } },
  bsc: {
    key: 'bsc',
    en: { name: 'International Bachelor’s standard (UK, USA, Canada, Europe) and LMD Licence',
      framework: 'international undergraduate standards (UK FHEQ Level 6, USA and Canadian four-year bachelor’s practice, the European Bologna first cycle) and the Cameroonian LMD Licence as applied at the University of Buea and other MINESUP-regulated universities',
      focus: 'The course follows international bachelor’s practice and the LMD Licence: a published syllabus with credits, intended learning outcomes, a weekly schedule and a stated assessment scheme; teaching combines lectures (CM), tutorials (TD) and, where relevant, practicals (TP), with prescribed readings, problem sets and case studies.',
      method: 'structured lectures, tutorials and problem classes, case studies, guided reading, data exercises and group work, with office-hour and online support',
      assess: 'continuous assessment (assignments, quizzes, tests, coursework) and a final written examination, as set out in the ADI academic regulations; marking against published criteria and academic-integrity rules',
      handout: 'learning objectives, clearly sectioned notes with worked examples, key terms, review questions, further reading and properly cited sources (APA or Harvard)',
      lead: 'an undergraduate course aligned with international bachelor’s standards and the LMD Licence' },
    fr: { name: 'Référentiel international de la Licence (Royaume-Uni, États-Unis, Canada, Europe) et Licence LMD',
      framework: 'les standards internationaux du premier cycle (cadre britannique FHEQ niveau 6, pratique américaine et canadienne du bachelor en quatre ans, premier cycle européen de Bologne) et la Licence LMD camerounaise telle qu’appliquée à l’Université de Buea et dans les autres universités sous tutelle du MINESUP',
      focus: 'Le cours suit les pratiques internationales de la licence et le système LMD : un syllabus publié avec crédits, acquis d’apprentissage, calendrier hebdomadaire et mode d’évaluation annoncé ; l’enseignement associe cours magistraux (CM), travaux dirigés (TD) et, le cas échéant, travaux pratiques (TP), avec lectures prescrites, séries d’exercices et études de cas.',
      method: 'cours structurés, travaux dirigés et séances d’exercices, études de cas, lectures guidées, exercices sur données et travaux de groupe, avec accompagnement en présentiel et en ligne',
      assess: 'contrôle continu (devoirs, quiz, tests, travaux) et examen final écrit, conformément au règlement académique de l’ADI ; notation selon des critères publiés et règles d’intégrité académique',
      handout: 'objectifs d’apprentissage, notes clairement structurées avec exemples résolus, termes clés, questions de révision, lectures complémentaires et sources correctement citées (APA ou Harvard)',
      lead: 'un cours de licence aligné sur les standards internationaux et le système LMD' } },
  msc: {
    key: 'msc',
    en: { name: 'International Master’s standard (UK, USA, Canada, Europe) and LMD Master',
      framework: 'international postgraduate standards (UK FHEQ Level 7, USA and Canadian graduate practice, the European Bologna second cycle) and the Cameroonian LMD Master as applied at the University of Buea and other MINESUP-regulated universities',
      focus: 'The course follows international master’s practice and the LMD Master: a seminar-style, research-informed course in which students read the primary literature, discuss it critically and carry out independent work; the syllabus states credits, intended learning outcomes, a weekly schedule, readings and assessment, and links to research methods and the dissertation or thesis.',
      method: 'seminars and lectures, reading-based discussion of journal articles and reports, case and policy analysis, research-methods sessions, presentations and supervised independent study',
      assess: 'coursework such as critical reviews, research proposals, presentations and essays, and a final examination or paper, as set out in the ADI academic regulations; marking against published postgraduate criteria and strict academic-integrity rules',
      handout: 'seminar briefs, annotated reading guides, discussion questions, research-design notes and a properly cited reading list (APA or Harvard) drawn from scholarly sources',
      lead: 'a postgraduate course aligned with international master’s standards and the LMD Master' },
    fr: { name: 'Référentiel international du Master (Royaume-Uni, États-Unis, Canada, Europe) et Master LMD',
      framework: 'les standards internationaux du deuxième cycle (cadre britannique FHEQ niveau 7, pratique américaine et canadienne des études supérieures, deuxième cycle européen de Bologne) et le Master LMD camerounais tel qu’appliqué à l’Université de Buea et dans les autres universités sous tutelle du MINESUP',
      focus: 'Le cours suit les pratiques internationales du master et le système LMD : un cours de type séminaire, nourri par la recherche, où l’étudiant lit la littérature scientifique, la discute de façon critique et mène un travail autonome ; le syllabus précise crédits, acquis d’apprentissage, calendrier hebdomadaire, lectures et évaluation, et se relie à la méthodologie de recherche et au mémoire ou à la thèse.',
      method: 'séminaires et cours, discussion de lectures (articles scientifiques et rapports), analyse de cas et de politiques, séances de méthodologie de la recherche, exposés et travail personnel encadré',
      assess: 'travaux tels que revues critiques, projets de recherche, exposés et dissertations, et examen ou travail final, conformément au règlement académique de l’ADI ; notation selon des critères de niveau master publiés et règles strictes d’intégrité académique',
      handout: 'fiches de séminaire, guides de lecture commentés, questions de discussion, notes de conception de recherche et bibliographie correctement citée (APA ou Harvard) issue de sources scientifiques',
      lead: 'un cours de master aligné sur les standards internationaux et le système LMD' } }
};
const tierOf = level => { const l = String(level || '').toUpperCase(); return l === 'MSC' || l === 'MASTER' ? T.msc : l === 'BSC' || l === 'BACHELOR' ? T.bsc : T.tech; };
const info = (level, fr) => { const t = tierOf(level); return Object.assign({ key: t.key }, fr ? t.fr : t.en); };
/* one visible line for outlines, handouts, notes, slides and PDFs */
const line = (level, fr) => (fr ? 'Référentiel académique : ' : 'Academic standard: ') + info(level, fr).name + '.';
/* instruction block added to every AI system prompt */
function prompt(level, task) {
  const i = info(level, false);
  const how = {
    outline: 'Write the aims, the 5 to 7 learning outcomes (each starting with an action verb), the teaching methods, the assessment and the weekly goals in the layout of a published course syllabus of this standard (code, credits, outcomes, weekly schedule, methods, assessment).',
    deck: 'Build the slides as a lecturer would at this standard: clear learning objectives first, then content, examples and quiz slides, and a closing summary.',
    handout: 'Prepare the material as a lecturer at this standard would: ' + i.handout + '.',
    quiz: 'Write questions as an examiner at this standard would, matched to the stated learning outcomes and the way the course is assessed.',
    work: 'Write the assignment as a lecturer at this standard would, with clear deliverables and published marking criteria.'
  }[task] || '';
  return ' ACADEMIC STANDARD, mandatory for this ' + (({ tech: 'HND/BTS', bsc: "Bachelor's", msc: "Master's" })[i.key]) + ' course: follow ' + i.framework + '. ' + i.focus + ' Typical methods: ' + i.method + '. Typical assessment: ' + i.assess + '. ' + how + ' Do not invent exact credit values, percentages or regulation numbers; where the regulations fix them, refer to them generally.';
}
module.exports = { info, line, prompt, tierOf };
