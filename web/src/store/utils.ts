/** Set a key in a Map, always returning a new reference. */
export function setInMap<K, V>(map: Map<K, V>, key: K, value: V): Map<K, V> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

/** Delete a key from a Map, returning the same reference if the key wasn't present. */
export function deleteFromMap<K, V>(map: Map<K, V>, key: K): Map<K, V> {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
}

/** Add a value to a Set, returning the same reference if already present. */
export function addToSet<V>(set: Set<V>, value: V): Set<V> {
  if (set.has(value)) return set;
  const next = new Set(set);
  next.add(value);
  return next;
}

/** Delete a key from a Set, returning the same reference if the key wasn't present. */
export function deleteFromSet<V>(set: Set<V>, key: V): Set<V> {
  if (!set.has(key)) return set;
  const next = new Set(set);
  next.delete(key);
  return next;
}
