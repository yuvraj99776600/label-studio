import {
  cloneElement,
  type CSSProperties,
  forwardRef,
  type MouseEvent,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useFullscreen } from "../../hooks/useFullscreen";
import { cn } from "../../utils/bem";
import { alignElements, type Align } from "@humansignal/core/lib/utils/dom";
import { aroundTransition } from "@humansignal/core/lib/utils/transition";
import "./Dropdown.scss";
import { DropdownContext } from "./DropdownContext";
import { FF_DEV_3873, isFF } from "../../utils/feature-flags";

let zIndexCounter = 0;

export interface DropdownRef {
  dropdown: HTMLElement;
  visible: boolean;
  toggle(): void;
  open(): void;
  close(): void;
}

export interface DropdownProps {
  animated?: boolean;
  visible?: boolean;
  alignment?: Align;
  enabled?: boolean;
  inline?: boolean;
  className?: string;
  dataTestId?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
  onToggle?: (visible: boolean) => void;
}

export const Dropdown = forwardRef<DropdownRef, DropdownProps>(
  ({ animated = true, visible = false, ...props }, ref) => {
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
      }
    }, [supportsAnchorPositioning, anchorName, visibility]);

    const calculatePosition = useCallback(() => {
      const dropdownEl = dropdown.current!;
      const parent = (triggerRef?.current ?? dropdownEl.parentNode) as HTMLElement;
      const { left, top } = alignElements(parent!, dropdownEl, props.alignment || "bottom-left");

      setOffset({ left, top });
    }, [triggerRef, minIndex]);

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
      [animated],
    );

    const toggle = useCallback(
      async (updatedState?: boolean, disableAnimation?: boolean) => {
        const newState = updatedState ?? !currentVisible;

        if (currentVisible !== newState) {
          props.onToggle?.(newState);
          await performAnimation(newState, disableAnimation);
          setVisible(newState);
        }
      },
      [currentVisible, performAnimation, props.onToggle],
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

    useFullscreen(
      {
        onEnterFullscreen: () => close(true),
        onExitFullscreen: () => close(true),
      },
      [],
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
      if (visible) {
        open();
      } else {
        close();
      }
    }, [visible]);

    const content = useMemo(() => {
      const ch = children as any;

      return ch.props && ch.props.type === "Menu"
        ? cloneElement(ch, {
            ...ch.props,
            className: rootName.elem("menu").mix(ch.props.className),
          })
        : children;
    }, [children]);

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
    }, [props.style, dropdownZIndex, minIndex, offset, supportsAnchorPositioning]);

    const result = (
      <div
        ref={dropdown as any}
        data-testid={props.dataTestId}
        className={rootName.mix(props.className, visibilityClasses).toClassName()}
        style={{
          ...compositeStyles,
          borderRadius: isFF(FF_DEV_3873) && 4,
        }}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {content}
      </div>
    );

    return props.inline === true ? result : createPortal(result, document.body);
  },
);

Dropdown.displayName = "Dropdown";
