"use client";

import { useState } from "react";

import { formatExampleSource } from "../utils/example-source";

/**
 * 把一个控件绑定到 `config[key]`：返回值展开传给 `OptionControl`、`TextControl` 或
 * `ToggleControl`。不传 `label` 时控件以 key 为标签，`onChange` 只在最新的 config 上
 * 改这一个 key。
 */
export type PlaygroundField<Config> = <Key extends keyof Config & string>(
  key: Key,
  label?: string,
) => {
  label: string;
  value: Config[Key];
  onChange: (value: Config[Key]) => void;
};

/** `Config` 里值为 number 的 key。 */
type NumberKey<Config> = {
  [Key in keyof Config]: Config[Key] extends number ? Key : never;
}[keyof Config] &
  string;

/**
 * 把一个以文字提供数字选项的控件（如选项为 `"0"`、`"25"` 的 `OptionControl`）绑定到
 * number 类型的 `config[key]`：数字显示成文字，选中后写回文字对应的数字。标签规则同
 * `PlaygroundField`。
 */
export type PlaygroundNumberField<Config> = <Key extends NumberKey<Config>>(
  key: Key,
  label?: string,
) => {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

/**
 * 一个 preview 的可调预览状态：`config`，把控件绑定到它的 `field` 和 `numberField`，
 * 以及 `playground` 里让 `Playground` 与它保持一致的 `source` 和 `onReset`：源码显示
 * 当前 config，重置把它恢复为 `initialConfig`。把 `playground` 展开传给
 * `Playground`，画布、源码和重置就都跟随同一份 config。
 */
export function usePlaygroundConfig<Config extends object>(
  initialConfig: Config,
  source: string,
) {
  const [config, setConfig] = useState(initialConfig);
  const field: PlaygroundField<Config> = (key, label = key) => ({
    label,
    value: config[key],
    onChange: (value) => setConfig((current) => ({ ...current, [key]: value })),
  });
  const numberField: PlaygroundNumberField<Config> = (key, label = key) => ({
    label,
    value: String(config[key]),
    onChange: (value) =>
      setConfig((current) => ({ ...current, [key]: Number(value) })),
  });
  return {
    config,
    setConfig,
    field,
    numberField,
    playground: {
      source: formatExampleSource(source, config),
      onReset: () => setConfig(initialConfig),
    },
  };
}
