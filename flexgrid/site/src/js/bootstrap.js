/** Lightweight UI bootstrapping (theme, disclaimer, collection search). */

import { initThemeToggle } from "./ui/theme.js";
import { initDisclaimer } from "./wizard/disclaimer.js";
import { initCollectionSearch } from "./collections/collectionSearch.js";

export function initBootstrapUi() {
  initDisclaimer();
  initThemeToggle();
  initCollectionSearch();
}
