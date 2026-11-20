const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
const validCode = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(value);

// Metadata only: larger real CapabilityStatements remain bounded independently
// of local study and FHIR evidence inputs.
export const MAX_CAPABILITY_BYTES = 8 * 1024 * 1024;

function interactions(value) {
  if (value === undefined) return [];
  requireValue(Array.isArray(value) && value.length <= 64, 'Unsupported interaction list');
  const result = [];
  for (const item of value) {
    requireValue(item && validCode(item.code), 'Invalid interaction code');
    if (!result.includes(item.code)) result.push(item.code);
  }
  return result.sort();
}

// A projection of declared capabilities, not authorization or conformance.
export function summarizeCapabilityStatement(statement) {
  requireValue(statement && !Array.isArray(statement) && statement.resourceType === 'CapabilityStatement', 'Expected a FHIR CapabilityStatement');
  requireValue(typeof statement.fhirVersion === 'string' && /^(4\.(?:0|3)|5\.0)\.\d+$/.test(statement.fhirVersion), 'Only FHIR R4, R4B and R5 statements are supported');
  requireValue(['instance', 'capability', 'requirements'].includes(statement.kind), 'Missing or unsupported statement kind');
  const rest = statement.rest ?? [];
  requireValue(Array.isArray(rest) && rest.length <= 16, 'Unsupported REST capability list');
  const resources = [], systems = [];
  for (const entry of rest) {
    requireValue(entry && ['server', 'client'].includes(entry.mode), 'Missing or unsupported REST mode');
    const entries = entry.resource ?? [];
    requireValue(Array.isArray(entries) && resources.length + entries.length <= 2048, 'Unsupported resource list');
    systems.push({mode: entry.mode, interactions: interactions(entry.interaction)});
    for (const resource of entries) {
      requireValue(resource && typeof resource.type === 'string' && /^[A-Z][A-Za-z0-9]{0,63}$/.test(resource.type), 'Invalid resource type');
      resources.push({mode: entry.mode, type: resource.type, interactions: interactions(resource.interaction)});
    }
  }
  return {fhirVersion: statement.fhirVersion, kind: statement.kind, systems, resources};
}
