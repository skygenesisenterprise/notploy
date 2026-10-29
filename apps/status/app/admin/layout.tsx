import type { Metadata } from "next";
import type * as React from "react";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
	title: "Administration",
	robots: { index: false, follow: false },
};

export default function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return <AdminShell>{children}</AdminShell>;
}
