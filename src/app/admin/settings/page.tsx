"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStaff } from "@/lib/client/hooks";

export default function SettingsIndex() {
  const router = useRouter();
  const me = useStaff();
  useEffect(() => {
    if (me) router.replace(me.roles.includes("admin") ? "/admin/settings/company" : "/admin/settings/team");
  }, [me, router]);
  return null;
}
