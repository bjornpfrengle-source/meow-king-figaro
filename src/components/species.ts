/**
 * Species is the one dimension that lets this codebase become Dog Chaos Arena
 * or Bird Chaos Arena without a rewrite. Every pet entry and every theme
 * carries it. V1 ships cats only — everything defaults to 'cat' and no UI
 * exposes the choice — but the field is written to Firestore from day one so
 * the data is already correct when a second species (or the Swift rewrite)
 * arrives.
 */
export type Species = 'cat' | 'dog' | 'bird';

export const DEFAULT_SPECIES: Species = 'cat';

/** The species this build of the app runs as. Flip to ship a sibling app. */
export const APP_SPECIES: Species = DEFAULT_SPECIES;

/** Normalise anything read out of Firestore (legacy docs have no species). */
export function toSpecies(value: unknown): Species {
  return value === 'dog' || value === 'bird' ? value : DEFAULT_SPECIES;
}

export const SPECIES_LABELS: Record<Species, { one: string; many: string }> = {
  cat: { one: 'Cat', many: 'Cats' },
  dog: { one: 'Dog', many: 'Dogs' },
  bird: { one: 'Bird', many: 'Birds' },
};
