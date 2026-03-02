import { inject } from "mobx-react";
import React from "react";

const injector = inject(({ store }) => {
  return {
    SDK: store?.SDK,
  };
});

/**
 * Generic CSS spinner — replaces the opossum mascot loader.
 */
const DefaultSpinner = ({ size }) => {
  const spinnerStyle = {
    width: size,
    height: size,
    border: `${Math.max(2, Math.round(size * 0.08))}px solid var(--color-neutral-border, #e5e7eb)`,
    borderTopColor: `var(--color-primary-content, #617ada)`,
    borderRadius: "50%",
    animation: "mltl-spin 0.8s linear infinite",
    boxSizing: "border-box",
  };

  return (
    <>
      <style>{`@keyframes mltl-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={spinnerStyle} />
    </>
  );
};

export const Spinner = injector(({ SDK, visible = true, ...props }) => {
  const size = React.useMemo(() => {
    switch (props.size) {
      case "large":
        return SDK?.spinnerSize?.large ?? 128;
      case "middle":
        return SDK?.spinnerSize?.middle ?? 48;
      case "small":
        return SDK?.spinnerSize?.small ?? 24;
      default:
        return SDK?.spinnerSize?.middle ?? 48;
    }
  }, [props.size]);

  const ExternalSpinner = SDK?.spinner;

  return visible ? (
    <div
      {...props}
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {ExternalSpinner ? (
        <ExternalSpinner size={size} />
      ) : (
        <DefaultSpinner size={size} />
      )}
    </div>
  ) : null;
});
