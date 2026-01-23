import { getParent, getType, isRoot, types } from "mobx-state-tree";

import Registry from "./Registry";
import { ConfigurationError } from "../utils/errors";

function _mixedArray(fn) {
  return (arr) => types.maybeNull(types.array(fn(arr)));
}

function _oneOf(lookup, err) {
  // Cache Set instances per array to avoid recreating on every call
  const arrToSet = new WeakMap();

  return (arr) => {
    // Get or create a Set for O(1) lookup instead of O(n) arr.find()
    let arrSet = arrToSet.get(arr);
    if (!arrSet) {
      arrSet = new Set(arr);
      arrToSet.set(arr, arrSet);
    }

    return types.union({
      dispatcher: (sn) => {
        if (arrSet.has(sn.type)) {
          return lookup(sn.type);
        }
        throw new ConfigurationError(err + sn.type);
      },
    });
  };
}

const oneOfTags = _oneOf(Registry.getModelByTag, "Not expecting tag: ");
const tagsArray = _mixedArray(oneOfTags);

function unionArray(arr) {
  const type = types.maybeNull(types.array(oneOfTags(arr)));

  type.value = arr;
  return type;
}

function unionTag(arr) {
  return types.maybeNull(types.enumeration("unionTag", arr));
}

function tagsTypes(arr) {
  const type = types.frozen(arr.map((val) => val.toLowerCase()));

  type.describe = () => `(${arr.join("|")})`;
  type.value = arr;
  return type;
}

// Cached Set for Registry.tags - lazy initialized once
let registryTagsSet = null;

function getRegistryTagsSet() {
  // Rebuild Set if tags array has changed (new tags registered)
  if (!registryTagsSet || registryTagsSet.size !== Registry.tags.length) {
    registryTagsSet = new Set(Registry.tags);
  }
  return registryTagsSet;
}

function allModelsTypes() {
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

  return types.union.apply(null, results);
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
