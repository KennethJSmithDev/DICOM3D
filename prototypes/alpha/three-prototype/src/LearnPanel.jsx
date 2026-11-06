import React,{useEffect,useRef,useState} from 'react';
import {buildLearnContext} from './learn-context.mjs';
import {beginnerLesson} from './beginner-learning.mjs';
import './learn.css';

/** The panel follows existing state; it never changes selection, geometry or imaging. */
export default function LearnPanel({open,onClose,context,availableActions=[],onAction}){
 const [tab,setTab]=useState('beginner'),[answer,setAnswer]=useState(null),heading=useRef(null);
 const lesson=buildLearnContext(context);
 const beginner=beginnerLesson(context,lesson);
 const actions=beginner.actions.filter(item=>availableActions.includes(item.id)&&typeof onAction==='function');
 useEffect(()=>{if(open)heading.current?.focus({preventScroll:true})},[open]);
 useEffect(()=>setAnswer(null),[beginner.key]);
 if(!open)return null;
 return <section id="learn-panel" className="panel learn-panel" aria-labelledby="learn-heading" onKeyDown={event=>{if(event.key==='Escape'){event.stopPropagation();onClose?.()}}}>
  <div className="learn-heading"><div><small className="section-eyebrow">LEARN · CURRENT VIEW</small><h2 ref={heading} tabIndex={-1} id="learn-heading">{tab==='beginner'?beginner.title:lesson.title}</h2></div><button type="button" aria-label="Close Learn" onClick={onClose}>×</button></div>
  <p className="learn-context" aria-live="polite">{lesson.subtitle}</p>
  <div className="learn-tabs" role="group" aria-label="Learning depth"><button type="button" aria-pressed={tab==='beginner'} onClick={()=>setTab('beginner')}>Beginner</button><button type="button" aria-pressed={tab==='understand'} onClick={()=>setTab('understand')}>Explore</button><button type="button" aria-pressed={tab==='source'} onClick={()=>setTab('source')}>Evidence</button></div>
  {tab==='beginner'?<div className="learn-beginner">
   <p className="learn-intro">{beginner.intro}</p>
   <p className="learn-follows">These lessons follow what you select and view. Choose Explore for more detail or Evidence for source records.</p>
   {!!actions.length&&<div className="learn-actions" role="group" aria-label="Try it in the viewer">{actions.map(item=><button type="button" key={item.id} onClick={()=>onAction(item.id)}>{item.label}</button>)}</div>}
   <div className="learn-lessons">{beginner.ideas.map(item=><article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
   {!!beginner.terms.length&&<details className="learn-glossary"><summary>New words, simply explained</summary><dl>{beginner.terms.map(item=><React.Fragment key={item.title}><dt>{item.title}</dt><dd>{item.body}</dd></React.Fragment>)}</dl></details>}
   {beginner.check&&<fieldset className="learn-check"><legend>Check your understanding</legend><p>{beginner.check.prompt}</p>{beginner.check.answers.map((value,i)=><button type="button" key={value} aria-pressed={answer===i} onClick={()=>setAnswer(i)}>{value}</button>)}{answer!==null&&<p role="status">{answer===beginner.check.correct?'That’s right. ':'Try thinking about it this way: '}{beginner.check.explanation}</p>}</fieldset>}
   {!!beginner.links.length&&<nav className="learn-links" aria-label="Beginner learning references">{beginner.links.map(link=><a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</nav>}
  </div>:tab==='understand'?<div className="learn-lessons">{lesson.cards.map(item=><article key={item.title}><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>:<div className="learn-sources">
   <dl>{lesson.sourceRows.map(row=><React.Fragment key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></React.Fragment>)}</dl>
   {!lesson.sourceRows.length&&<p>No acquired source is active. Load a study or select a reference structure to see its evidence.</p>}
   {!!lesson.relationships.length&&<details><summary>Recorded source relationships · {lesson.relationships.length} shown</summary>{lesson.relationships.map((row,i)=><p key={`${row.id}-${i}`}><b>{row.label}</b><br/>{row.id} · {row.scope}{row.relation?` · ${row.relation}`:''}</p>)}</details>}
   <p>Source relationships describe the supplied anatomy; they do not establish a spatial match to a patient.</p>
  </div>}
  {!!lesson.links.length&&<nav className="learn-links" aria-label="Learning source attribution">{lesson.links.map(link=><a key={link.label} href={link.href??`${import.meta.env.BASE_URL}${link.path}`} target="_blank" rel="noopener noreferrer">{link.label}</a>)}</nav>}
 </section>;
}
