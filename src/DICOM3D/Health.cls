/// Bounded product/runtime identity. No imaging data is accepted or returned.
Class DICOM3D.Health Extends %CSP.REST
{

Parameter CHARSET = "utf-8";

XData UrlMap
{
<Routes>
  <Route Url="/health" Method="GET" Call="Health" />
</Routes>
}

ClassMethod Health() As %Status
{
    Set %response.ContentType = "application/json"
    Do %response.SetHeader("Cache-Control", "no-store")
    Set body = {"product":"DICOM3D","version":"0.6.5","status":"ok","clinicalUse":false}
    Do body.%Set("runtime", $ZVERSION)
    Write body.%ToJSON()
    Quit $$$OK
}

}
