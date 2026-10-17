/// Native authentication entry for the security-protected static viewer.
Class DICOM3D.Entry Extends %CSP.Page
{

/// Staging binds the entry link to the exact generated HTML, not a release label.
Parameter VIEWERBUILD = "source";

ClassMethod OnPreHTTP() As %Boolean
{
    Set %response.Expires = 0
    Do %response.SetHeader("Cache-Control", "private, no-cache")
    Quit 1
}

ClassMethod OnPage() As %Status
{
    Write "<!doctype html><html lang='en'><meta charset='utf-8'><title>DICOM3D</title>"
    Write "<h1>DICOM3D</h1><p>Research software. Not for clinical use.</p>"
    Write "<p><a href='index.html?build=",..#VIEWERBUILD,"'>Open DICOM3D viewer</a></p></html>"
    Quit $$$OK
}

}
