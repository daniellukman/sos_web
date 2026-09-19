import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/auth";
import { getContext } from "@/lib/context";
import PasswordForm from "./password-form";

export const metadata: Metadata = { title: "Change Password" };

export default async function GantiPasswordPage() {
  const { session } = await getContext();
  return (
    <div className="mx-auto max-w-md">
      <PageHeader title="Change Password" description={`User ${session.userid}. Password dipakai untuk web dan aplikasi desktop.`} />
      <PasswordForm min={PASSWORD_MIN} />
    </div>
  );
}
