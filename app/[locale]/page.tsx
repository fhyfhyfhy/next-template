import { redirect } from "next/navigation";

/** 首页就是全部任务。 */
export default function Home() {
  redirect("/tasks");
}
