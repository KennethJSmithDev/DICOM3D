Include %occStatus
Class Native005.Service Extends Ens.BusinessService
{
Method OnProcessInput(pInput As %RegisteredObject, Output pOutput As %RegisteredObject) As %Status
{
 Set op="Review"
 If pInput.Scenario="synthetic-mismatch" Set op="MismatchReview"
 Quit ..SendRequestSync(op,pInput,.pOutput,240)
}
}
