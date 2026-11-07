import { redirect } from "next/navigation";

import { TASK_LIST_HREF } from "@/features/task";

export default function Home() {
  redirect(TASK_LIST_HREF);
}
