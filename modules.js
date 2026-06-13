// modules.js — single source of truth for the PALS course modules.
// Loaded as a classic script (in <head>) by hub_student.html and
// hub_instructor.html before their module scripts run, so both hubs read
// the same list (n = display number / progress index+1).
window.PALS_MODULES = [
  {n:1,  label:'BLS',            title:'Pediatric BLS & CPR Quality',   sub:'C-A-B, depth, rate, AED',            file:'slides/pals_module_01_bls.slides.html'},
  {n:2,  label:'Assessment',     title:'Systematic Assessment',          sub:'PAT, ABCDE, vitals',                 file:'slides/pals_module_02_assessment.slides.html'},
  {n:3,  label:'Respiratory',    title:'Respiratory Emergencies',        sub:'Distress vs failure, BVM',           file:'slides/pals_module_03_respiratory.slides.html'},
  {n:4,  label:'Shock',          title:'Shock Recognition & Management', sub:'Types, fluids, sepsis',              file:'slides/pals_module_04_shock.slides.html'},
  {n:5,  label:'Rhythms',        title:'Rhythm Recognition',             sub:'Brady, SVT, VT, VF, PEA',            file:'slides/pals_module_05_rhythms.slides.html'},
  {n:6,  label:'Algorithms',     title:'Brady & Tachy Algorithms',       sub:'Atropine, adenosine, cardioversion', file:'slides/pals_module_06_algorithms.slides.html'},
  {n:7,  label:'Megacode-R',     title:'Megacode 1: Respiratory',        sub:'Team roles, checklist, debrief',     file:'slides/pals_module_07_megacode_resp.slides.html'},
  {n:8,  label:'Megacode-S',     title:'Megacode 2: Shock',              sub:'Septic shock scenario',              file:'slides/pals_module_08_megacode_shock.slides.html'},
  {n:9,  label:'Cardiac Arrest', title:'Cardiac Arrest Algorithm',       sub:'Shockable/non-shockable, epi',       file:'slides/pals_module_09_cardiac_arrest.slides.html'},
  {n:10, label:'Post-Arrest',    title:'Post-Arrest Care',               sub:'SpO2, PaCO2, neuro monitoring',      file:'slides/pals_module_10_postarrest.slides.html'},
  {n:11, label:'Airway/Pharm',   title:'Airway & Pharmacology',          sub:'BVM, ETT, RSI, drug calculator',     file:'slides/pals_module_11_airway_pharm.slides.html'},
];
