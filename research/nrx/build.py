"""Build two frozen NRX research targets with an already configured Emscripten SDK.
No installation, network acquisition, asset generation, or publication occurs here.
"""
import argparse, json, os, subprocess, sys
from pathlib import Path
p=argparse.ArgumentParser()
p.add_argument('target',choices=['study','editable-field'])
p.add_argument('--emxx',required=True,help='Existing em++.py')
p.add_argument('--emdawn-port',required=True,help='Existing emdawnwebgpu.port.py')
p.add_argument('--output',required=True,help='New output directory outside accepted evidence')
a=p.parse_args();root=Path(__file__).resolve().parent;output=Path(a.output).resolve()
output.mkdir(parents=True,exist_ok=False)
exports=['_main','_nrx_shader_ptr','_nrx_uniform_ptr','_nrx_init','_nrx_start','_nrx_value','_nrx_dispose']
if a.target=='study':
 source=root/'c001/tasks/task-3/source/volume.cpp';optimization='-O0'
 exports+=['_nrx_source_ptr','_nrx_mask_ptr','_nrx_mask_publish','_nrx_publish']
else:
 source=root/'c002/tasks/task-3/source/anatomy.cpp';optimization='-O2'
 exports+=['_field_edit','_field_history','_field_state','_field_samples_ptr','_field_samples_bytes','_source_ptr','_source_commit','_field_generate','_field_render_ptr','_field_render_bytes','_field_clear']
command=[sys.executable,'-B',a.emxx,'--target=wasm64','-std=c++17',optimization,'--use-port='+a.emdawn_port,'-sENVIRONMENT=web','-sALLOW_MEMORY_GROWTH=1','-sINITIAL_MEMORY=268435456','-sMAXIMUM_MEMORY=2147483648','-sEXIT_RUNTIME=0','-sEXPORTED_FUNCTIONS='+json.dumps(exports),str(source),'-o',str(output/'native.js')]
env=os.environ.copy();env.update(EMCC_CORES='1',PYTHONDONTWRITEBYTECODE='1')
result=subprocess.run(command,env=env,timeout=150)
raise SystemExit(result.returncode)
