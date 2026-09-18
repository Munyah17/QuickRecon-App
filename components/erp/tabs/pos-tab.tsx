"use client";

import * as React from "react";
import {
  MonitorSmartphone,
  ShoppingCart,
  DollarSign,
  TrendingDown,
  Banknote,
  Printer,
  RefreshCcw,
  LoaderCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatMoney } from "@/lib/format";
import { MetricCard } from "../shared";

interface PosTerminal {
  id: string;
  location: string;
  agent: string;
  transactions: number;
  revenue: number;
  status: string;
}

export default function POSTab() {
  const [connectOpen, setConnectOpen] = React.useState(false);
  const [receiptTerminal, setReceiptTerminal] = React.useState<PosTerminal | null>(null);
  const [remitTerminal, setRemitTerminal] = React.useState<PosTerminal | null>(null);
  const [gateway, setGateway] = React.useState("paynow");
  const [bankAccount, setBankAccount] = React.useState("CBZ ****4521 (Enpassent Ops)");

  const terminals: PosTerminal[] = [
    { id: "POS-001", location: "Harare CBD", agent: "Musa Zhou", transactions: 342, revenue: 68400, status: "online" },
    { id: "POS-002", location: "Bulawayo", agent: "Tendai Moyo", transactions: 218, revenue: 43600, status: "online" },
    { id: "POS-003", location: "Mutare", agent: "Rumbi Chiweshe", transactions: 156, revenue: 31200, status: "online" },
    { id: "POS-004", location: "Gweru", agent: "Nyanga Dube", transactions: 0, revenue: 0, status: "offline" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={MonitorSmartphone} label="Active Terminals" value="3/4" />
        <MetricCard icon={ShoppingCart} label="Today's Transactions" value="716" trend="9.2%" trendUp />
        <MetricCard icon={DollarSign} label="Today's Revenue" value={formatMoney(143200)} trend="14.7%" trendUp />
        <MetricCard icon={TrendingDown} label="Offline Terminals" value="1" />
      </div>

      {/* Payment gateway + company account — where remitted float lands */}
      <Card className="gap-0 py-0 shadow-xs">
        <CardHeader className="px-4 pt-4 sm:px-5">
          <CardTitle className="text-[14.5px] font-semibold">Payment Gateway</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Gateway provider</Label>
              <Select value={gateway} onValueChange={setGateway}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="paynow">Paynow (Zimbabwe)</SelectItem>
                  <SelectItem value="ecocash">EcoCash Merchant</SelectItem>
                  <SelectItem value="onemoney">OneMoney</SelectItem>
                  <SelectItem value="innbucks">InnBucks</SelectItem>
                  <SelectItem value="zimswitch">ZimSwitch</SelectItem>
                  <SelectItem value="stripe">Stripe (international)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Settlement account (float lands here)</Label>
              <Select value={bankAccount} onValueChange={setBankAccount}>
                <SelectTrigger className="h-9 bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CBZ ****4521 (Enpassent Ops)">CBZ ****4521 (Enpassent Ops)</SelectItem>
                  <SelectItem value="Stanbic ****8830 (Enpassent Float)">Stanbic ****8830 (Enpassent Float)</SelectItem>
                  <SelectItem value="CABS ****2217 (Enpassent Reserves)">CABS ****2217 (Enpassent Reserves)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Agents swipe on portable terminals to remit float — funds settle to this account via the selected gateway. Super Admin can change providers in Settings.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-[12px]"
              onClick={async () => {
                await fetch("/api/settings", {
                  method: "PUT",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ key: "pos_gateway", value: { provider: gateway, settlementAccount: bankAccount } }),
                });
                toast.success("Gateway saved", { description: `${gateway} → ${bankAccount}` });
              }}
            >
              Save gateway config
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13.5px] font-semibold">Connected Devices</p>
        <Button className="h-9 gap-1.5 text-[13px]" onClick={() => setConnectOpen(true)}>
          <MonitorSmartphone className="size-4" aria-hidden /> Connect POS Device
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {terminals.map((t) => (
          <Card key={t.id} className="gap-0 py-0 shadow-xs">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13.5px] font-semibold">{t.id} · {t.location}</p>
                  <p className="text-[12px] text-muted-foreground">Agent: {t.agent}</p>
                </div>
                <Badge variant="outline" className={t.status === "online" ? "border-transparent bg-success-soft text-success-foreground" : "border-transparent bg-muted text-muted-foreground"}>
                  {t.status}
                </Badge>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                <div>
                  <p className="text-muted-foreground">Transactions</p>
                  <p className="tnum text-[16px] font-bold">{t.transactions}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Revenue (ZiG)</p>
                  <p className="tnum text-[16px] font-bold">{t.revenue.toLocaleString()}</p>
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1 gap-1 text-[12px]"
                  disabled={t.status !== "online"}
                  onClick={() => setReceiptTerminal(t)}
                >
                  <Printer className="size-3.5" aria-hidden /> Receipt
                </Button>
                <Button
                  size="sm"
                  className="h-8 flex-1 gap-1 text-[12px]"
                  disabled={t.status !== "online"}
                  onClick={() => setRemitTerminal(t)}
                >
                  <Banknote className="size-3.5" aria-hidden /> Remit Float
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-[12px]"
                  onClick={() => toast.success(`${t.id} synced`, { description: "Latest transactions pulled from device." })}
                >
                  <RefreshCcw className="size-3.5" aria-hidden />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ConnectPOSDialog open={connectOpen} onOpenChange={setConnectOpen} gateway={gateway} settlement={bankAccount} />
      {receiptTerminal && (
        <ReceiptDialog terminal={receiptTerminal} onClose={() => setReceiptTerminal(null)} />
      )}
      {remitTerminal && (
        <RemitFloatDialog terminal={remitTerminal} gateway={gateway} settlement={bankAccount} onClose={() => setRemitTerminal(null)} />
      )}
    </div>
  );
}

/* POS device connection — portable terminal + gateway config */
function ConnectPOSDialog({
  open,
  onOpenChange,
  gateway,
  settlement,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  gateway: string;
  settlement: string;
}) {
  const [terminalId, setTerminalId] = React.useState("");
  const [connectionType, setConnectionType] = React.useState("network");
  const [deviceKind, setDeviceKind] = React.useState("android");
  const [printerModel, setPrinterModel] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [connecting, setConnecting] = React.useState(false);

  async function connect() {
    if (!terminalId.trim()) {
      toast.error("Terminal ID required");
      return;
    }
    setConnecting(true);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: "pos_devices",
          value: {
            id: terminalId.trim(), deviceKind, connectionType, printerModel,
            location, gateway, settlementAccount: settlement,
            pairedAt: new Date().toISOString(),
          },
        }),
      });
      toast.success(`Device ${terminalId} connected`, {
        description: `${connectionType} · ${deviceKind} terminal${printerModel ? ` · printer ${printerModel}` : ""}`,
      });
      onOpenChange(false);
      setTerminalId(""); setPrinterModel(""); setLocation("");
    } catch {
      toast.error("Pairing failed", { description: "Check the terminal ID and try again." });
    } finally {
      setConnecting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Connect POS Device</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Pair a portable POS terminal. Supports Android terminals, web-based POS apps and dedicated hardware.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3.5 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="pos-id">Terminal ID <span className="text-destructive">*</span></Label>
              <Input id="pos-id" placeholder="e.g. POS-005" value={terminalId} onChange={(e) => setTerminalId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-loc">Location</Label>
              <Input id="pos-loc" placeholder="e.g. Harare CBD" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Device type</Label>
              <Select value={deviceKind} onValueChange={setDeviceKind}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="android">Android terminal</SelectItem>
                  <SelectItem value="web">Web / browser POS</SelectItem>
                  <SelectItem value="hardware">Hardware terminal</SelectItem>
                  <SelectItem value="mobile">Mobile app</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Connection</Label>
              <Select value={connectionType} onValueChange={setConnectionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">Network / Wi-Fi</SelectItem>
                  <SelectItem value="bluetooth">Bluetooth</SelectItem>
                  <SelectItem value="usb">USB tethered</SelectItem>
                  <SelectItem value="4g">4G / LTE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pos-printer">Receipt printer (optional)</Label>
            <Input id="pos-printer" placeholder="e.g. Epson TM-T20III" value={printerModel} onChange={(e) => setPrinterModel(e.target.value)} />
          </div>
          <div className="rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
            Gateway: <strong className="text-foreground">{gateway}</strong> · Settles to {settlement}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={connecting}>Cancel</Button>
          <Button onClick={connect} disabled={connecting} className="gap-1.5">
            {connecting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <MonitorSmartphone className="size-4" aria-hidden />}
            {connecting ? "Pairing…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* Agent float remittance — swipe on terminal → funds to company account */
function RemitFloatDialog({
  terminal,
  gateway,
  settlement,
  onClose,
}: {
  terminal: PosTerminal;
  gateway: string;
  settlement: string;
  onClose: () => void;
}) {
  const [amount, setAmount] = React.useState("");
  const [processing, setProcessing] = React.useState(false);
  const [done, setDone] = React.useState(false);

  async function remit() {
    const v = parseFloat(amount);
    if (!v || v <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setProcessing(true);
    try {
      await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "float_remittance",
          title: `Float remittance — ${terminal.id}`,
          description: `${terminal.agent} remitted ${formatMoney(v)} via ${gateway} → ${settlement}`,
          amount: v,
        }),
      });
      setDone(true);
      toast.success("Remittance recorded", { description: `${formatMoney(v)} → ${settlement}` });
    } catch {
      toast.error("Remittance failed");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Remit Float — {terminal.id}</DialogTitle>
          <DialogDescription>
            Agent swipes on the terminal; funds settle to the company account via {gateway}.
          </DialogDescription>
        </DialogHeader>
        {!done ? (
          <div className="space-y-3.5 py-2">
            <div className="rounded-lg border p-3 text-[12.5px]">
              <p className="font-medium">{terminal.agent}</p>
              <p className="text-muted-foreground">{terminal.location}</p>
            </div>
            <div className="space-y-1.5">
              <Label>Amount to remit (ZiG)</Label>
              <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </div>
            <div className="rounded-lg bg-muted px-3 py-2 text-[11.5px] text-muted-foreground">
              Settles to: <strong className="text-foreground">{settlement}</strong>
            </div>
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-[15px] font-semibold text-success">Remittance recorded</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{formatMoney(parseFloat(amount) || 0)} → {settlement}</p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{done ? "Close" : "Cancel"}</Button>
          {!done && (
            <Button onClick={remit} disabled={processing}>
              {processing ? "Processing…" : "Remit now"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReceiptDialog({
  terminal,
  onClose,
}: {
  terminal: PosTerminal;
  onClose: () => void;
}) {
  const receiptRef = React.useRef<HTMLDivElement>(null);

  function print() {
    const html = receiptRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=380,height=600");
    if (!win) return;
    win.document.write(`
      <html><head><title>Receipt ${terminal.id}</title>
      <style>
        body{font-family:ui-monospace,monospace;font-size:12px;padding:16px;width:280px;margin:0 auto;color:#000}
        .center{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
        table{width:100%;border-collapse:collapse}td{padding:2px 0}
        .r{text-align:right}.bold{font-weight:700}
      </style></head><body>${html}<script>window.print();window.onafterprint=()=>window.close();<\/script></body></html>`);
    win.document.close();
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[360px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Terminal Receipt — {terminal.id}</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Preview and print the daily summary receipt for {terminal.location}.
          </DialogDescription>
        </DialogHeader>
        <div ref={receiptRef} className="rounded-lg border bg-card p-4 font-mono text-[12px]">
          <div className="center bold" style={{ textAlign: "center", fontWeight: 700 }}>QuickRecon App</div>
          <div className="center" style={{ textAlign: "center" }}>POS Terminal Summary</div>
          <div className="center" style={{ textAlign: "center" }}>{new Date().toLocaleString()}</div>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%" }}>
            <tbody>
              <tr><td>Terminal</td><td className="r" style={{ textAlign: "right" }}>{terminal.id}</td></tr>
              <tr><td>Location</td><td className="r" style={{ textAlign: "right" }}>{terminal.location}</td></tr>
              <tr><td>Agent</td><td className="r" style={{ textAlign: "right" }}>{terminal.agent}</td></tr>
            </tbody>
          </table>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <table style={{ width: "100%" }}>
            <tbody>
              <tr><td>Transactions</td><td className="r" style={{ textAlign: "right" }}>{terminal.transactions}</td></tr>
              <tr className="bold"><td>Revenue (ZiG)</td><td className="r" style={{ textAlign: "right", fontWeight: 700 }}>{terminal.revenue.toLocaleString()}</td></tr>
            </tbody>
          </table>
          <div className="line" style={{ borderTop: "1px dashed #999", margin: "8px 0" }} />
          <div className="center" style={{ textAlign: "center" }}>Thank you</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button className="gap-1.5" onClick={print}>
            <Printer className="size-4" aria-hidden /> Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
