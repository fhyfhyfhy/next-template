const config = {
  // Resolves the plugin from this project even when run from a directory outside its root.
  plugins: [import.meta.resolve("prettier-plugin-tailwindcss")],
  tailwindStylesheet: "./app/globals.css",
  tailwindFunctions: ["cva", "cn"],
};

export default config;
