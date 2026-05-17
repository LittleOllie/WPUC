/** Logos with transparent padding in the asset — fill the box edge-to-edge */
const LOGO_EDGE_FILL_IDS = new Set(["ogenies", "spaceriders", "quirklings"]);

export function logoEdgeFill(collection) {
  if (!collection) return false;
  return LOGO_EDGE_FILL_IDS.has(collection.id);
}
