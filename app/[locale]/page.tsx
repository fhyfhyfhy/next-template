import { getLocale } from "next-intl/server";

import { redirect } from "@/lib/i18n-navigation";

export default async function Home() {
  redirect({ href: "/demos", locale: await getLocale() });
}
