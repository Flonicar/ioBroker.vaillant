// iobroker prettier configuration file
import prettierConfig from "@iobroker/eslint-config/prettier.config.mjs";

export default {
  ...prettierConfig,
  // keep double quotes and wider print width to match the existing code style
  singleQuote: false,
  printWidth: 140,
};
