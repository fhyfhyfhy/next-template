import {
  createLoader,
  createSerializer,
  parseAsStringLiteral,
} from "nuqs/server";

import { catalog } from "../constants/catalog";

/** 当前展示的组件；不认识的值回到目录中的第一个组件。 */
export const uiDemoSearchParams = {
  component: parseAsStringLiteral(catalog.map((item) => item.id)).withDefault(
    catalog[0].id,
  ),
};

export const loadUiDemoSearchParams = createLoader(uiDemoSearchParams);

export const serializeUiDemoSearchParams = createSerializer(uiDemoSearchParams);
