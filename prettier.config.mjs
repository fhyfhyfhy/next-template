const config = {
  // 从项目根以外的目录运行时，也从本项目解析插件。
  plugins: [import.meta.resolve("prettier-plugin-tailwindcss")],
  tailwindStylesheet: "./app/globals.css",
  tailwindFunctions: ["cva", "cn"],
};

export default config;
