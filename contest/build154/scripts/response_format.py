"""Stateless provider-format projection; native tools/validator retain authority."""
import json
from pathlib import Path
SCHEMA=json.loads((Path(__file__).resolve().parents[1]/'selection-response.schema.json').read_text(encoding='utf-8'))

def apply_verified_selection_format(request):
    messages=request.get('messages',[])
    if not messages or messages[-1].get('role')!='tool':return False
    last=messages[-1]
    try:result=json.loads(last.get('content',''))
    except (ValueError,TypeError):return False
    if not isinstance(result,dict) or result.get('status')!='SELECTED' or result.get('semanticId')!='lesion.lung.mass.001' or result.get('evidenceReference')!='ImagingSelection/r5p-h000-segment-1':return False
    calls=[call for message in messages[:-1] if message.get('role')=='assistant' for call in message.get('tool_calls',[])]
    if not any(call.get('id')==last.get('tool_call_id') and call.get('function',{}).get('name')=='SelectVerifiedStructure' for call in calls):return False
    # WHY: observed malformed final JSON from the pinned CPU provider.
    # BOUNDARY: project the existing native verified-tool context into the
    # provider's supported output-format option. Never repair generated text,
    # choose semantic values, execute tools or relax the native final validator.
    request['response_format']={'type':'json_schema','json_schema':{'name':'DICOM3DFinding','strict':True,'schema':SCHEMA}}
    return True
