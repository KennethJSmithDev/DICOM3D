/// Native authentication entry for the security-protected static viewer.
Class DICOM3D.Entry Extends %CSP.Page
{

/// Staging binds the entry link to the exact generated HTML, not a release label.
Parameter VIEWERBUILD = "236fe2950fa1d8ba6943f03ce7b86c7a418b33e7c9c2b891108d5146fa2a791e";

ClassMethod OnPreHTTP() As %Boolean
{
    Set %response.Expires = 0
    If $Data(%request.Data("fhirSource",1)) || $Data(%request.Data("fhirStudy",1)) {
        Set %response.ContentType = "application/json"
        Do %response.SetHeader("Cache-Control", "no-store")
        Do %response.SetHeader("X-Content-Type-Options", "nosniff")
        Set binding = ""
        If (%request.Method="GET") && ('$Data(%request.Data("fhirSource",2))) && ('$Data(%request.Data("fhirStudy",2))) {
            Set binding = ..FhirBinding($Get(%request.Data("fhirSource",1)),$Get(%request.Data("fhirStudy",1)))
        }
        If binding="" Set %response.Status = "404 Not Found"
        // Keep the checked result only for this request, across the HTTP header/body callbacks.
        Set %request.Data("%dicom3dBinding",1) = binding
        Quit 1
    }
    Do %response.SetHeader("Cache-Control", "private, no-cache")
    Quit 1
}

ClassMethod OnPage() As %Status
{
    If $Data(%request.Data("fhirSource",1)) || $Data(%request.Data("fhirStudy",1)) {
        Write $Get(%request.Data("%dicom3dBinding",1))
        Quit $$$OK
    }
    Write "<!doctype html><html lang='en'><meta charset='utf-8'><title>DICOM3D</title>"
    Write "<h1>DICOM3D</h1><p>Research software. Not for clinical use.</p>"
    Write "<p><a href='reference.html?build=",..#VIEWERBUILD,"'>Open DICOM3D viewer</a></p></html>"
    Quit $$$OK
}

/// The grant belongs to the signed-in reader. The FHIR repository independently
/// authenticates the reader and authorizes the requested ImagingStudy.
ClassMethod FhirBinding(sourceId As %String, studyId As %String) As %String [ Private ]
{
    If ($Username="") || ($ZConvert($Username,"L")="unknownuser") Quit ""
    If '$Match(sourceId,"[A-Za-z0-9_-]{1,64}") Quit ""
    If '$Match(studyId,"[A-Za-z0-9.-]{1,64}") Quit ""
    If (studyId=".") || (studyId="..") Quit ""
    Set binding = $Get(^DICOM3DFHIR("reader",$Username,sourceId,studyId))
    If '$ListValid(binding) Quit ""
    If $ListLength(binding)'=2 Quit ""
    Set path = $ListGet(binding,1), version = $ListGet(binding,2)
    If ($Length(path)>256) || ('$Match(path,"(/[A-Za-z0-9_-]+)*/fhir(/(r4|r4b|r5))?")) Quit ""
    If (version'="4.0.1") && (version'="4.3.0") && (version'="5.0.0") Quit ""
    Set body = {}
    Do body.%Set("reader",$Username)
    Do body.%Set("sourceId",sourceId)
    Do body.%Set("studyId",studyId)
    Do body.%Set("path",path)
    Do body.%Set("fhirVersion",version)
    Quit body.%ToJSON()
}

}
