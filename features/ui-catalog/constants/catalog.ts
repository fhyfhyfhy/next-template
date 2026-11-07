import { catalog } from "./catalog.generated";

export { catalog };

export type ComponentId = (typeof catalog)[number]["id"];
