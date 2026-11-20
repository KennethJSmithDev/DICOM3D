const caseReport = {
  author: 'Fariha Altaf and Biza Akbar, Cureus (2026)',
  source: 'https://doi.org/10.7759/cureus.113224',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  width:2892, height:2164,
};

export const ultrasoundExamples = [
  {
    ...caseReport, id:'twins', title:'Twin pregnancy · Figure 1',
    url:new URL('./examples/twins.jpg', import.meta.url).href,
    alt:'Two side-by-side ultrasound views from the published twin pregnancy.',
    caption:'Figure 1 shows the twin pregnancy. The authors describe it as dichorionic and diamniotic: each twin has its own outer membrane and its own fluid-filled sac.',
  },
  {
    ...caseReport, id:'fibroid', title:'Uterine wall fibroid · Figure 2',
    url:new URL('./examples/fibroid.jpg', import.meta.url).href,
    alt:'Ultrasound view of the uterine wall with measurement markers across the fibroid.',
    caption:'Figure 2 focuses on the anterior wall of the uterus. Anterior means front. The authors identify a fibroid there; the on-screen calipers mark the area being measured.',
  },
];
