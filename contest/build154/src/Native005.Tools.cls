Class Native005.Tools Extends %AI.ToolSet
{
XData Definition [ MimeType = application/xml ]
{
<ToolSet Name="AuthorizedImagingEvidence"><Tool Name="ReadEvidence" Method="ReadEvidence"/><Tool Name="SelectVerifiedStructure" Method="SelectVerifiedStructure"/></ToolSet>
}
ClassMethod ReadEvidence() As %DynamicObject
{
 Set source=##class(Native001.Tools).ReadEvidence()
 If source.%Get("error")'="" Quit {"status":"DENIED"}
 Set selected=##class(Native001.Tools).SelectVerifiedStructure("lesion.lung.mass.001")
 If selected.%Get("status")'="SELECTED" Quit {"status":"UNVERIFIED"}
 Do source.%Set("semanticId",selected.%Get("semanticId")),source.%Set("selectionEvidenceReference",selected.%Get("evidenceReference")),source.%Set("selectionStatus",selected.%Get("status"))
 Quit source
}
ClassMethod SelectVerifiedStructure(id As %String) As %DynamicObject
{
 Quit ##class(Native001.Tools).SelectVerifiedStructure(id)
}
}
