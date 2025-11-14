import { cloneElement, forwardRef, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { cn } from "../../utils/bem";
import { alignElements } from "@humansignal/core/lib/utils/dom";
import { aroundTransition } from "@humansignal/core/lib/utils/transition";
import "./Dropdown.scss";
import { DropdownContext } from "./DropdownContext";
import { DropdownTrigger } from "./DropdownTrigger";

let zIndexCounter = 0;

export const Dropdown = forwardRef(({ animated = true, visible = false, ...props }, ref) => {
  const rootName = cn("dropdown-ls");

  /**@type {import('react').RefObject<HTMLElement>} */
  const dropdown = useRef();
  const { triggerRef } = useContext(DropdownContext) ?? {};
  const isInline = triggerRef === undefined;

  const { children } = props;
  const [renderable, setRenderable] = useState(visible);
  const [currentVisible, setVisible] = useState(visible);
  const [offset, setOffset] = useState({});
  const [visibility, setVisibility] = useState(visible ? "visible" : null);

  // Check if browser supports CSS anchor positioning
  const supportsAnchorPositioning = useMemo(() => {
    if (!CSS.supports) return false;
    // Try multiple ways to detect support
    return (
      CSS.supports("anchor-name: --test") ||
      CSS.supports("anchor-name", "--test") ||
      CSS.supports("position-anchor", "--test") ||
      CSS.supports("position-anchor: --test")
    );
  }, []);

  const calculatePosition = useCallback(() => {
    const dropdownEl = dropdown.current;
    const parent = triggerRef?.current ?? dropdownEl.parentNode;
    const { left, top } = alignElements(parent, dropdownEl, `bottom-${props.align ?? "left"}`);

    setOffset({ left, top });
  }, [triggerRef]);

  // Generate stable unique ID for this dropdown instance using React.useId()
  const dropdownId = useId();
  const anchorName = `--dropdown-ls-trigger-${dropdownId.replace(/:/g, "-")}`;

  // Generate stable z-index for stacking
  const dropdownZIndex = useRef(1000 + zIndexCounter++).current;

  // Set anchor-name on trigger element for CSS anchor positioning
  useEffect(() => {
    if (supportsAnchorPositioning && triggerRef?.current) {
      triggerRef.current.style.anchorName = anchorName;
    }
  }, [supportsAnchorPositioning, triggerRef, anchorName]);

  // Set position-anchor on dropdown element dynamically
  useEffect(() => {
    if (supportsAnchorPositioning && dropdown.current) {
      dropdown.current.style.positionAnchor = anchorName;
    }
  }, [supportsAnchorPositioning, anchorName, visibility]);

  const performAnimation = useCallback(
    async (visible = false) => {
      if (props.enabled === false && visible === true) return;

      return new Promise((resolve) => {
        const menu = dropdown.current;

        if (animated !== false) {
          aroundTransition(menu, {
            transition: () => {
              setVisibility(visible ? "appear" : "disappear");
            },
            beforeTransition: () => {
              setVisibility(visible ? "before-appear" : "before-disappear");
            },
            afterTransition: () => {
              setVisibility(visible ? "visible" : null);
              resolve();
            },
          });
        } else {
          setVisibility(visible ? "visible" : null);
          resolve();
        }
      });
    },
    [animated],
  );

  const changeVisibility = useCallback(
    async (visibility) => {
      props.onToggle?.(visibility);
      await performAnimation(visibility);
      setVisible(visibility);
      props.onVisibilityChanged?.(visibility);
    },
    [props, performAnimation],
  );

  const close = useCallback(async () => {
    if (currentVisible === false || renderable === false) return;

    await changeVisibility(false);
    setRenderable(false);
  }, [currentVisible, performAnimation, props, renderable]);

  const open = useCallback(async () => {
    if (currentVisible === true || renderable === true) return;

    setRenderable(true);
  }, [currentVisible, performAnimation, props, renderable]);

  const toggle = useCallback(async () => {
    const newState = !currentVisible;

    if (newState) {
      open();
    } else {
      close();
    }
  }, [close, currentVisible, open]);

  useEffect(() => {
    if (!ref) return;

    ref.current = {
      dropdown: dropdown.current,
      visible: visibility !== null,
      toggle,
      open,
      close,
    };
  }, [close, open, ref, toggle, dropdown, visibility]);

  useEffect(() => {
    setVisible(visible);
  }, [visible]);

  useEffect(() => {
    // Only calculate position manually if anchor positioning is not supported
    if (!isInline && visibility === "before-appear" && !supportsAnchorPositioning) {
      calculatePosition();
    }
  }, [visibility, calculatePosition, isInline, supportsAnchorPositioning]);

  useEffect(() => {
    if (props.enabled === false) performAnimation(false);
  }, [props.enabled]);

  useEffect(() => {
    if (renderable) changeVisibility(true);
  }, [renderable]);

  const content =
    children.props && children.props.type === "Menu"
      ? cloneElement(children, {
          ...children.props,
          className: rootName.elem("menu").mix(children.props.className),
        })
      : children;

  const visibilityClasses = useMemo(() => {
    switch (visibility) {
      case "before-appear":
        return "before-appear";
      case "appear":
        return "appear before-appear";
      case "before-disappear":
        return "before-disappear";
      case "disappear":
        return "disappear before-disappear";
      case "visible":
        return "visible";
      default:
        return visible ? "visible" : null;
    }
  }, [visibility, visible]);

  const compositeStyles = {
    ...(props.style ?? {}),
    // Only apply JS-calculated offset when anchor positioning is not supported
    ...(!supportsAnchorPositioning ? (offset ?? {}) : {}),
    zIndex: dropdownZIndex,
  };

  const result = (
    <div
      ref={dropdown}
      className={rootName.mix([props.className, visibilityClasses]).toClassName()}
      style={compositeStyles}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );

  // Always use portal unless explicitly inline, to maintain proper z-index stacking
  return renderable ? (props.inline === true ? result : ReactDOM.createPortal(result, document.body)) : null;
});

Dropdown.displayName = "Dropdown";

Dropdown.Trigger = DropdownTrigger;
