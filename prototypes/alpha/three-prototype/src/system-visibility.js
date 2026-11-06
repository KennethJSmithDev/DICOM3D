/** Project selected source catalog memberships to owner IDs, never inferred anatomy. */
export function ownersForSystems(structures, systems) {
  const selected = new Set(systems);
  return new Set(structures.filter(item => (item.systems ?? []).some(system => selected.has(system))).map(item => item.id));
}
