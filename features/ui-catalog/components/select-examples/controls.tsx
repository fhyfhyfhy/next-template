"use client";

import type { Dispatch, SetStateAction } from "react";

import type {
  PlaygroundField,
  PlaygroundNumberField,
} from "../../hooks/use-playground-config";
import { OptionControl, TextControl, ToggleControl } from "../controls";
import type { SelectConfig } from "./playground";

/** 将选择器的内容、状态和定位参数呈现为可调控件。 */
export function SelectControls({
  config,
  field,
  numberField,
  onChange,
}: {
  config: SelectConfig;
  field: PlaygroundField<SelectConfig>;
  numberField: PlaygroundNumberField<SelectConfig>;
  onChange: Dispatch<SetStateAction<SelectConfig>>;
}) {
  return (
    <>
      <OptionControl {...field("size")} options={["sm", "md", "lg"]} />
      <TextControl {...field("label")} />
      <TextControl {...field("placeholder")} />
      <TextControl {...field("firstOption")} />
      <OptionControl
        label="value"
        value={config.values[0] ?? "none"}
        options={["none", "design", "engineering", "product"]}
        onChange={(value) =>
          onChange({
            ...config,
            values: value === "none" ? [] : [value],
          })
        }
      />
      <ToggleControl
        label="multiple"
        value={config.multiple}
        onChange={(multiple) =>
          onChange({
            ...config,
            multiple,
            values: multiple ? config.values : config.values.slice(0, 1),
          })
        }
      />
      {config.multiple &&
        ["design", "engineering", "product"].map((value) => (
          <ToggleControl
            key={value}
            label={`selected: ${value}`}
            value={config.values.includes(value)}
            onChange={(checked) =>
              onChange({
                ...config,
                values: checked
                  ? [...config.values, value]
                  : config.values.filter((item) => item !== value),
              })
            }
          />
        ))}
      <ToggleControl {...field("disabled")} />
      <ToggleControl {...field("readOnly")} />
      <ToggleControl {...field("required")} />
      <ToggleControl {...field("open")} />
      <ToggleControl {...field("modal")} />
      <ToggleControl {...field("disableLastOption")} />
      <OptionControl
        {...field("side", "Positioner.side")}
        options={["top", "bottom", "left", "right"]}
      />
      <OptionControl
        {...field("align", "Positioner.align")}
        options={["start", "center", "end"]}
      />
      <OptionControl
        {...numberField("sideOffset", "Positioner.sideOffset")}
        options={["0", "6", "12", "24"]}
      />
      <ToggleControl {...field("alignItemWithTrigger")} />
    </>
  );
}
