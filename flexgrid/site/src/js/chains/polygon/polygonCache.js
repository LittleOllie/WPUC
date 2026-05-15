/**
 * Polygon collection bookmarks — thin wrapper around per-chain saved collection storage.
 * @see ../savedCollectionsCache.js
 */

import {
  readSavedCollections,
  upsertSavedCollection,
  removeSavedCollection,
  makeSavedCollectionId,
} from "../savedCollectionsCache.js";

export { readSavedCollections };

export function readPolygonSavedCollections() {
  return readSavedCollections("polygon");
}

export function upsertPolygonSavedCollection(rec) {
  return upsertSavedCollection({ ...rec, chain: "polygon" });
}

export function removePolygonSavedCollection(id) {
  removeSavedCollection(id);
}

export function makePolygonSavedId(wallet, contract) {
  return makeSavedCollectionId("polygon", wallet, contract);
}
