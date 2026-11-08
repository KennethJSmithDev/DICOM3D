Include %occStatus
Class Native005.Operation Extends Ens.BusinessOperation
{
Parameter INVOCATION = "Queue";
Method Review(pRequest As Native005.Request, Output pResponse As Native005.Response) As %Status
{
 If pRequest.Scenario="synthetic-mismatch" Quit ..Mismatch(pRequest,.pResponse)
 Set pResponse=##class(Native005.Response).%New()
 If pRequest.Scenario="source-validation-replay" Quit ..ValidateAnswer(pRequest.Question,.pResponse)
 Set provider=##class(%AI.Provider).Create("openai",{"api_key":"local-only","base_url":"http://127.0.0.1:53571/v1","http_config":{"request_timeout_secs":120}})
 Set agent=##class(%AI.Agent).%New(provider),agent.Model="gpt-oss:20b",agent.SystemPrompt="Use only authorized tool evidence. Call ReadEvidence, then SelectVerifiedStructure for its semanticId. Explain the recorded mask-volume observation in plain language. Return exactly JSON with fields explanation, semanticId, citations (array of exact FHIR resource paths), limitation. Citations must be exactly Observation/r5p-h000-mask-volume and ImagingSelection/r5p-h000-segment-1. Do not cite ImagingStudy paths as a selection, invent values, diagnose, recommend, or give coordinates. State that this research-derived measurement does not establish independent anatomical accuracy, diagnosis, or patient-atlas registration. No markdown fences."
 Do agent.UseToolSet("Native005.Tools")
 Set session=agent.CreateSession({"max_iterations":3,"temperature":0,"max_tokens":1024})
 Set result=agent.Chat(session,pRequest.Question),answer=result.Content
 Quit ..ValidateAnswer(answer,.pResponse)
}
Method ValidateAnswer(answer As %String, Output pResponse As Native005.Response) As %Status
{
 Set parseError=0
 Try { Set parsed=##class(%DynamicObject).%FromJSON(answer) } Catch ex { Set parseError=1 }
 If parseError { Set pResponse.Status="REJECTED_INVALID_RESPONSE",pResponse.Explanation="Native agent response did not satisfy the structured response contract." Quit $$$OK }
 Set refs=parsed.%Get("citations"),bad=0,limitation=parsed.%Get("limitation")
 If $IsObject(refs)=0 Set bad=1
 If $IsObject(refs) {
  Set citationJson=refs.%ToJSON()
  If refs.%Get(0)'="Observation/r5p-h000-mask-volume" Set bad=1
  If refs.%Get(1)'="ImagingSelection/r5p-h000-segment-1" Set bad=1
  If refs.%Size()'=2 Set bad=1
 }
 Set pResponse.SemanticId=parsed.%Get("semanticId")
 If pResponse.SemanticId'="lesion.lung.mass.001" Set bad=1
 If limitation="" Set bad=1
 If bad { Set pResponse.Status="REJECTED_UNSUPPORTED_CITATION_OR_IDENTITY",pResponse.Explanation="Native agent response rejected: citations, limitation, or semantic identity are outside validated source evidence." Quit $$$OK }
 Set pResponse.Status="ACCEPTED",pResponse.Explanation=parsed.%Get("explanation"),pResponse.Citations=refs.%ToJSON()
 Set pResponse.Limitation=limitation
 Quit $$$OK
}
Method Mismatch(pRequest As Native005.Request, Output pResponse As Native005.Response) As %Status
{
 Set provider=##class(%AI.Provider).Create("openai",{"api_key":"local-only","base_url":"http://127.0.0.1:53571/v1","http_config":{"request_timeout_secs":120}})
 Set agent=##class(%AI.Agent).%New(provider),agent.Model="gpt-oss:20b",agent.SystemPrompt="Compare the supplied synthetic CT and SEG study UIDs. If they differ, call RouteReview exactly once for semanticId synthetic.structure.001 and explain the mismatch. Never invent a correction, select a structure, diagnose, or infer coordinates. After the tool result, give a final response with review status and exact three synthetic evidence paths."
 Do agent.UseToolSet("Native005.SyntheticTools")
 Set session=agent.CreateSession({"max_iterations":2,"temperature":0,"max_tokens":1024})
 Set result=agent.Chat(session,pRequest.Question),answer=result.Content,pResponse=##class(Native005.Response).%New()
 Set pResponse.Status="RETURNED",pResponse.Explanation=answer
 Quit $$$OK
}
XData MessageMap
{
<MapItems><MapItem MessageType="Native005.Request"><Method>Review</Method></MapItem></MapItems>
}
}






