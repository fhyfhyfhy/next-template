import type { ComponentType } from "react";

export interface ExampleMetadata {
  title: string;
  description: string;
  order?: number;
}

export interface ComponentMetadata extends ExampleMetadata {
  icon: `Icon${string}`;
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
