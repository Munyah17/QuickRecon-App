"use client";

import {
  ShoppingCart,
  DollarSign,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { ExportButton } from "@/components/shared/export-button";
import { MetricCard } from "../shared";

export default function SalesTab() {
  const salesData = [
    { region: "Harare", agent: "Musa Zhou", policies: 142, revenue: 284000, growth: "+15%" },
    { region: "Bulawayo", agent: "Tendai Moyo", policies: 98, revenue: 196000, growth: "+8%" },
    { region: "Mutare", agent: "Rumbi Chiweshe", policies: 76, revenue: 152000, growth: "+22%" },
    { region: "Gweru", agent: "Nyanga Dube", policies: 54, revenue: 108000, growth: "-3%" },
    { region: "Masvingo", agent: "Farai Mlambo", policies: 41, revenue: 82000, growth: "+11%" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={ShoppingCart} label="Total Policies Sold" value="411" trend="12.8%" trendUp />
        <MetricCard icon={DollarSign} label="Total Sales Revenue" value={formatMoney(822000)} trend="18.4%" trendUp />
        <MetricCard icon={TrendingUp} label="Avg Policy Value" value={formatMoney(2000)} />
        <MetricCard icon={Users} label="Active Sales Agents" value="5" />
      </div>

      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Sales by Region</CardTitle>
          <CardAction>
            <ExportButton
              filename="sales-export"
              rows={salesData.length}
              label="Export"
              title="QuickRecon — Sales by Region"
              data={{
                columns: ["Region", "Lead Agent", "Policies", "Revenue (ZiG)", "Growth"],
                rows: salesData.map((s) => [s.region, s.agent, s.policies, s.revenue, s.growth]),
              }}
            />
          </CardAction>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b bg-muted/50 text-left text-[11.5px] font-semibold text-muted-foreground uppercase">
                  <th className="px-3 py-2.5">Region</th>
                  <th className="px-3 py-2.5">Lead Agent</th>
                  <th className="px-3 py-2.5 text-right">Policies</th>
                  <th className="px-3 py-2.5 text-right">Revenue (ZiG)</th>
                  <th className="px-3 py-2.5 text-right">Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {salesData.map((s) => (
                  <tr key={s.region} className="hover:bg-surface-hover">
                    <td className="px-3 py-2.5 font-medium">{s.region}</td>
                    <td className="px-3 py-2.5">{s.agent}</td>
                    <td className="tnum px-3 py-2.5 text-right">{s.policies}</td>
                    <td className="tnum px-3 py-2.5 text-right font-medium">{s.revenue.toLocaleString()}</td>
                    <td className={`tnum px-3 py-2.5 text-right ${s.growth.startsWith("+") ? "text-success" : "text-destructive"}`}>{s.growth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
