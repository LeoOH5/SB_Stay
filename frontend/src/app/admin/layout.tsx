import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-white">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-6 pb-16 pt-8 lg:px-12 lg:pt-9">{children}</main>
    </div>
  );
}
