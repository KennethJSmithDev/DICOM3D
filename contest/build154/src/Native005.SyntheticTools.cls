Class Native005.SyntheticTools Extends %AI.ToolSet
{
XData Definition [ MimeType = application/xml ]
{
<ToolSet Name="SyntheticMismatchOnly"><Tool Name="RouteReview" Method="RouteReview"/></ToolSet>
}
ClassMethod ReadEvidence() As %DynamicObject
{
 Set result=##class(%DynamicObject).%New(),resources=##class(%DynamicArray).%New(),ct=##class(%DynamicObject).%New(),seg=##class(%DynamicObject).%New(),sel=##class(%DynamicObject).%New()
 Do ct.%Set("resource","ImagingStudy/synthetic-ct"),ct.%Set("studyUid","urn:example:synthetic:ct-study-A")
 Do seg.%Set("resource","ImagingStudy/synthetic-seg"),seg.%Set("studyUid","urn:example:synthetic:seg-study-B")
 Do sel.%Set("resource","ImagingSelection/synthetic-seg-selection"),sel.%Set("semanticId","synthetic.structure.001"),sel.%Set("studyUid","urn:example:synthetic:seg-study-B"),sel.%Set("derivedFrom","ImagingStudy/synthetic-ct")
 Do resources.%Push(ct),resources.%Push(seg),resources.%Push(sel),result.%Set("scenario","synthetic-only"),result.%Set("resources",resources),result.%Set("purpose","Controlled study UID mismatch; synthetic only, no clinical meaning")
 Quit result
}
ClassMethod RouteReview(id As %String, reason As %String) As %DynamicObject
{
 If id'="synthetic.structure.001" Quit {"status":"DENIED"}
 If $Length(reason)>800 Quit {"status":"DENIED"}
 Set n=$Increment(^Native005Review),req=##class(%DynamicObject).%New(),refs=##class(%DynamicArray).%New()
 Do refs.%Push("ImagingStudy/synthetic-ct"),refs.%Push("ImagingStudy/synthetic-seg"),refs.%Push("ImagingSelection/synthetic-seg-selection")
 Do req.%Set("requestId",n),req.%Set("status","REVIEW_REQUESTED"),req.%Set("semanticId",id),req.%Set("reason",reason),req.%Set("evidenceReferences",refs),req.%Set("syntheticOnly",1)
 Set ^Native005Review(n)=req.%ToJSON()
 Quit req
}
}
