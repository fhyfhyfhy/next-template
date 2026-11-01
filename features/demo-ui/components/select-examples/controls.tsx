"use client";

import type { Dispatch, SetStateAction } from "react";

import { OptionControl, TextControl, ToggleControl } from "../controls";
import type { SelectConfig } from "./playground";

/**
 * Presents the select's content, state and positioning props as adjustable
 * controls.
 */
export function SelectControls({
  config,
  onChange,
}: {
  config: SelectConfig;
  onChange: Dispatch<SetStateAction<SelectConfig>>;
}) {
  return (
    <>
      <OptionControl
        label="size"
        value={config.size}
        options={["sm", "md", "lg"]}
        onChange={(size) => onChange({ ...config, size })}
      />
      <TextControl
        label="label"
        value={config.label}
        onChange={(label) => onChange({ ...config, label })}
      />
      <TextControl
        label="placeholder"
        value={config.placeholder}
        onChange={(placeholder) => onChange({ ...config, placeholder })}
      />
      <TextControl
        label="firstOption"
        value={config.firstOption}
        onChange={(firstOption) => onChange({ ...config, firstOption })}
      />
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
      <ToggleControl
        label="disabled"
        value={config.disabled}
        onChange={(disabled) => onChange({ ...config, disabled })}
      />
      <ToggleControl
        label="readOnly"
        value={config.readOnly}
        onChange={(readOnly) => onChange({ ...config, readOnly })}
      />
      <ToggleControl
        label="required"
        value={config.required}
        onChange={(required) => onChange({ ...config, required })}
      />
      <ToggleControl
        label="open"
        value={config.open}
        onChange={(open) => onChange({ ...config, open })}
      />
      <ToggleControl
        label="modal"
        value={config.modal}
        onChange={(modal) => onChange({ ...config, modal })}
      />
      <ToggleControl
        label="disableLastOption"
        value={config.disableLastOption}
        onChange={(disableLastOption) =>
          onChange({ ...config, disableLastOption })
        }
      />
      <OptionControl
        label="Positioner.side"
        value={config.side}
        options={["top", "bottom", "left", "right"]}
        onChange={(side) => onChange({ ...config, side })}
      />
      <OptionControl
        label="Positioner.align"
        value={config.align}
        options={["start", "center", "end"]}
        onChange={(align) => onChange({ ...config, align })}
      />
      <OptionControl
        label="Positioner.sideOffset"
        value={String(config.sideOffset)}
        options={["0", "6", "12", "24"]}
        onChange={(sideOffset) =>
          onChange({ ...config, sideOffset: Number(sideOffset) })
        }
      />
      <ToggleControl
        label="alignItemWithTrigger"
        value={config.alignItemWithTrigger}
        onChange={(alignItemWithTrigger) =>
          onChange({ ...config, alignItemWithTrigger })
        }
      />
    </>
  );
}
