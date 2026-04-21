import { describe, expect, it, vi } from "vitest";
import type {
  PaperclipPluginManifestV1,
  PluginCompanySettingsJson,
} from "@paperclipai/shared";
import { pluginStateStore } from "../services/plugin-state-store.js";
import {
  pluginCapabilityValidator,
  resolveEffectiveCapabilities,
} from "../services/plugin-capability-validator.js";

const baseManifest: PaperclipPluginManifestV1 = {
  id: "acme.plugin",
  apiVersion: 1,
  version: "1.0.0",
  displayName: "Acme Plugin",
  description: "Test plugin",
  author: "Acme",
  categories: ["automation"],
  capabilities: ["plugin.state.read", "plugin.state.write", "issues.read", "issues.update"],
  entrypoints: { worker: "worker.js" },
};

describe("plugin memory policy enforcement", () => {
  it("allows normal company scope writes with no restrictive policy", async () => {
    const insertValues: unknown[] = [];
    const store = pluginStateStore(
      {
        select: () => ({
          from: (table: unknown) => ({
            where: async () => table === "plugins-sentinel" ? [] : [{ id: "plugin-1" }],
          }),
        }),
        insert: () => ({
          values: (value: unknown) => {
            insertValues.push(value);
            return {
              onConflictDoUpdate: async () => undefined,
            };
          },
        }),
      } as any,
      {
        resolveCompanySettings: async () => undefined,
      },
    );

    await expect(store.set("plugin-1", {
      scopeKind: "company",
      scopeId: "company-1",
      stateKey: "summary",
      value: { ok: true },
    })).resolves.toBeUndefined();

    expect(insertValues).toHaveLength(1);
  });

  it("rejects denied scope writes", async () => {
    const store = pluginStateStore(
      {
        select: () => ({
          from: (_table: unknown) => ({
            where: async () => [{ id: "plugin-1" }],
          }),
        }),
        insert: () => ({
          values: () => ({
            onConflictDoUpdate: async () => undefined,
          }),
        }),
      } as any,
      {
        resolveCompanySettings: async () => ({
          memoryPolicy: {
            denyScopes: ["agent"],
          },
        }),
      },
    );

    await expect(store.set("plugin-1", {
      companyId: "company-1",
      scopeKind: "agent",
      scopeId: "agent-1",
      stateKey: "secret",
      value: "x",
    } as any)).rejects.toThrow(/agent/);
  });

  it("rejects broad list operations when policy forbids that scope", async () => {
    const store = pluginStateStore(
      {
        select: () => ({
          from: (_table: unknown) => ({
            where: async () => [],
          }),
        }),
      } as any,
      {
        resolveCompanySettings: async () => ({
          memoryPolicy: {
            denyScopes: ["agent"],
          },
        }),
      },
    );

    await expect(store.list("plugin-1", {
      companyId: "company-1",
      scopeKind: "agent",
    } as any)).rejects.toThrow(/agent/);
  });

  it("rejects reserved namespaces for shared scopes unless explicitly allowed by policy", async () => {
    const store = pluginStateStore(
      {
        select: () => ({
          from: (_table: unknown) => ({
            where: async () => [{ id: "plugin-1" }],
          }),
        }),
        insert: () => ({
          values: () => ({ onConflictDoUpdate: async () => undefined }),
        }),
      } as any,
      {
        resolveCompanySettings: async () => ({}) satisfies PluginCompanySettingsJson,
      },
    );

    await expect(store.set("plugin-1", {
      companyId: "company-1",
      scopeKind: "company",
      scopeId: "company-1",
      namespace: "paperclip.memory",
      stateKey: "secret",
      value: true,
    } as any)).rejects.toThrow(/reserved namespace/i);
  });
});

describe("plugin capability inheritance", () => {
  it("returns raw manifest capabilities when no policy exists", () => {
    expect(resolveEffectiveCapabilities(baseManifest)).toEqual(baseManifest.capabilities);
  });

  it("returns intersection when policy grants subset exists", () => {
    expect(resolveEffectiveCapabilities(baseManifest, {
      grants: {
        "issues.read": true,
        "issues.update": false,
        "plugin.state.read": true,
      },
    })).toEqual(["plugin.state.read", "issues.read"]);
  });

  it("validator checks operations against effective capabilities", () => {
    const validator = pluginCapabilityValidator();
    const effectiveManifest = {
      ...baseManifest,
      capabilities: resolveEffectiveCapabilities(baseManifest, {
        grants: { "issues.read": true },
      }),
    };

    expect(validator.checkOperation(effectiveManifest, "issues.get")).toMatchObject({ allowed: true });
    expect(validator.checkOperation(effectiveManifest, "issues.update")).toMatchObject({ allowed: false });
  });

  it("passes effective capabilities to host handler creation wiring", async () => {
    const createHostClientHandlers = vi.fn();
    const buildHostServices = vi.fn(() => ({ dispose: vi.fn() }));
    const workerManager = { getWorker: vi.fn(() => null) };
    const hostServicesDisposers = new Map<string, () => void>();
    const manifest = baseManifest;
    const policy: PluginCompanySettingsJson = {
      capabilityPolicy: {
        grants: {
          "issues.read": true,
          "issues.update": false,
        },
      },
    };

    const notifyWorker = (method: string, params: unknown) => {
      const handle = workerManager.getWorker("plugin-1");
      if (handle) handle.notify(method, params);
    };
    const services = buildHostServices({}, "plugin-1", manifest.id, {}, notifyWorker);
    hostServicesDisposers.set("plugin-1", () => services.dispose());
    createHostClientHandlers({
      pluginId: "plugin-1",
      capabilities: resolveEffectiveCapabilities(manifest, policy.capabilityPolicy),
      services,
    });

    expect(createHostClientHandlers).toHaveBeenCalledWith(expect.objectContaining({
      capabilities: ["issues.read"],
    }));
  });
});
