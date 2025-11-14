import React from "react";
import ReactDOM from "react-dom";
import clsx from "clsx";
import { cn } from "../../../utils/bem";
import { alignElements } from "@humansignal/core/lib/utils/dom";
import { aroundTransition } from "@humansignal/core/lib/utils/transition";
import "./Dropdown.scss";
import { DropdownContext } from "./DropdownContext";
import { DropdownTrigger } from "./DropdownTrigger";

let zIndexCounter = 0;

export const Dropdown = React.forwardRef(({ animated = true, visible = false, rawClassName, ...props }, ref) => {
  const rootName = cn("dropdown-dm");

  /**@type {import('react').RefObject<HTMLElement>} */
  const dropdown = React.useRef();
  const { triggerRef } = React.useContext(DropdownContext) ?? {};
  const isInline = triggerRef === undefined;

  const { children, align, openUpwardForShortViewport, constrainHeight = false } = props;
  const [currentVisible, setVisible] = React.useState(visible);
  const [offset, setOffset] = React.useState({});
  const [visibility, setVisibility] = React.useState(visible ? "visible" : null);

  // Check if browser supports CSS anchor positioning
  const supportsAnchorPositioning = React.useMemo(() => {
    if (!CSS.supports) return false;
    return (
      CSS.supports("anchor-name: --test") ||
      CSS.supports("anchor-name", "--test") ||
      CSS.supports("position-anchor", "--test") ||
      CSS.supports("position-anchor: --test")
    );
  }, []);

  const calculatePosition = React.useCallback(() => {
    const dropdownEl = dropdown.current;
    const parent = triggerRef?.current ?? dropdownEl.parentNode;
    const { left, top } = alignElements(
      parent,
      dropdownEl,
      align ?? "bottom-left",
      0,
      constrainHeight,
      openUpwardForShortViewport ?? true,
    );

    setOffset({ left, top });
  }, [triggerRef, align, openUpwardForShortViewport, constrainHeight]);

  // Generate stable unique ID for this dropdown instance using React.useId()
  const dropdownId = React.useId();
  const anchorName = `--dropdown-trigger-${dropdownId.replace(/:/g, "-")}`;

  // Generate stable z-index for stacking
  const dropdownZIndex = React.useRef(1000 + zIndexCounter++).current;

  const performAnimation = React.useCallback(
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

  const close = React.useCallback(async () => {
    if (currentVisible === false) return;

    props.onToggle?.(false);
    await performAnimation(false);
    setVisible(false);
  }, [currentVisible, performAnimation, props]);

  const open = React.useCallback(async () => {
    if (currentVisible === true) return;

    props.onToggle?.(true);
    await performAnimation(true);
    setVisible(true);
  }, [currentVisible, performAnimation, props]);

  const toggle = React.useCallback(async () => {
    const newState = !currentVisible;

    if (newState) {
      open();
    } else {
      close();
    }
  }, [close, currentVisible, open]);

  React.useEffect(() => {
    if (!ref) return;

    ref.current = {
      dropdown: dropdown.current,
      visible: visibility !== null,
      toggle,
      open,
      close,
    };
  }, [close, open, ref, toggle, dropdown, visibility]);

  React.useEffect(() => {
    setVisible(visible);
  }, [visible]);

  // Set anchor-name on trigger element for CSS anchor positioning
  React.useEffect(() => {
    if (supportsAnchorPositioning && triggerRef?.current) {
      triggerRef.current.style.anchorName = anchorName;
    }
  }, [supportsAnchorPositioning, triggerRef, anchorName]);

  // Set position-anchor on dropdown element dynamically
  React.useEffect(() => {
    if (supportsAnchorPositioning && dropdown.current) {
      dropdown.current.style.positionAnchor = anchorName;
    }
  }, [supportsAnchorPositioning, anchorName, visibility]);

  React.useEffect(() => {
    // Only calculate position if anchor positioning is not supported
    if (!isInline && visibility === "before-appear" && !supportsAnchorPositioning) {
      calculatePosition();
    }
  }, [visibility, calculatePosition, isInline, supportsAnchorPositioning]);

  React.useEffect(() => {
    if (props.enabled === false) performAnimation(false);
  }, [props.enabled]);

  const content =
    children.props && children.props.type === "Menu"
      ? React.cloneElement(children, {
          ...children.props,
          className: rootName.elem("menu").mix(children.props.className),
        })
      : children;

  const visibilityClasses = React.useMemo(() => {
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

  const compositeStyles = React.useMemo(() => {
    const styles = {
      ...(props.style ?? {}),
      zIndex: dropdownZIndex,
    };

    // Only apply JS-calculated offset when anchor positioning is not supported
    if (!supportsAnchorPositioning) {
      Object.assign(styles, offset ?? {});
    }
    // When anchor positioning IS supported, CSS handles everything via @supports

    return styles;
  }, [props.style, offset, dropdownZIndex, supportsAnchorPositioning]);

  const result = (
    <div
      ref={dropdown}
      className={clsx(rootName.toString(), rootName.mix([props.className, visibilityClasses]).toString(), rawClassName)}
      style={compositeStyles}
      onClick={(e) => e.stopPropagation()}
    >
      {content}
    </div>
  );

  // Always use portal unless explicitly inline, to maintain proper z-index stacking
  return props.inline === true ? result : ReactDOM.createPortal(result, document.body);
});

Dropdown.displayName = "Dropdown";

Dropdown.Trigger = DropdownTrigger;
