import React from 'react';

const labels = {
  SAME_SUBJECT_REFERENCE:'Explicit reference; subject references match',
  SAME_UNSCOPED_SUBJECT_REFERENCE:'Subject reference text matches; server scope is unknown',
  SUBJECT_REFERENCE_MISMATCH:'Explicit reference; subject references differ',
  SUBJECT_NOT_PROVIDED:'Explicit reference; subject reference missing',
  SUBJECT_SCOPE_UNRESOLVED:'Explicit reference; subject scope could not be resolved',
  UNSCOPED_LOCAL_KEY:'Relative reference matches a local key; server scope is unknown',
  REFERENCE_NOT_PROVIDED:'No usable reference was supplied',
  TARGET_NOT_IN_BUNDLE:'Referenced target not present in this bundle',
  UNSUPPORTED_TARGET_TYPE:'Referenced target type is not supported here',
};

export default function FhirEvidenceView({projection, singleResource=false}) {
  return <div>
    <p>FHIR {projection.family} ({projection.sourceVersion}) · {projection.entryCount} {projection.entryCount===1?'entry':'entries'} · {projection.resources.length} imaging-related resources shown.</p>
    <p>{singleResource?'This local projection contains only the ImagingStudy returned by the server.':'Only references explicitly present in this source bundle are shown.'} Matching subject references are not proof of patient identity, access rights, image-region correspondence or registration.</p>
    {projection.resources.length > 0 && <div style={{overflow:'auto', maxHeight:'18rem'}}><table style={{width:'100%',tableLayout:'fixed',textAlign:'left',borderSpacing:'0.35rem',overflowWrap:'anywhere'}}>
      <caption>Imaging-related resource identities</caption>
      <thead><tr><th scope="col">Resource</th><th scope="col">Source status</th><th scope="col">Modality codes</th></tr></thead>
      <tbody>{projection.resources.map(item => <tr key={item.key}><td>{item.key}</td><td>{item.status ?? 'Not supplied'}</td><td>{item.modality.map(value => value.system ? `${value.code} (${value.system})` : value.code).join(', ') || 'Not supplied'}</td></tr>)}</tbody>
    </table></div>}
    <h4>Source references</h4>
    {projection.links.length ? <ul style={{overflowWrap:'anywhere'}}>{projection.links.map((link,index) => <li key={`${link.source}-${link.field}-${index}`}>
      {link.source} · {link.field} → {link.target ?? 'target not resolved in this bundle'} · {labels[link.status]}{link.subjectStatus ? ` · ${labels[link.subjectStatus]}` : ''}
    </li>)}</ul> : <p>No supported explicit imaging relationships were found in this bundle.</p>}
    {projection.resources.filter(item => item.selection?.subsets.length).map(item => <details key={item.key}>
      <summary>Source subset values · {item.key}</summary>
      <p>These are source-defined values for the listed SOP instance. Their meaning depends on the source; they are not automatically CT frame numbers.</p>
      <ul style={{overflowWrap:'anywhere'}}>{item.selection.subsets.map((subset,index) => <li key={index}>Instance: {subset.instanceUid ?? 'not supplied'} · SOP class: {subset.sopClass ?? 'not supplied'} · subset: {subset.values.join(', ')}</li>)}</ul>
    </details>)}
    {Object.keys(projection.ignored).length > 0 && <p>Other resource types not displayed: {Object.entries(projection.ignored).map(([type,count]) => `${type} (${count})`).join(', ')}.</p>}
    {projection.warnings.map((warning,index) => <p key={index}>{warning}</p>)}
  </div>;
}
