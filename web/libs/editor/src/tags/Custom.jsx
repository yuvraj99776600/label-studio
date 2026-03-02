/** Placeholder for CustomInterface tag **/
/** Tag is renamed to ReactCode so we support both names. **/

import { types } from "mobx-state-tree";
import { observer } from "mobx-react";
import Registry from "../core/Registry";
import ControlBase from "./control/Base";

const CustomInterfaceModel = types.compose(
  "CustomInterfaceModel",
  ControlBase,
  types.model({
    type: "custominterface",
  }),
);

const Code = ({ children }) => (
  <code className="text-sm font-mono bg-neutral-surface border border-neutral-border rounded px-tighter py-tightest">
    {children}
  </code>
);

// Register custom tag placeholder
if (!APP_SETTINGS?.billing?.enterprise && !Registry.models.custominterface) {
  const CustomComponentWrapper = observer(({ item }) => {
    return (
      <div className="py-base">
        <Code>{item.type === "custominterface" ? "CustomInterface" : "React"}</Code> tag requires additional configuration.
      </div>
    );
  });

  Registry.addTag("custominterface", CustomInterfaceModel, CustomComponentWrapper);
  Registry.addObjectType(CustomInterfaceModel);
}
