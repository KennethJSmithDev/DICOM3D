Include %occStatus
Class Native001.Tools Extends %AI.ToolSet
{
XData Definition [ MimeType = application/xml ]
{
<ToolSet Name="AuthorizedImagingEvidence"><Tool Name="ReadEvidence" Method="ReadEvidence"/><Tool Name="SelectVerifiedStructure" Method="SelectVerifiedStructure"/><Tool Name="RouteReview" Method="RouteReview"/></ToolSet>
}
ClassMethod ReadEvidence() As %DynamicObject
{
 Set ^Native001Audit($Increment(^Native001Audit))="ReadEvidence"
 Set ct=..ReadR5("/ImagingStudy/r5p-h000-ct"),seg=..ReadR5("/ImagingStudy/r5p-h000-seg"),selection=..ReadR5("/ImagingSelection/r5p-h000-segment-1"),observation=..ReadR5("/Observation/r5p-h000-mask-volume")
 Set result=##class(%DynamicObject).%New(),ident=##class(%DynamicArray).%New(),derived=##class(%DynamicArray).%New()
 Do ident.%Push(ct.%Get("identifier").%Get(0).%Get("value")),ident.%Push(seg.%Get("identifier").%Get(0).%Get("value"))
 Do derived.%Push(selection.%Get("derivedFrom").%Get(0).%Get("reference")),derived.%Push(selection.%Get("identifier").%Get(0).%Get("value"))
 Do result.%Set("evidenceReference","Observation/r5p-h000-mask-volume"),result.%Set("sourceStudyUIDs",ident),result.%Set("selection",derived),result.%Set("frameOfReferenceUID",selection.%Get("frameOfReferenceUid")),result.%Set("maskVolume",observation.%Get("valueQuantity")),result.%Set("measurementLimitation",observation.%Get("note").%Get(0).%Get("text")),result.%Set("patientReference",ct.%Get("subject").%Get("reference"))
 Quit result
}
ClassMethod ReadR5(path As %String) As %DynamicObject
{
 If '$LISTFIND($LISTBUILD("/ImagingStudy/r5p-h000-ct","/ImagingStudy/r5p-h000-seg","/ImagingSelection/r5p-h000-segment-1","/Observation/r5p-h000-mask-volume","/DocumentReference/r5p-h000-manifest","/Provenance/r5p-h000-mapping","/ImagingSelection/r5p-h000-ct-context","/Patient/r5p-h000-context","/Device/r5p-h000-software"),path) Quit {"error":"DENIED"}
 Set f=##class(%Stream.FileCharacter).%New(),f.Filename="/run/contest/reader.json",credentials=##class(%DynamicObject).%FromJSON(f.Read())
 Set req=##class(%Net.HttpRequest).%New(),req.Server="evidence",req.Port=52773,req.Username="R5P001Reader",req.Password=credentials.%Get("R5P001Reader")
 Do req.SetHeader("Accept","application/fhir+json")
 Set sc=req.Get("/r5p001/fhir/r5"_path)
 If $$$ISERR(sc) Quit {"error":"R5_REQUEST_FAILED"}
 If req.HttpResponse.StatusCode'=200 Quit {"error":"R5_READ_DENIED"}
 Quit ##class(%DynamicObject).%FromJSON(req.HttpResponse.Data)
}
ClassMethod SelectVerifiedStructure(id As %String) As %DynamicObject
{
 If id'="lesion.lung.mass.001" Quit {"status":"DENIED"}
 Set evidence=..ReadR5("/ImagingSelection/r5p-h000-segment-1"),ct=..ReadR5("/ImagingStudy/r5p-h000-ct"),seg=..ReadR5("/ImagingStudy/r5p-h000-seg"),ctsel=..ReadR5("/ImagingSelection/r5p-h000-ct-context")
 If evidence.%Get("identifier").%Get(0).%Get("value")'=id Quit {"status":"UNVERIFIED"}
 If ct.%Get("identifier").%Get(0).%Get("value")'=seg.%Get("identifier").%Get(0).%Get("value") Quit {"status":"AMBIGUOUS"}
 If evidence.%Get("studyUid")'=ctsel.%Get("studyUid") Quit {"status":"AMBIGUOUS"}
 If evidence.%Get("frameOfReferenceUid")'=ctsel.%Get("frameOfReferenceUid") Quit {"status":"AMBIGUOUS"}
 Set ^Native001Audit($Increment(^Native001Audit))="SelectVerifiedStructure"
 Set result=##class(%DynamicObject).%New()
 Do result.%Set("status","SELECTED"),result.%Set("semanticId",id),result.%Set("evidenceReference","ImagingSelection/r5p-h000-segment-1"),result.%Set("frameOfReferenceUid",evidence.%Get("frameOfReferenceUid"))
 Quit result
}
ClassMethod RouteReview(id As %String,reason As %String) As %DynamicObject
{
 If id'="lesion.lung.mass.001" Quit {"status":"DENIED"}
 Set ^Native001Audit($Increment(^Native001Audit))="RouteReview"
 Set result=##class(%DynamicObject).%New()
 Do result.%Set("status","REVIEW_REQUESTED"),result.%Set("semanticId",id),result.%Set("reason",reason)
 Quit result
}
}
