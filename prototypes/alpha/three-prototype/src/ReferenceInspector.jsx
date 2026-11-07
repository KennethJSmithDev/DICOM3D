import React, {useMemo, useState} from 'react';
import './reference-inspector.css';

// Group only by memberships in the pinned source index; do not infer systems.
const SYSTEMS = [
  ['skeletal system', 'Skeletal system', '◈'],
  ['deep fascial system', 'Deep fascial system', '◆'],
  ['cardiovascular system', 'Cardiovascular system', '♥'],
  ['respiratory system', 'Respiratory system', '◉'],
  ['alimentary system', 'Alimentary system', '◆'],
  ['nervous system', 'Nervous system', '✣'],
  ['endocrine system', 'Endocrine system', '✦'],
  ['genital system', 'Genital system', '◇'],
  ['urinary system', 'Urinary system', '◈'],
  ['integumentary system', 'Integumentary system', '◯'],
];
const knownSystems = new Set(SYSTEMS.map(([id]) => id));

export default function ReferenceInspector({index, bundles, pending, matches, query, setQuery,
  selected, setSelected, choice, add, remove, loadAll, residentOwners, activeSystems, allowedIds, toggleSystem, leaveSystems, loadSystems, systemLoading, cancelSystemLoading, bundleErrors}) {
  const [openGroup, setOpenGroup] = useState('');
  const [sourceCategory, setSourceCategory] = useState('');
  const [relationshipQuery, setRelationshipQuery] = useState('');
  const sourceCategories = useMemo(() => [...new Set((index?.structures ?? []).flatMap(item => item.systems ?? []).filter(name => name.startsWith('IS-A:')))].sort(), [index]);
  const groups = useMemo(() => {
    const items = index?.structures ?? [];
    const result = SYSTEMS.map(([id, label, icon]) => ({id, label, icon, items:items.filter(item => item.systems?.includes(id))}));
    result.push({id:'other', label:'Other and unclassified', icon:'◇', items:items.filter(item => !item.systems?.some(id => knownSystems.has(id)))});
    return result.filter(group => group.items.length);
  }, [index]);
  const select = item => { setSelected(item.id); if (!bundles.has(item.bundleId)) add(item.bundleId); };
  const related = choice ? (index?.hierarchy ?? []).filter(entry => entry.owner_ids?.includes(choice.id)).slice(0,12) : [];
  const renderItems = items => <div className="structure-results">{items.slice(0,100).map(item =>
    <button type="button" key={item.id} className="structure-result" aria-pressed={selected===item.id}
      onClick={() => select(item)}><span>{item.label}</span><small>{pending.has(item.bundleId)?'Loading…':bundles.has(item.bundleId)?'Loaded':'Load on select'}</small></button>)}
    {items.length>100 && <p className="structure-hint">Showing 100 of {items.length}. Search to narrow results.</p>}</div>;
  return <section className="panel reference-inspector" aria-label="Reference anatomy explorer">
    <div className="inspector-heading"><div><h2>Anatomy explorer</h2><small>Explore source-backed structures</small></div></div>
    {bundleErrors.size > 0 && <div role="alert">{[...bundleErrors].map(([id,message])=><p key={id}>Bundle {id} unavailable: {message}. Existing resident anatomy is retained; retry loading to clear this error.</p>)}</div>}
    <label className="inspector-label"><span className="inspector-visually-hidden">Search anatomy</span>
      <input aria-label="Search anatomical catalog" placeholder="Search structures…" value={query} onChange={event => setQuery(event.target.value)}/>
    </label>
    {query.trim() ? <><p className="structure-hint">{matches.length} matching structures</p>{matches.length ? renderItems(matches) : <p role="status">No available structures match. Source holds can be searched below.</p>}</> :
      <div className="system-list">{groups.map(group => <div className="system-group" key={group.id}>
        {group.id !== 'other' && <label><input type="checkbox" checked={activeSystems.has(group.id)} onChange={() => toggleSystem(group.id)}/> Show {group.label} in 3D</label>}
        <button type="button" className="system-toggle" aria-expanded={openGroup===group.id} onClick={() => setOpenGroup(openGroup===group.id?'':group.id)}>
          <span className="system-chevron">{openGroup===group.id?'⌄':'›'}</span><span className="system-icon" aria-hidden="true">{group.icon}</span><span>{group.label}</span><small>{group.items.filter(item=>bundles.has(item.bundleId)).length}/{group.items.length} loaded</small>
        </button>{openGroup===group.id && renderItems(group.items)}</div>)}</div>}
    {activeSystems.size > 0 && <div><p>Selected systems show their loaded owners; memberships can overlap. A source relationship may be represented through a whole owner, so its visible geometry can include anatomy beyond that system. Unloaded owners are not missing. Individual hidden choices, including skin, remain in effect.</p><button type="button" disabled={systemLoading} onClick={loadSystems}>{systemLoading?'Loading system bundles…':'Load selected system bundles'}</button>{systemLoading && <button type="button" onClick={cancelSystemLoading}>Stop after current bundle</button>}<button type="button" onClick={leaveSystems}>Return to previous reference presentation</button></div>}
    <div className="inspector-selection" aria-live="polite"><small>SELECTION</small>{choice ? <><b>{choice.label}</b><small>{choice.id} · {bundles.has(choice.bundleId)?'Loaded':pending.has(choice.bundleId)?'Loading…':'Not loaded'}</small>{allowedIds && !allowedIds.has(choice.id) && <small>This owner is outside the selected systems and is not visible in this view. Return to the reference presentation to see it.</small>}{choice.id === 'FMA7309' && <small>The visible lung source is under investigation; anatomical completeness is not established.</small>}{related.length>0 && <details><summary>Source relationships</summary>{related.map(item=><p key={item.id}>{item.label} · {item.id} — {item.ownership_scope === 'DIRECT' ? 'direct owner' : 'represented through existing owner(s), not a separate mesh'} · {item.relation}</p>)}</details>}</> : <small>Select a structure to see its source identity.</small>}</div>
    <details className="inspector-advanced"><summary>Explore source relationships</summary><label>Find relationship <input aria-label="Search source relationships" value={relationshipQuery} onChange={event=>setRelationshipQuery(event.target.value)}/></label>{relationshipQuery.trim() && (index?.hierarchy ?? []).filter(item=>`${item.label} ${item.id}`.toLowerCase().includes(relationshipQuery.toLowerCase())).slice(0,15).map(item=><div key={item.id}><p>{item.label} · {item.id} — {item.ownership_scope === 'DIRECT'?'direct owner':'represented through existing owner(s); not an independent mesh'}</p>{item.owner_ids.map(id=>index.structures.find(owner=>owner.id===id)).filter(Boolean).slice(0,8).map(owner=><button type="button" key={owner.id} onClick={()=>select(owner)}>Select owner: {owner.label} · {owner.id}</button>)}</div>)}</details>
    <details className="inspector-advanced"><summary>Advanced: loading and source details</summary>
      <p>{index?.structures.length ?? '…'} structures · {residentOwners} loaded · {bundles.size}/{index?.bundles.length ?? '…'} bundles</p>
      <label className="inspector-label">Source categories <select value={sourceCategory} onChange={event => setSourceCategory(event.target.value)}><option value="">Choose a source category</option>{sourceCategories.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
      {sourceCategory && renderItems(matches.filter(item => item.systems?.includes(sourceCategory)))}
      <div className="bundlebar"><button type="button" onClick={loadAll} disabled={!index || bundles.size===index.bundles.length}>Load complete reference</button>
        <button type="button" onClick={() => {for (const key of bundles.keys()) remove(key);}} disabled={!bundles.size}>Unload all</button></div>
      <div className="bundle-list">{index?.bundles.map(bundle => <div className="bundle" key={bundle.id}>
        <div><b>{bundle.id}</b><small>{bundle.structureIds.length} structures · {(bundle.byteLength/1048576).toFixed(1)} MiB</small></div>
        <button type="button" onClick={() => bundles.has(bundle.id) ? remove(bundle.id) : add(bundle.id)} disabled={pending.has(bundle.id)}>{pending.has(bundle.id)?'Loading…':bundles.has(bundle.id)?'Unload':'Load'}</button>
      </div>)}</div><small>Memberships may overlap. Other and unclassified retains entries without a supported system label; height bins are navigation aids.</small>
    </details>
    <details className="inspector-advanced"><summary>Source attribution and licenses</summary>
      <p>General reference and NRX research surfaces have separate source notices.</p>
      <p><a style={{color:'var(--work-focus)'}} href={`${import.meta.env.BASE_URL}attribution/BODYParts3D-NOTICE.txt`} target="_blank" rel="noopener noreferrer">BodyParts3D source notice</a></p>
      <p><a style={{color:'var(--work-focus)'}} href={`${import.meta.env.BASE_URL}female-delta/HRA-FEMALE-NOTICE.txt`} target="_blank" rel="noopener noreferrer">HRA female source notice</a></p>
    </details>
  </section>;
}
