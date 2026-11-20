import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Box3, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {ownScene, releaseScene} from '../scene-ownership.js';
import {publicAtlasAssets} from '../public-asset-cache.js';
import {fitPerspectiveBounds} from '../fit-perspective-bounds.js';
import RenderCadence, {requestSceneFrames} from '../RenderCadence.jsx';
import {inspectPlacenta, placentaAsset, showPlacentaSelection} from './placenta-model.mjs';
import sourceUrl from './hra-full-term.glb?url';
import embryoUrl from './development/carnegie-stage20.glb?url';
import fetalImage from './development/fetus-in-uterus.png';
import './placenta.css';
import PregnancyUltrasoundExamples from './PregnancyUltrasoundExamples.jsx';

const framePolicy = {fps:30};
const startDirection = new Vector3(.24,.28,1).normalize();
const initialCamera = {fov:35, near:.001, far:20};
const embryoAsset = {bytes:8693412, sha256:'db01df5a04b16fe6fa175d1e3605d883a0ab5cb8113592e96b6b8fc0bb58a6dc'};
const sideDirection = new Vector3(1,0,0);

function Specimen({model, selected, isolated, fit, onSelect}) {
  const {camera, gl} = useThree();
  const controls = useRef();
  const part = model.parts.find(item => item.id === selected);
  useLayoutEffect(() => {
    const orbit = new OrbitControls(camera, gl.domElement);
    controls.current = orbit;
    orbit.addEventListener('change', requestSceneFrames);
    fitPerspectiveBounds(camera, orbit, new Box3().setFromObject(model.scene), fit.side ? sideDirection : startDirection);
    return () => {
      orbit.removeEventListener('change', requestSceneFrames);
      orbit.dispose();
    };
  }, [camera, gl, model, fit]);
  useLayoutEffect(() => {
    if (!model.embryo) showPlacentaSelection(model.parts, selected, isolated);
    requestSceneFrames();
  }, [model, selected, isolated]);
  return <>
    <ambientLight intensity={1.65}/>
    <directionalLight position={[2,3,4]} intensity={2.3}/>
    <directionalLight position={[-2,0,-2]} intensity={1.2}/>
    <primitive object={model.scene} dispose={null} onClick={event => {
      if (model.embryo || event.delta > 4 || !event.object.isMesh || !event.object.visible) return;
      event.stopPropagation();
      onSelect(event.object.userData.sourceKey);
    }}/>
    {!model.embryo && selected !== 'HRA:421' && !isolated && <boxHelper key={selected} args={[part.node, '#ffcd72']} raycast={() => null}/>}
  </>;
}

class SceneBoundary extends React.Component {
  state = {failed:false};
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    return this.state.failed ? <p role="alert">3D display unavailable on this device.</p> : this.props.children;
  }
}

export default function PlacentaReference({variant = 'placenta', CanvasComponent, createRenderer, embedded = false}) {
  const embryo = variant === 'embryo';
  const title = embryo ? 'Human embryo · Carnegie stage 20' : 'Placenta and umbilical cord';
  const specimen = embryo ? 'Embryo' : 'Placenta';
  const [model, setModel] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('HRA:421');
  const [isolated, setIsolated] = useState(false);
  const [fit, setFit] = useState({side:false});
  useEffect(() => {
    const abort = new AbortController();
    let ownedScene;
    async function load() {
      try {
        const asset = embryo ? embryoAsset : placentaAsset;
        const bytes = await publicAtlasAssets.get(embryo ? embryoUrl : sourceUrl, asset.bytes, asset.sha256, abort.signal);
        abort.signal.throwIfAborted();
        const {scene} = await new GLTFLoader().parseAsync(bytes, '');
        ownedScene = ownScene(scene);
        if (abort.signal.aborted) { releaseScene(ownedScene); return; }
        setModel({scene, embryo, parts:embryo ? [] : inspectPlacenta(scene)});
      } catch {
        if (ownedScene) { releaseScene(ownedScene); ownedScene = undefined; }
        if (!abort.signal.aborted) setError(`Could not load the verified ${variant} reference.`);
      }
    }
    load();
    return () => { abort.abort(); if (ownedScene) releaseScene(ownedScene); };
  }, [attempt, variant, embryo]);
  const part = model?.parts.find(item => item.id === selected);
  const visible = isolated ? part?.members.length : 8;
  return <article className="placenta-study">
    <header>{!embedded && <a href={location.pathname}>◇ DICOM3D atlas</a>}<h1>{title}</h1>
      <p>{embryo ? 'Early human development · Carnegie Collection' : 'Full-term educational reference · Human Reference Atlas'}</p></header>
    <div className="placenta-stage" aria-label={specimen + ' 3D viewport'}>
      {model ? <SceneBoundary><CanvasComponent gl={createRenderer} camera={initialCamera} dpr={1} frameloop="never">
        <RenderCadence name={variant} policy={framePolicy}/>
        <Specimen model={model} selected={selected} isolated={isolated} fit={fit} onSelect={setSelected}/>
      </CanvasComponent></SceneBoundary> : <p role="status">{error || `Loading ${variant} reference…`}
        {error && <button onClick={() => {setError(''); setAttempt(value => value+1);}}>Retry</button>}</p>}
    </div>
    {model && <section aria-label={specimen + ' controls'}>
      {!embryo && <><label>Reference structure<select value={selected} onChange={event => setSelected(event.target.value)}>
        {model.parts.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select></label>
      <label><input type="checkbox" checked={isolated} onChange={event => setIsolated(event.target.checked)}/> Isolate selection</label></>}
      <button onClick={() => setFit({side:false})}>Fit reference</button>
      {embryo && <button onClick={() => setFit({side:true})}>Side view</button>}
      <p role="status">{embryo ? '1 surface · Carnegie stage 20' : `${part.label} · ${selected} · ${visible} ${visible === 1 ? 'component' : 'components'} visible`}</p>
    </section>}
    {embryo ? <>
      <p>Drag to turn the embryo and follow its curved outline from the head to the developing limbs.</p>
      <details><summary>Fetal development illustration</summary>
        <figure><img src={fetalImage} loading="lazy" width="1240" height="1933" style={{maxWidth:'100%',height:'auto',maxHeight:'60vh',objectFit:'contain',background:'white'}} alt="Cutaway illustration of a single fetus curled inside the uterus, with its head downward and the cord visible."/>
        <figcaption>This separate illustration shows one fetus inside the uterus. The artist gives no gestational week. The image and the embryo model each have their own scale.</figcaption></figure>
        <p>Ryan Kissinger, NIAID Visual &amp; Medical Arts. Courtesy of NIAID. Public domain. <a href="https://bioart.niaid.nih.gov/bioart/420">Pregnant Human and Fetus in Uterus · BIOART-000420</a></p>
      </details>
      <details><summary>About this reference and its source</summary>
        <p>The Carnegie Collection specimen shows an individual human embryo at stage 20. NIH distributes one segmented exterior surface repaired for 3D printing. This example has no alignment to the adult atlas or the H001 ultrasound figures.</p>
        <p>NIH 3D contributor kbrowne. Carnegie Collection, Archives of the Human Developmental Anatomy Center, National Museum of Health and Medicine. Original model, version 3.02. <a href="https://3d.nih.gov/entries/3DPX-016951">NIH 3D record</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
      </details>
    </> : <>{!embedded && <PregnancyUltrasoundExamples/>}
    <details><summary>About this reference and its source</summary>
      <p>This sculpted full-term specimen is partly informed by MRI from UC San Diego Health. It is shown in its own coordinate space. The reference illustrates placental anatomy and supplies no patient-specific or twin arrangement.</p>
      <p>Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP. DICOM3D extracted eight meshes from the united-female v1.5 model and retained their original hierarchy, geometry and materials. Source nodes 428 and 429 distinguish the two umbilical arteries.</p>
      <p><a href="https://3d.nih.gov/entries/3DPX-020985">NIH placenta reference</a> · <a href="https://3d.nih.gov/entries/3DPX-020992/2">Source model</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></p>
    </details></>}
  </article>;
}
