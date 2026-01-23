import { getParent, getType, isRoot, types } from "mobx-state-tree";

import Registry from "./Registry";
import { ConfigurationError } from "../utils/errors";

// Cache for union types to avoid recreating identical unions
const unionTypeCache = new Map();
const oneOfCache = new Map();

/**
 * Generate a cache key from an array of tag names.
 * Sorted to ensure consistent keys regardless of array order.
 */
function getArrayCacheKey(arr) {
  return arr.slice().sort().join("|");
}

function _mixedArray(fn) {
  return (arr) => types.maybeNull(types.array(fn(arr)));
}

function _oneOf(lookup, err) {
  return (arr) => {
    const cacheKey = getArrayCacheKey(arr);

    // Return cached union type if available
    const cached = oneOfCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Create Set for O(1) lookup instead of O(n) arr.find()
    const arrSet = new Set(arr);

    const unionType = types.union({
      dispatcher: (sn) => {
        if (arrSet.has(sn.type)) {
          return lookup(sn.type);
        }
        throw new ConfigurationError(err + sn.type);
      },
    });

    oneOfCache.set(cacheKey, unionType);
    return unionType;
  };
}

const oneOfTags = _oneOf(Registry.getModelByTag, "Not expecting tag: ");
const tagsArray = _mixedArray(oneOfTags);

function unionArray(arr) {
  const cacheKey = getArrayCacheKey(arr);

  // Return cached type if available
  const cached = unionTypeCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const type = types.maybeNull(types.array(oneOfTags(arr)));
  type.value = arr;

  unionTypeCache.set(cacheKey, type);
  return type;
}

// Cache for unionTag types
const unionTagCache = new Map();

function unionTag(arr) {
  const cacheKey = getArrayCacheKey(arr);

  const cached = unionTagCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const type = types.maybeNull(types.enumeration("unionTag", arr));
  unionTagCache.set(cacheKey, type);
  return type;
}

// Cache for tagsTypes
const tagsTypesCache = new Map();

function tagsTypes(arr) {
  const cacheKey = getArrayCacheKey(arr);

  const cached = tagsTypesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const type = types.frozen(arr.map((val) => val.toLowerCase()));
  type.describe = () => `(${arr.join("|")})`;
  type.value = arr;

  tagsTypesCache.set(cacheKey, type);
  return type;
}

// Cached Set for Registry.tags - lazy initialized
let registryTagsSet = null;
let registryTagsLength = 0;

function getRegistryTagsSet() {
  // Rebuild Set if tags array has changed (new tags registered)
  if (!registryTagsSet || registryTagsLength !== Registry.tags.length) {
    registryTagsSet = new Set(Registry.tags);
    registryTagsLength = Registry.tags.length;
  }
  return registryTagsSet;
}

// Cache for allModelsTypes result
let allModelsTypesCache = null;
let allModelsTypesCacheLength = 0;

function allModelsTypes() {
  // Return cached if Registry hasn't changed
  if (allModelsTypesCache && allModelsTypesCacheLength === Registry.tags.length) {
    return allModelsTypesCache;
  }

  const tagsSet = getRegistryTagsSet();

  const args = [
    {
      dispatcher: (sn) => {
        if (!sn) return types.literal(undefined);
        // Use Set.has() for O(1) lookup instead of O(n) includes()
        if (tagsSet.has(sn.type)) {
          return Registry.getModelByTag(sn.type);
        }
        throw new ConfigurationError(`Not expecting tag: ${sn.type}`);
      },
    },
    Registry.modelsArr(),
  ];

  const results = [].concat.apply([], args);

  allModelsTypesCache = types.union.apply(null, results);
  allModelsTypesCacheLength = Registry.tags.length;
  return allModelsTypesCache;
}

function isType(node, types) {
  const nt = getType(node);

  for (const t of types) if (nt === t) return true;

  return false;
}

function getParentOfTypeString(node, str) {
  if (isRoot(node)) return null;

  // same as getParentOfType but checks models .name instead of type
  let parent = getParent(node);

  // Convert to Set for O(1) lookup if array, O(1) check if string
  const strSet = Array.isArray(str) ? new Set(str) : null;
  const checkFn = strSet ? (name) => strSet.has(name) : (name) => name === str;

  while (parent) {
    const name = getType(parent).name;

    if (checkFn(name)) return parent;

    parent = isRoot(parent) ? null : getParent(parent);
  }

  return null;
}

function getParentTagOfTypeString(node, str) {
  // same as getParentOfType but checks models .name instead of type
  let parent = getParent(node);

  // Convert to Set for O(1) lookup if array, O(1) check if string
  const strSet = Array.isArray(str) ? new Set(str) : null;
  const checkFn = strSet ? (type) => strSet.has(type) : (type) => type === str;

  while (parent) {
    const parentType = parent.type;

    if (checkFn(parentType)) return parent;

    parent = isRoot(parent) ? null : getParent(parent);
  }

  return null;
}

const oneOfTools = _oneOf(Registry.getTool, "Not expecting tool: ");
const toolsArray = _mixedArray(oneOfTools);

const Types = {
  unionArray,
  allModelsTypes,
  unionTag,
  tagsTypes,
  isType,
  getParentOfTypeString,
  getParentTagOfTypeString,
  tagsArray,
  toolsArray,
};

export default Types;
