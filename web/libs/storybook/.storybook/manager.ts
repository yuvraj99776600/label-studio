import { addons } from "storybook/manager-api";
import { create } from "storybook/theming/create";

const theme = create({
  base: "dark",
  brandTitle: "MLTL Annotate",
  brandUrl: "https://mltl.us",
  brandImage: "logo.svg",
  brandTarget: "_blank",
});

addons.setConfig({
  theme,
});
