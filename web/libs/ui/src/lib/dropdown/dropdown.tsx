import {
  cloneElement,
  type CSSProperties,
  forwardRef,
  type MouseEvent,
  type MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  type RefObject,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@humansignal/core/lib/utils/bem";
import { alignElements, type Align } from "@humansignal/core/lib/utils/dom";
import { aroundTransition } from "@humansignal/core/lib/utils/transition";
import { DropdownContext } from "./dropdown-context";
import styles from "./dropdown.module.scss";

let zIndexCounter = 0;

export interface DropdownRef {
  dropdown: HTMLElement;
  visible: boolean;
  toggle(newState?: boolean, disableAnimation?: boolean): void;
  open(disableAnimation?: boolean): void;
  close(disableAnimation?: boolean): void;
}

export interface DropdownProps {
  /** Enable animation on open/close */
  animated?: boolean;
  /** Control dropdown visibility */
  visible?: boolean;
  /** Dropdown alignment relative to trigger (e.g., "bottom-left", "top-right") */
  alignment?: Align;
  /** Enable/disable dropdown (when disabled, prevents opening) */
  enabled?: boolean;
  /** Render inline instead of using portal */
  inline?: boolean;
  /** CSS class name for dropdown element */
  className?: string;
  /** Additional CSS class name for dropdown element (from DataManager) */
  dropdownClassName?: string;
  /** Data-testid attribute for testing */
  dataTestId?: string;
  /** Custom styles for dropdown element */
  style?: CSSProperties;
  /** Dropdown content */
  children?: React.ReactNode;
  /** Callback when dropdown visibility changes */
  onToggle?: (visible: boolean) => void;
  /** Additional callback when visibility changes (from LabelStudio) */
  onVisibilityChanged?: (visible: boolean) => void;
  /** Open dropdown upward for short viewports (from DataManager) */
  openUpwardForShortViewport?: boolean;
  /** Constrain dropdown height to prevent overflow (from DataManager) */
  constrainHeight?: boolean;
  /** Sync dropdown width to trigger width (from Enterprise) */
  syncWidth?: boolean;
  /**
   * Render dropdown relative to a different element instead of the trigger (from Enterprise)
   * When used with inline mode, dropdown will be portaled inside this element
   */
  relativeToElement?:
    | RefObject<HTMLElement | undefined>
    | MutableRefObject<HTMLElement | undefined>;
  /**
   * Recalculate dropdown position when dropdown content resizes (from Enterprise)
   * Uses ResizeObserver to track content dimension changes
   */
  followResize?: boolean;
}

export const Dropdown = forwardRef<DropdownRef, DropdownProps>(
  ({ animated = true, visible = false, dropdownClassName, ...props }, ref) => {
    const rootName = cn("dropdown");

    const dropdown = useRef<HTMLElement>();
    const { triggerRef, minIndex } = useContext(DropdownContext) ?? {};
    const isInline = triggerRef === undefined;

    const { children } = props;
    const [currentVisible, setVisible] = useState(visible);
    const [offset, setOffset] = useState({});
    const [visibility, setVisibility] = useState(visible ? "visible" : null);

    // Check if browser supports CSS anchor positioning
    const supportsAnchorPositioning = useMemo(() => {
      if (!CSS.supports) return false;
      return (
        CSS.supports("anchor-name: --test") ||
        CSS.supports("anchor-name", "--test") ||
        CSS.supports("position-anchor", "--test") ||
        CSS.supports("position-anchor: --test")
      );
    }, []);

    // Generate stable unique ID for this dropdown instance using React.useId()
    const dropdownId = useId();
    const anchorName = `--dropdown-trigger-${dropdownId.replace(/:/g, "-")}`;

    // Generate stable z-index for stacking
    const dropdownZIndex = useRef(1000 + zIndexCounter++).current;

    // Set anchor-name on trigger element for CSS anchor positioning
    useEffect(() => {
      if (supportsAnchorPositioning && triggerRef?.current) {
        (triggerRef.current as HTMLElement).style.anchorName = anchorName;
      }
    }, [supportsAnchorPositioning, triggerRef, anchorName]);

    // Set position-anchor on dropdown element dynamically
    useEffect(() => {
      if (supportsAnchorPositioning && dropdown.current) {
        (dropdown.current as HTMLElement).style.positionAnchor = anchorName;

        // Sync width to trigger if requested (Enterprise feature)
        if (props.syncWidth && triggerRef?.current) {
          dropdown.current.style.width = `${triggerRef.current.offsetWidth}px`;
        }
      }
    }, [
      supportsAnchorPositioning,
      anchorName,
      visibility,
      props.syncWidth,
      triggerRef,
    ]);

    const calculatePosition = useCallback(() => {
      const dropdownEl = dropdown.current!;
      const parent = (props.relativeToElement?.current ??
        triggerRef?.current ??
        dropdownEl.parentNode) as HTMLElement;

      // If using relativeToElement with inline mode, use simple positioning
      if (props.inline && props.relativeToElement?.current) {
        setOffset({
          left: (props.alignment?.includes("right") ?? false) ? "100%" : 0,
          top: "100%",
        });
        return;
      }

      const { left, top } = alignElements(
        parent!,
        dropdownEl,
        props.alignment || "bottom-left",
        0,
        props.constrainHeight,
        props.openUpwardForShortViewport ?? true,
      );

      // Sync width to trigger if requested (Enterprise feature)
      if (props.syncWidth && parent) {
        dropdownEl.style.width = `${parent.offsetWidth}px`;
      }

      setOffset({ left, top });
    }, [
      triggerRef,
      minIndex,
      props.alignment,
      props.constrainHeight,
      props.openUpwardForShortViewport,
      props.syncWidth,
      props.relativeToElement,
      props.inline,
    ]);

    const performAnimation = useCallback(
      async (visible = false, disableAnimation?: boolean) => {
        if (props.enabled === false && visible === true) return;

        return new Promise<void>((resolve) => {
          const menu = dropdown.current!;

          if (animated === false || disableAnimation === true) {
            setVisibility(visible ? "visible" : null);
            resolve();
            return;
          }

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
        });
      },
      [animated, props.enabled],
    );

    const toggle = useCallback(
      async (updatedState?: boolean, disableAnimation?: boolean) => {
        const newState = updatedState ?? !currentVisible;

        if (currentVisible !== newState) {
          props.onToggle?.(newState);
          await performAnimation(newState, disableAnimation);
          setVisible(newState);
          props.onVisibilityChanged?.(newState);
        }
      },
      [currentVisible, performAnimation, props],
    );

    const close = useCallback(
      async (disableAnimation?: boolean) => {
        await toggle(false, disableAnimation);
      },
      [toggle],
    );

    const open = useCallback(
      async (disableAnimation?: boolean) => {
        await toggle(true, disableAnimation);
      },
      [toggle],
    );

    useEffect(() => {
      toggle(false);
    }, [isInline]);

    useEffect(() => {
      if (!ref) return;

      const refValue: DropdownRef = {
        dropdown: dropdown.current!,
        visible: visibility !== null,
        toggle,
        open,
        close,
      };

      if (ref instanceof Function) {
        ref(refValue);
      } else {
        ref.current = refValue;
      }
    }, [close, open, ref, toggle, dropdown, visibility]);

    useEffect(() => {
      setVisible(visible);
    }, [visible]);

    // Follow resize: recalculate position when dropdown content resizes (Enterprise feature)
    useEffect(() => {
      if (!dropdown.current || !currentVisible || props.followResize !== true)
        return;

      const elem = dropdown.current;
      const observer = new ResizeObserver(() => {
        calculatePosition();
      });

      observer.observe(elem);

      return () => {
        observer.unobserve(elem);
        observer.disconnect();
      };
    }, [calculatePosition, currentVisible, props.followResize]);

    useEffect(() => {
      // Only calculate position manually if anchor positioning is not supported
      if (
        !isInline &&
        visibility === "before-appear" &&
        !supportsAnchorPositioning
      ) {
        calculatePosition();
      }
    }, [visibility, calculatePosition, isInline, supportsAnchorPositioning]);

    useEffect(() => {
      if (props.enabled === false) performAnimation(false);
    }, [props.enabled, performAnimation]);

    useEffect(() => {
      if (visible) {
        open();
      } else {
        close();
      }
    }, [visible]);

    const content = useMemo(() => {
      const ch = children as any;

      return ch?.props && ch.props.type === "Menu"
        ? cloneElement(ch, {
            ...ch.props,
            className: rootName.elem("menu").mix(ch.props.className),
          })
        : children;
    }, [children, rootName]);

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

    const compositeStyles = useMemo(() => {
      return {
        ...(props.style ?? {}),
        // Only apply JS-calculated offset when anchor positioning is not supported
        ...(!supportsAnchorPositioning ? (offset ?? {}) : {}),
        zIndex: (minIndex ?? 0) + dropdownZIndex,
      };
    }, [
      props.style,
      dropdownZIndex,
      minIndex,
      offset,
      supportsAnchorPositioning,
    ]);

    const result = (
      <div
        ref={dropdown as any}
        data-testid={props.dataTestId}
        className={rootName
          .mix(props.className, dropdownClassName, visibilityClasses)
          .toClassName()}
        style={compositeStyles}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {content}
      </div>
    );

    // Handle different rendering modes
    if (props.inline === true) return result;
    if (props.relativeToElement?.current) {
      return createPortal(result, props.relativeToElement.current);
    }
    return createPortal(result, document.body);
  },
);

Dropdown.displayName = "Dropdown";
