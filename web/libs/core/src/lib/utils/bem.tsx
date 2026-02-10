/**
 * BEM (Block Element Modifier) utility for creating CSS class names
 *
 * This utility provides a flexible way to create BEM-style CSS class names
 * with support for blocks, elements, modifiers, and mixing.
 *
 * Usage:
 *   import { cnb as cn } from "@humansignal/core/lib/utils/bem";
 *   cn("block").elem("element").mod({ active: true }).toClassName()
 *   // → "ls-block__element ls-block__element_active"
 */

type CNMod = Record<string, string | boolean | number | null | undefined>;
type CNMix = string | CN | undefined | null;

/** Type alias for HTML element tag names */
export type CNTagName = keyof JSX.IntrinsicElements;

export type CN = {
  /** Create an element within the block */
  elem(name: string): CN;
  /** Add modifier(s) to the block or element */
  mod(mod?: CNMod): CN;
  /** Mix in additional class names */
  mix(...mix: CNMix[]): CN;
  /** Find the closest ancestor matching this BEM selector */
  closest(root: Element): Element | null;
  /** Convert to class name string */
  toString(): string;
  /** Convert to class name string (alias for toString) */
  toClassName(): string;
};

type CNOptions = {
  elem?: string;
  mix?: CNMix | CNMix[];
  mod?: CNMod;
};

const CSS_PREFIX = process.env.CSS_PREFIX ?? "ls-";

const assembleClass = (block: string, elem?: string, mix?: CNMix | CNMix[], mod?: CNMod) => {
  const rootName = block;
  const elemName = elem ? `${rootName}__${elem}` : null;

  const stateName = Object.entries(mod ?? {}).reduce((res, [key, value]) => {
    const stateClass = [elemName ?? rootName];

    if (value === null || value === undefined) return res;

    if (value !== false) {
      stateClass.push(key);

      if (value !== true) stateClass.push(value as string);

      res.push(stateClass.join("_"));
    }
    return res;
  }, [] as string[]);

  const finalClass: string[] = [];

  finalClass.push(elemName ?? rootName);

  finalClass.push(...stateName);

  if (mix) {
    const mixes = Array.isArray(mix) ? mix : [mix];
    const mixMap = ([] as CNMix[])
      .concat(...mixes)
      .filter((m) => {
        if (typeof m === "string") {
          return m.trim() !== "";
        }
        return m !== undefined && m !== null;
      })
      .map((m) => {
        if (typeof m === "string") {
          return m;
        }
        return m?.toClassName?.();
      })
      .reduce((res, cls) => [...res, ...cls!.split(/\s+/)], [] as string[]);

    finalClass.push(...Array.from(new Set(mixMap)));
  }

  const attachNamespace = (cls: string) => {
    // Safely convert to string and filter out invalid values
    if (!cls) return ""; // Empty value null/undefined/""
    const className = String(cls).trim();
    if (!className) return ""; // Empty string " "
    return className.startsWith(CSS_PREFIX) || CSS_PREFIX === "" ? className : `${CSS_PREFIX}${className}`;
  };

  return finalClass
    .map(attachNamespace)
    .filter((cls) => cls !== "")
    .join(" ");
};

// Internal type that includes toCSSSelector (not exposed publicly)
type CNInternal = CN & {
  /** @internal Convert to CSS selector string - used by closest() */
  toCSSSelector(): string;
};

const cn = (block: string, options: CNOptions = {}): CN => {
  const { elem, mix, mod } = options ?? {};

  const classNameBuilder: CNInternal = {
    elem(name) {
      return cn(block, { elem: name, mix, mod });
    },

    mod(newMod = {}) {
      const stateOverride = Object.assign({}, mod ?? {}, newMod);
      return cn(block, { elem, mix, mod: stateOverride });
    },

    mix(...mix) {
      return cn(block, { elem, mix, mod });
    },

    closest(root) {
      return root.closest(this.toCSSSelector());
    },

    toString() {
      return assembleClass(block, elem, mix, mod);
    },

    toClassName() {
      return this.toString();
    },

    toCSSSelector() {
      return `.${this.toClassName().replace(/(\s+)/g, ".")}`;
    },
  };

  return classNameBuilder;
};

export { cn as cnb };
