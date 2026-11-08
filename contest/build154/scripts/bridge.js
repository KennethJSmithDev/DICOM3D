(() => {
  if (window.__c049Recovery) return;
  window.__c049Recovery = {status:'waiting-for-public-study'};
  const install = () => {
    const anchor = document.querySelector('#exploreStudy');
    const selection = document.querySelector('#selectStructure');
    const back = document.querySelector('#returnReference');
    if (!anchor || !selection || !back || back.hidden || !back.getBoundingClientRect().width) return;
    if (document.querySelector('#c049ExplainFinding')) return;
    const explain = document.createElement('button');
    explain.id = 'c049ExplainFinding';
    explain.textContent = 'Explain documented finding with native AI Hub';
    const mismatch = document.createElement('button');
    mismatch.id = 'c049ReviewMismatch';
    mismatch.textContent = 'Review synthetic CT/SEG mismatch';
    const panel = document.createElement('section');
    panel.id = 'c049ExplanationPanel';
    panel.setAttribute('aria-live','polite');
    panel.style.cssText = 'margin:10px 0;padding:16px;border:1px solid #287991;border-radius:8px;background:#071923;color:#d9f6ff;max-width:72rem;height:128px;box-sizing:border-box;overflow:auto';
    panel.textContent = 'Contest edition  /  Babylon Lite  /  authenticated native AI Hub workflow. Select an action to inspect its validated result.';
    anchor.after(explain,mismatch,panel);

    async function request(action) {
      explain.disabled = mismatch.disabled = true;
      panel.textContent = 'Native AI Hub is reading authorized evidence through Interoperability. CPU inference can take several minutes.';
      window.__c049Recovery = {status:'pending',action,initiallySelected:selection.getAttribute('aria-pressed')==='true'};
      try {
        const response = await fetch('/api/c049/workflow', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action})});
        if (!response.ok) throw Error('Workflow returned HTTP '+response.status);
        const result = await response.json();
        if (action === 'explain-h000') {
          if (result.status !== 'ACCEPTED' || result.semanticId !== 'lesion.lung.mass.001' ||
              JSON.stringify(result.citations) !== JSON.stringify(['Observation/r5p-h000-mask-volume','ImagingSelection/r5p-h000-segment-1']))
            throw Error('Unsupported response withheld');
          if (selection.disabled) throw Error('The source study is unavailable');
          if (selection.getAttribute('aria-pressed') !== 'true') selection.click();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          if (selection.getAttribute('aria-pressed') !== 'true') throw Error('Existing selection controller did not confirm the lesion');
        } else if (result.review?.status !== 'REVIEW_REQUESTED') {
          throw Error('Review outcome unavailable');
        }
        panel.replaceChildren();
        const title = document.createElement('h3');
        title.textContent = action === 'explain-h000' ? 'Validated native-agent finding' : 'Synthetic mismatch  /  review requested';
        panel.append(title);
        const values = action === 'explain-h000'
          ? [result.explanation, 'Selected structure  /  '+result.semanticId, 'Sources  /  '+result.citations.join('  /  '), result.limitation]
          : [result.explanation, result.review.reason, 'Sources  /  '+result.review.evidenceReferences.join('  /  '), 'Synthetic mismatch routed for review. Source imaging and selection are preserved.'];
        for (const value of values) {
          const paragraph = document.createElement('p');
          paragraph.textContent = value;
          panel.append(paragraph);
        }
        panel.dataset.validation = action === 'explain-h000' ? result.status : result.review.status;
        window.__c049Recovery = {...window.__c049Recovery,status:'complete',result,selected:selection.getAttribute('aria-pressed')==='true'};
      } catch (error) {
        panel.textContent = 'Result withheld  /  '+String(error);
        panel.dataset.validation = 'rejected';
        window.__c049Recovery = {status:'failed',action,error:String(error)};
      } finally {explain.disabled = mismatch.disabled = false;}
    }
    explain.onclick = () => request('explain-h000');
    mismatch.onclick = () => request('synthetic-mismatch');
    window.__c049Recovery = {status:'ready'};
    observer.disconnect();
  };
  const observer = new MutationObserver(install);
  observer.observe(document.documentElement,{childList:true,subtree:true});
  install();
})();
