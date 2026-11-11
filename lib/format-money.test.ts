import assert from "node:assert/strict";
import { test } from "node:test";
import { formatMoney } from "./format";

test("an explicit book currency is labeled, not converted into the other currency", () => {
  const zig = formatMoney(-14_071_690, "ZWG");
  assert.match(zig, /ZiG/);
  assert.doesNotMatch(zig, /USD/);
  assert.match(zig, /14,071,690/);

  const usd = formatMoney(-531_007.18, "USD");
  assert.match(usd, /USD/);
  assert.match(usd, /531,007\.18/);
  assert.doesNotMatch(usd, /ZiG/);
});
