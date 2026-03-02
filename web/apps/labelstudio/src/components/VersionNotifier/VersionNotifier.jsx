import { createContext, useContext } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../utils/bem";

const VersionContext = createContext();

/**
 * VersionProvider - White-labeled: no longer fetches version info.
 */
export const VersionProvider = ({ children }) => {
  return <VersionContext.Provider value={{}}>{children}</VersionContext.Provider>;
};

/**
 * VersionNotifier - White-labeled to render nothing.
 * Removes version update notifications and external links.
 */
export const VersionNotifier = ({ showNewVersion, showCurrentVersion }) => {
  return null;
};
