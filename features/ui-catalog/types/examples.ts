import type { ComponentType } from "react";

export interface ExampleMetadata {
  title: string;
  description: string;
  order?: number;
}

/** 组件的描述跟着界面语言，在 messages 的 `ui-catalog.components.<component-id>.description`。 */
export interface ComponentMetadata {
  title: string;
  icon: `Icon${string}`;
  order?: number;
}

export interface ExampleDefinition extends ExampleMetadata {
  id: string;
  filename: string;
  component: ComponentType;
}

export interface ExampleSources {
  playground: string;
  examples: Record<string, string>;
}
