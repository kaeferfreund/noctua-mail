import { describe, expect, it } from "bun:test";
import { assertPublicUrl, isPublicIp, type LookupFn } from "./urlSafety";

describe("isPublicIp — IPv4", () => {
  it("rejects unspecified 0.0.0.0 and the 0.0.0.0/8 range", () => {
    expect(isPublicIp("0.0.0.0")).toBe(false);
    expect(isPublicIp("0.1.2.3")).toBe(false);
  });

  it("rejects loopback 127.0.0.0/8", () => {
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("127.255.255.254")).toBe(false);
  });

  it("rejects RFC 1918 private ranges", () => {
    expect(isPublicIp("10.0.0.1")).toBe(false);
    expect(isPublicIp("10.255.255.255")).toBe(false);
    expect(isPublicIp("172.16.0.1")).toBe(false);
    expect(isPublicIp("172.31.255.255")).toBe(false);
    expect(isPublicIp("192.168.0.1")).toBe(false);
    expect(isPublicIp("192.168.255.255")).toBe(false);
  });

  it("accepts addresses just outside 172.16.0.0/12", () => {
    expect(isPublicIp("172.15.255.255")).toBe(true);
    expect(isPublicIp("172.32.0.0")).toBe(true);
  });

  it("rejects link-local 169.254.0.0/16", () => {
    expect(isPublicIp("169.254.0.1")).toBe(false);
    expect(isPublicIp("169.254.169.254")).toBe(false); // cloud metadata
    expect(isPublicIp("169.254.255.255")).toBe(false);
  });

  it("accepts 169.253.x and 169.255.x which are outside link-local", () => {
    expect(isPublicIp("169.253.0.1")).toBe(true);
    expect(isPublicIp("169.255.0.1")).toBe(true);
  });

  it("rejects multicast 224.0.0.0/4", () => {
    expect(isPublicIp("224.0.0.1")).toBe(false);
    expect(isPublicIp("239.255.255.255")).toBe(false);
  });

  it("accepts legitimate public IPv4 addresses", () => {
    expect(isPublicIp("8.8.8.8")).toBe(true);
    expect(isPublicIp("1.1.1.1")).toBe(true);
    expect(isPublicIp("93.184.216.34")).toBe(true); // example.com
  });

  it("rejects malformed IPv4 strings", () => {
    expect(isPublicIp("999.0.0.0")).toBe(false);
    expect(isPublicIp("1.2.3")).toBe(false);
    expect(isPublicIp("not-an-ip")).toBe(false);
    expect(isPublicIp("")).toBe(false);
  });
});

describe("isPublicIp — IPv6", () => {
  it("rejects unspecified :: and loopback ::1", () => {
    expect(isPublicIp("::")).toBe(false);
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("0:0:0:0:0:0:0:1")).toBe(false);
  });

  it("rejects link-local fe80::/10", () => {
    expect(isPublicIp("fe80::1")).toBe(false);
    expect(isPublicIp("febf::1")).toBe(false);
  });

  it("rejects unique local fc00::/7 (fc/fd)", () => {
    expect(isPublicIp("fc00::1")).toBe(false);
    expect(isPublicIp("fd12:3456:789a::1")).toBe(false);
  });

  it("rejects multicast ff00::/8", () => {
    expect(isPublicIp("ff02::1")).toBe(false);
    expect(isPublicIp("ffff::")).toBe(false);
  });

  it("rejects IPv4-mapped IPv6 pointing at private IPv4", () => {
    expect(isPublicIp("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIp("::ffff:169.254.169.254")).toBe(false);
    expect(isPublicIp("::ffff:10.0.0.1")).toBe(false);
  });

  it("accepts IPv4-mapped IPv6 pointing at public IPv4", () => {
    expect(isPublicIp("::ffff:8.8.8.8")).toBe(true);
  });

  it("accepts global unicast IPv6 addresses", () => {
    expect(isPublicIp("2001:4860:4860::8888")).toBe(true); // Google DNS
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true); // Cloudflare DNS
  });

  it("rejects malformed IPv6 strings", () => {
    expect(isPublicIp("2001::1::1")).toBe(false);
    expect(isPublicIp("xyz::1")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called in this test");
  };

  it("rejects invalid URLs", async () => {
    const res = await assertPublicUrl("not a url", { lookup: denyLookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("invalid-url");
  });

  it("rejects non-https protocols", async () => {
    for (const url of [
      "http://example.com/",
      "ftp://example.com/",
      "file:///etc/passwd",
      "gopher://example.com/",
      "javascript:alert(1)"
    ]) {
      const res = await assertPublicUrl(url, { lookup: denyLookup });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("unsupported-protocol");
    }
  });

  it("rejects literal loopback IPv4 without DNS", async () => {
    const res = await assertPublicUrl("https://127.0.0.1/path", { lookup: denyLookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("rejects literal cloud metadata IP without DNS", async () => {
    const res = await assertPublicUrl("https://169.254.169.254/latest/meta-data/", {
      lookup: denyLookup
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("rejects literal IPv6 loopback in bracket form", async () => {
    const res = await assertPublicUrl("https://[::1]/", { lookup: denyLookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("rejects IPv6 link-local fe80::1", async () => {
    const res = await assertPublicUrl("https://[fe80::1]/", { lookup: denyLookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("accepts literal public IPv4 without DNS", async () => {
    const res = await assertPublicUrl("https://8.8.8.8/", { lookup: denyLookup });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.resolved).toEqual(["8.8.8.8"]);
  });

  it("rejects hostnames that resolve to a private address", async () => {
    const lookup: LookupFn = async () => [{ address: "10.0.0.5", family: 4 }];
    const res = await assertPublicUrl("https://internal.example.test/", { lookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("rejects hostnames where any resolved record is private (DNS rebinding-style)", async () => {
    const lookup: LookupFn = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 }
    ];
    const res = await assertPublicUrl("https://mixed.example.test/", { lookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("accepts hostnames that resolve only to public addresses", async () => {
    const lookup: LookupFn = async () => [
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 }
    ];
    const res = await assertPublicUrl("https://example.com/path", { lookup });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.resolved).toContain("93.184.216.34");
      expect(res.url.hostname).toBe("example.com");
    }
  });

  it("reports dns-lookup-failed when resolution throws", async () => {
    const lookup: LookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    const res = await assertPublicUrl("https://nonexistent.example.invalid/", { lookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("dns-lookup-failed");
  });

  it("reports no-dns-records when resolution returns empty", async () => {
    const lookup: LookupFn = async () => [];
    const res = await assertPublicUrl("https://empty.example.test/", { lookup });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("no-dns-records");
  });
});

describe("assertPublicUrl — protocols option", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called in this test");
  };

  it("accepts http:// when protocols allows it (e.g. self-hosted CalDAV)", async () => {
    const lookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
    const res = await assertPublicUrl("http://caldav.example.com/", {
      lookup,
      protocols: ["http:", "https:"]
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.protocol).toBe("http:");
  });

  it("accepts https:// when protocols allows both schemes", async () => {
    const lookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }];
    const res = await assertPublicUrl("https://caldav.example.com/", {
      lookup,
      protocols: ["http:", "https:"]
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.url.protocol).toBe("https:");
  });

  it("still rejects private-IP even when protocols allows http://", async () => {
    const res = await assertPublicUrl("http://127.0.0.1/", {
      lookup: denyLookup,
      protocols: ["http:", "https:"]
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("private-ip");
  });

  it("rejects http:// when only https: is in the allowed list", async () => {
    const res = await assertPublicUrl("http://example.com/", {
      lookup: denyLookup,
      protocols: ["https:"]
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("unsupported-protocol");
  });

  it("still rejects ftp/file/javascript even when http+https are allowed", async () => {
    for (const url of ["ftp://example.com/", "file:///etc/passwd", "javascript:alert(1)"]) {
      const res = await assertPublicUrl(url, {
        lookup: denyLookup,
        protocols: ["http:", "https:"]
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.reason).toBe("unsupported-protocol");
    }
  });
});

describe("isPublicIp — complete special-purpose table (CF-08, A41)", () => {
  const nonPublicV4 = [
    "0.0.0.0", "0.255.255.255", // this network
    "100.64.0.0", "100.100.100.100", "100.127.255.255", // shared address space / tailnets
    "192.0.0.1", "192.0.0.255", // IETF protocol assignments
    "192.0.2.1", "198.51.100.7", "203.0.113.9", // documentation
    "192.88.99.1", // 6to4 relay anycast
    "198.18.0.1", "198.19.255.255", // benchmarking
    "224.0.0.1", "239.255.255.255", // multicast
    "240.0.0.1", "250.1.2.3", "255.255.255.255" // reserved + broadcast
  ];
  const publicV4 = ["100.63.255.255", "100.128.0.0", "192.0.1.255", "192.0.3.0", "198.17.255.255", "198.20.0.0", "223.255.255.255", "203.0.114.1"];

  for (const addr of nonPublicV4) it(`rejects ${addr}`, () => expect(isPublicIp(addr)).toBe(false));
  for (const addr of publicV4) it(`accepts ${addr}`, () => expect(isPublicIp(addr)).toBe(true));

  const nonPublicV6 = [
    "::ffff:7f00:1", "::ffff:7f00:0001", "0:0:0:0:0:ffff:7f00:1", "::FFFF:7F00:1", // hex mapped loopback
    "::ffff:a9fe:a9fe", // mapped metadata address
    "::ffff:a00:1", "::ffff:6464:6464", // mapped 10.0.0.1, 100.100.100.100
    "::ffff:0:0", // mapped 0.0.0.0
    "::7f00:1", "::127.0.0.1", "::8.8.8.8", // IPv4-compatible (deprecated)
    "64:ff9b::7f00:1", "64:ff9b::8.8.8.8", "64:ff9b:1::1", // NAT64
    "2002:7f00:1::", "2002:0808:0808::1", // 6to4
    "2001::1", "2001:0:4136:e378:8000:63bf:3fff:fdd2", // Teredo
    "2001:2::1", "2001:10::1", "2001:20::1", // benchmarking, ORCHID
    "2001:db8::1", "3fff::1", "3fff:fff::1", // documentation
    "100::1", // discard
    "fec0::1", "feff::1", // site-local (deprecated)
    "fe80::1%eth0", // zone id
    "5f00::1", "4000::1", "1fff::1" // outside 2000::/3
  ];
  for (const addr of nonPublicV6) it(`rejects ${addr}`, () => expect(isPublicIp(addr)).toBe(false));

  const publicV6 = ["2001:4860:4860::8888", "2606:4700:4700::1111", "2a00:1450::1", "::ffff:808:808", "::ffff:8.8.8.8", "2001:200::1", "3ffe::1", "3fff:1000::1"];
  for (const addr of publicV6) it(`accepts ${addr}`, () => expect(isPublicIp(addr)).toBe(true));

  it("rejects non-canonical IPv4 forms that are not IP literals", () => {
    for (const addr of ["127.1", "0x7f.0.0.1", "2130706433", "010.0.0.1", "1.2.3.4.5"]) expect(isPublicIp(addr)).toBe(false);
  });
});

describe("assertPublicUrl — URL-normalized hosts (CF-08, A41, S21)", () => {
  const denyLookup: LookupFn = async () => {
    throw new Error("DNS should not be called for IP literals");
  };
  const literalUrls = [
    "https://[::ffff:127.0.0.1]:8443/", // the URL parser turns this into [::ffff:7f00:1]
    "https://[::ffff:169.254.169.254]/",
    "https://[::ffff:a9fe:a9fe]/",
    "https://[64:ff9b::7f00:1]/",
    "https://[2002:7f00:1::]/",
    "https://[2001::1]/",
    "https://[fec0::1]/",
    "https://100.100.100.100/",
    "https://127.1/", // parsed to 127.0.0.1
    "https://0x7f000001/",
    "https://2130706433/",
    "https://0177.0.0.1/",
    "https://198.18.0.1/",
    "https://255.255.255.255/"
  ];
  for (const url of literalUrls) {
    it(`rejects ${url}`, async () => {
      const res = await assertPublicUrl(url, { lookup: denyLookup });
      expect(res).toEqual({ ok: false, reason: "private-ip" });
    });
  }

  it("rejects hostnames that resolve to mapped, CGNAT or NAT64 addresses", async () => {
    for (const address of ["::ffff:7f00:1", "100.64.0.1", "64:ff9b::a00:1", "2001:db8::5"]) {
      const lookup: LookupFn = async () => [{ address, family: address.includes(":") ? 6 : 4 }];
      expect(await assertPublicUrl("https://rebind.example.test/", { lookup })).toEqual({ ok: false, reason: "private-ip" });
    }
  });

  it("returns the checked addresses with their family", async () => {
    const lookup: LookupFn = async () => [{ address: "93.184.216.34", family: 4 }, { address: "2606:2800:220:1::1", family: 6 }];
    const res = await assertPublicUrl("https://example.com/", { lookup });
    expect(res.ok && res.addresses).toEqual([{ address: "93.184.216.34", family: 4 }, { address: "2606:2800:220:1::1", family: 6 }]);
  });
});
