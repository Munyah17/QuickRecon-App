"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function TabLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
    </div>
  );
}

const AccountingTab = dynamic(() => import("./tabs/accounting-tab"), { loading: TabLoading });
const HRTab = dynamic(() => import("./tabs/hr-tab"), { loading: TabLoading });
const SalesTab = dynamic(() => import("./tabs/sales-tab"), { loading: TabLoading });
const POSTab = dynamic(() => import("./tabs/pos-tab"), { loading: TabLoading });
const InvoicesTab = dynamic(() => import("./tabs/invoices-tab"), { loading: TabLoading });

export function ERPDashboard() {
  return (
    <Tabs defaultValue="accounting">
      <TabsList variant="line" className="w-full justify-start gap-5 overflow-x-auto rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="accounting" className="rounded-none px-1 pb-2.5 text-[13px]">Accounting</TabsTrigger>
        <TabsTrigger value="hr" className="rounded-none px-1 pb-2.5 text-[13px]">HR</TabsTrigger>
        <TabsTrigger value="sales" className="rounded-none px-1 pb-2.5 text-[13px]">Sales</TabsTrigger>
        <TabsTrigger value="pos" className="rounded-none px-1 pb-2.5 text-[13px]">POS</TabsTrigger>
        <TabsTrigger value="invoices" className="rounded-none px-1 pb-2.5 text-[13px]">Invoices</TabsTrigger>
      </TabsList>

      <TabsContent value="accounting" className="mt-4">
        <AccountingTab />
      </TabsContent>
      <TabsContent value="hr" className="mt-4">
        <HRTab />
      </TabsContent>
      <TabsContent value="sales" className="mt-4">
        <SalesTab />
      </TabsContent>
      <TabsContent value="pos" className="mt-4">
        <POSTab />
      </TabsContent>
      <TabsContent value="invoices" className="mt-4">
        <InvoicesTab />
      </TabsContent>
    </Tabs>
  );
}
