const caseSource = {label:'Original ultrasound case report', href:'https://doi.org/10.7759/cureus.113224'};

const topics = {
  twins: {
    title:'Read the twin ultrasound', source:caseSource, identity:'H001 · Figure 1',
    intro:'Figure 1 contains two views from the same pregnancy. Look for the markings the authors kept on the ultrasound.',
    guide:'Read the caption, then choose the uterine wall fibroid in the Case figure menu. Both pictures come from the same report.',
    term:['Amniotic sac','The fluid-filled space around a developing baby. The authors describe a separate sac for each twin.'],
    detail:'The authors describe the pregnancy as dichorionic and diamniotic. Each twin has its own outer membrane and its own fluid-filled sac.',
    check:['Which pictures come from this pregnancy?', 'The two published ultrasound figures', 'The independent fetal brain MRI', 'The case report supplies both ultrasound figures. The MRI comes from a different source.']
  },
  fibroid: {
    title:'Find the fibroid markings', source:caseSource, identity:'H001 · Figure 2',
    intro:'The authors identify a fibroid in the front wall of the uterus. Look for the measurement marks in Figure 2.',
    guide:'Compare the two ultrasound figures to see how the authors directed attention to different parts of the same pregnancy.',
    term:['Calipers','The paired marks an ultrasound operator places on an image to measure a distance.'],
    detail:'The original still preserves the published measurement marks. Its pixels do not carry the 3D location needed to align them with the general female anatomy model.',
    check:['Who placed the measurement marks shown here?', 'The source ultrasound operator', 'The DICOM3D 3D viewer', 'The marks were already part of the published image.']
  },
  myoma: {
    title:'Follow the fibroid through the MRI', source:{label:'Original UMD MRI and tissue labels',href:'https://doi.org/10.6084/m9.figshare.23541312.v3'}, identity:'UMD_221129_001 · separate uterine MRI case',
    intro:'Start with one MRI slice. The colored overlay shows the tissue marked by the dataset authors at that position.',
    guide:'Select Myoma and move through the slices. Follow the colored region as its outline changes from slice to slice.',
    term:['Myoma','Another name for a fibroid. The source uses the number 3 to mark its voxels.'],
    detail:'The MRI and tissue labels share a three-dimensional grid. This lets the viewer place a tissue surface alongside its source slice. The H001 ultrasound comes from a different case.',
    check:['What locates the myoma on this MRI?', 'The tissue labels supplied with this MRI', 'The fibroid measurement in H001 Figure 2', 'The labels and the MRI belong to the same UMD example.']
  },
  'fetal-mri': {
    title:'Explore a developing brain in slices', source:{label:'Original CRL fetal brain atlas',href:'https://doi.org/10.7910/DVN/QOO75G'}, identity:'CRL · 22-week fetal brain template',
    intro:'This example combines MRI data into a reference for the developing brain at 22 weeks. Start with one slice and look for the selected tissue.',
    guide:'Move the slice, then change the viewing direction to see the same brain reference from a different angle.',
    term:['Template','A reference image made by combining scans so that anatomy at a developmental stage can be studied together.'],
    detail:'The template and its tissue labels share a source grid. Its age and appearance describe this reference. The published H001 figures supply their own case evidence.',
    check:['Whose brain does this MRI show?', 'A reference assembled from multiple scans', 'One of the H001 twins', 'The authors supply a population template for studying fetal brain development.']
  }
};

export function h001Learning(key) {
  const topic = Object.hasOwn(topics,key) ? topics[key] : null;
  if (!topic) return null;
  const [prompt,correct,other,explanation] = topic.check;
  return {
    kind:'h001', title:topic.title, subtitle:topic.identity,
    cards:[{title:'Reading this source',body:topic.detail}],
    sourceRows:[{label:'Displayed source',value:topic.identity}],
    relationships:[], links:[topic.source],
    beginner:{
      key:'h001:'+key, title:topic.title, intro:topic.intro,
      ideas:[{title:'Try this in the viewer',body:topic.guide}],
      actions:[], links:[], terms:[{title:topic.term[0],body:topic.term[1]}],
      check:{prompt,answers:[correct,other],correct:0,explanation}
    }
  };
}
