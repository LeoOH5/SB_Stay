import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-none flex-col bg-white xl:flex-row">
      <AdminSidebar />
      <main className="min-w-0 flex-1 px-5 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-8 xl:px-12 xl:pt-9">{children}</main>
    </div>
  );
}
