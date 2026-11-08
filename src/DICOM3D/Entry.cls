/// Native authentication entry for the security-protected static viewer.
Class DICOM3D.Entry Extends %CSP.Page
{

/// Staging binds the entry link to the exact generated HTML, not a release label.
Parameter VIEWERBUILD = "9f9c775e3da9c2d5cb295adc1923cf395857afe3ee4eaececd51fc7ef1fbb1e7";

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
    Write "<p><a href='reference.html?build=",..#VIEWERBUILD,"'>Open DICOM3D viewer</a></p></html>"
    Quit $$$OK
}

}
