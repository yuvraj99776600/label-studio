import Registry from "../Registry";
import messages from "../../utils/messages";

export const errorBuilder = {
  /**
   * Occurrs when attribute is not provided at all
   */
  required(modelName, field) {
    return {
      modelName,
      field,
      error: "ERR_REQUIRED",
    };
  },

  /**
   * Occurrs when tag is not in our Registry
   */
  unknownTag(modelName, field, value) {
    return {
      modelName,
      field,
      value,
      error: "ERR_UNKNOWN_TAG",
    };
  },

  /**
   * Occurrs when tag is not on the tree
   */
  tagNotFound(modelName, field, value) {
    return {
      modelName,
      field,
      value,
      error: "ERR_TAG_NOT_FOUND",
    };
  },

  /**
   * Occurrs when referenced tag cannot be controlled by particular control tag
   */
  tagUnsupported(modelName, field, value, validType) {
    return {
      modelName,
      field,
      value,
      validType,
      error: "ERR_TAG_UNSUPPORTED",
    };
  },

  /**
   * Occurrs when tag has not expected parent tag at any level
   */
  parentTagUnexpected(modelName, field, value, validType) {
    return {
      modelName,
      field,
      value,
      validType,
      error: "ERR_PARENT_TAG_UNEXPECTED",
    };
  },

  /**
   * Occurrs when attribute value has wrong type
   */
  badAttributeValueType(modelName, field, value, validType) {
    return {
      modelName,
      field,
      value,
      validType,
      error: "ERR_BAD_TYPE",
    };
  },

  internalError(error) {
    return {
      error: "ERR_INTERNAL",
      value: String(error).substr(0, 1000),
      field: String(error.code),
      modelName: "",
    };
  },

  generalError(error) {
    return {
      error: "ERR_GENERAL",
      value: String(error).substr(0, 1000),
      field: String(error.code),
      modelName: "",
    };
  },

  loadingError(error, url, attrWithUrl, message = messages.ERR_LOADING_HTTP) {
    console.log("ERR", error, error.code);
    return {
      error: "ERR_GENERAL",
      value: message({ attr: attrWithUrl, error: String(error), url }),
      field: attrWithUrl,
      modelName: "",
    };
  },
};

/**
 * Transforms MST `describe()` to a human-readable value
 * @param {import("mobx-state-tree").IType} type
 * @param {boolean} withNullType
 */
const getTypeDescription = (type, withNullType = true) => {
  const description = type
    .describe()
    .match(/([a-z0-9?|]+)/gi)
    .join("")
    .split("|");

  // Remove optional null
  if (withNullType === false) {
    const index = description.indexOf("null?");

    if (index >= 0) description.splice(index, 1);
  }

  return description;
};

/**
 * Flatten config tree for faster iterations and searches
 * @param {object} tree
 * @param {string | null;;} parent
 * @param {string[]} parentParentTypes
 * @param {object[]} result
 * @returns {object[]}
 */
const flattenTree = (tree, parent = null, parentParentTypes = ["view"], result) => {
  if (!tree.children) return [];

  const children = tree.type === "pagedview" ? tree.children.slice(0, 1) : tree.children;

  for (const child of children) {
    /* Create a child without children and
    assign id of the parent for quick mathcing */
    const parentTypes = [...parentParentTypes, ...(parent?.type ? [parent?.type] : [])];
    const flatChild = { ...child, parent: parent?.id ?? null, parentTypes };

    delete flatChild.children;

    result.push(flatChild);

    if (Array.isArray(child.children)) {
      flattenTree(child, child, parentTypes, result);
    }
  }

  return result;
};

/**
 * Validates presence and format of the name attribute
 * @param {Object} child
 * @param {Object} model
 */
const validateNameTag = (child, model) => {
  const { name } = model.properties;

  // HyperText can be used for mark-up, without name, so name is optional type there
  if (name && !name.optionalValues && child.name === undefined) {
    return errorBuilder.required(model.name, "name");
  }

  return null;
};

/**
 * Validates toName attribute
 * Checks that connected tag is existing tag, it present in the tree
 * and can be controlled by current Object Tag
 * @param {Object} element
 * @param {Object} model
 * @param {Map<string, Object>} nameMap - Pre-built map of name -> element for O(1) lookup
 */
const validateToNameTag = (element, model, nameMap) => {
  const { controlledTags } = model.properties;

  if (!element.toname) return null;

  const names = element.toname.split(","); // for pairwise

  for (const name of names) {
    // Use Map for O(1) lookup instead of O(n) flatTree.find()
    const controlledTag = nameMap.get(name);

    if (controlledTag === undefined) {
      return errorBuilder.tagNotFound(model.name, "toname", name);
    }

    if (controlledTags && controlledTags.validate(controlledTag.tagName).length) {
      return errorBuilder.tagUnsupported(model.name, "toname", controlledTag.tagName, controlledTags);
    }
  }

  return null;
};

/**
 * Validates parent of tag
 * Checks that parent tag has the right type
 * @param {Object} element
 * @param {Object} model
 */
const validateParentTag = (element, model) => {
  const parentTypes = model.properties.parentTypes?.value;

  if (!parentTypes) {
    return null;
  }

  // Convert to lowercase Set for O(1) lookup instead of nested O(n²) find()
  const parentTypesSet = new Set(parentTypes.map((type) => type.toLowerCase()));

  // Check if any element parent type matches allowed parent types
  const hasValidParent = element.parentTypes.some((elementParentType) => parentTypesSet.has(elementParentType));

  if (hasValidParent) {
    return null;
  }

  return errorBuilder.parentTagUnexpected(model.name, "parent", element.tagName, model.properties.parentTypes);
};

// Pre-computed Set for O(1) lookup instead of O(n) includes()
const visualTagsSet = new Set(["Collapse", "Filter", "Header", "Style", "View"]);

/**
 * Validates if visual tags have name attribute
 * @param {Object} element
 */
const validateVisualTags = (element) => {
  const { tagName } = element;

  if (visualTagsSet.has(tagName) && element.name) {
    return errorBuilder.generalError(`Attribute <b>name</b> is not allowed for tag <b>${tagName}</b>.`);
  }

  return null;
};

/**
 * Validate other tag attributes other than name and toName
 * @param {Object} child
 * @param {import("mobx-state-tree").IModelType} model
 * @param {string[]} fieldsToSkip
 */
const validateAttributes = (child, model, fieldsToSkip) => {
  const result = [];
  const properties = Object.keys(model.properties);

  for (const key of properties) {
    if (!{}.hasOwnProperty.call(child, key)) continue;
    if (fieldsToSkip.includes(key)) continue;
    const value = child[key];
    const modelProperty = model.properties[key.toLowerCase()];
    const mstValidationResult = modelProperty.validate(value, modelProperty);

    if (mstValidationResult.length === 0) continue;

    result.push(errorBuilder.badAttributeValueType(model.name, key, value, modelProperty));
  }

  return result;
};

/**
 * Validate perRegion restrictions
 * @param {Object} child
 */
const validatePerRegion = (child) => {
  const validationResult = [];

  // PerItem and PerRegion are incompatible but PerRegion is more prioritized mode
  if (child.perregion && child.peritem) {
    validationResult.push(
      errorBuilder.generalError(
        "Attribute <b>perItem</b> is incompatible with attribute <b>perRegion</b>. " +
          "They define two different modes. However <b>perRegion</b> works fine even with multi-item mode of object tags.",
      ),
    );
  }

  return validationResult;
};

/**
 * Convert MST type to a human-readable string
 * @param {import("mobx-state-tree").IType} type
 */
const humanizeTypeName = (type) => {
  return type ? getTypeDescription(type, false) : null;
};

export class ConfigValidator {
  /**
   * Validate node attributes and compatibility with other nodes
   * @param {*} node
   */
  static validate(root) {
    const flatTree = [];

    flattenTree(root, null, [], flatTree);

    // Build name -> element Map for O(1) lookup in validateToNameTag
    // This eliminates O(n²) nested find() operations
    const nameMap = new Map();
    for (const item of flatTree) {
      if (item.name) {
        nameMap.set(item.name, item);
      }
    }

    const propertiesToSkip = ["id", "children", "name", "toname", "controlledTags", "parentTypes"];
    const validationResult = [];

    for (const child of flatTree) {
      try {
        const model = Registry.getModelByTag(child.type);
        // Validate name attribute
        const nameValidation = validateNameTag(child, model);

        if (nameValidation !== null) validationResult.push(nameValidation);

        // Validate toName attribute - now uses nameMap for O(1) lookup
        const toNameValidation = validateToNameTag(child, model, nameMap);

        if (toNameValidation !== null) validationResult.push(toNameValidation);

        // Validate by parentUnexpected parent tag
        const parentValidation = validateParentTag(child, model);

        if (parentValidation !== null) validationResult.push(parentValidation);

        validationResult.push(...validatePerRegion(child));

        validationResult.push(...validateAttributes(child, model, propertiesToSkip));
      } catch (e) {
        validationResult.push(errorBuilder.unknownTag(child.type, child.name, child.type));
      }
    }

    if (validationResult.length) {
      return validationResult.map((error) => ({
        ...error,
        validType: humanizeTypeName(error.validType),
      }));
    }

    return [];
  }
}
