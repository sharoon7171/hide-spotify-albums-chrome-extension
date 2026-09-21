import { readHiddenAlbumIdsEarly } from "@/lib/hidden-album-ids";
import {
  isDiscographyPath,
  routePathname,
  VIRTUAL_LIST_MODULE,
} from "@/hiding/routes";

const BUNDLE_CHUNK_KEYS = [
  "webpackChunkclient_web",
  "rspackChunkclient_web",
] as const;

export const VIRTUAL_LIST_NEEDLE_PATTERN =
  /itemIsValidPredicate:\w+=\(\)=>!0/;

export function matchesVirtualListNeedle(source: string): boolean {
  return VIRTUAL_LIST_NEEDLE_PATTERN.test(source);
}

type WebpackRequire = {
  (id: string | number): Record<string, unknown>;
  m: Record<string, unknown>;
};

type VirtualListHook = (props: {
  itemIsValidPredicate?: (value: unknown) => boolean;
  initialItems?: unknown;
}) => unknown;

type WebpackFactory = (
  module: unknown,
  exports: Record<string, unknown>,
  require: unknown,
) => void;

type TaggedFactory = WebpackFactory & {
  __spotifyExtWrapped?: boolean;
  __spotifyExtVirtualList?: boolean;
};

type VirtualListPatchContext = {
  hiddenIds: () => Set<string>;
  albumUriRe: RegExp;
};

type ModuleCacheEntry = { exports?: Record<string, unknown> };

const EXPOSE_KEY = "__spotifyExtWebpackRequire" as const;

type BundleChunk = { push: (args: unknown[]) => WebpackRequire };

function getBundleChunk(): BundleChunk | null {
  for (const key of BUNDLE_CHUNK_KEYS) {
    const chunk = (globalThis as Record<string, unknown>)[key];
    if (chunk && typeof (chunk as BundleChunk).push === "function") {
      return chunk as BundleChunk;
    }
  }
  return null;
}

function cacheWebpackRequire(req: WebpackRequire): void {
  (globalThis as typeof globalThis & { [EXPOSE_KEY]?: WebpackRequire })[
    EXPOSE_KEY
  ] = req;
}

function cachedWebpackRequire(): WebpackRequire | null {
  return (
    (globalThis as typeof globalThis & { [EXPOSE_KEY]?: WebpackRequire })[
      EXPOSE_KEY
    ] ?? null
  );
}

function obtainWebpackRequire(): WebpackRequire | null {
  const chunk = getBundleChunk();
  if (!chunk) return null;
  try {
    const req = chunk.push([
      [Symbol.for("spotify-ext-expose")],
      {},
      (r: unknown) => r,
    ]) as WebpackRequire;
    return req?.m ? req : null;
  } catch {
    return null;
  }
}

export function getWebpackRequire(): WebpackRequire | null {
  const cached = cachedWebpackRequire();
  if (cached) return cached;
  const chunk = getBundleChunk();
  if (!chunk) return null;
  try {
    const req = chunk.push([
      [Symbol.for("spotify-ext")],
      {},
      (r: unknown) => r,
    ]) as WebpackRequire;
    if (!req?.m) return null;
    cacheWebpackRequire(req);
    return req;
  } catch {
    return null;
  }
}

function findModuleIdByExportBody(): string | null {
  const req = getWebpackRequire();
  if (!req) return null;
  for (const id of Object.keys(req.m)) {
    const factory = req.m[id];
    if (
      typeof factory === "function" &&
      matchesVirtualListNeedle(factory.toString())
    ) {
      return id;
    }
  }
  return null;
}

function findWebpackModuleCache(
  root: unknown,
  moduleId: string,
): Record<string, ModuleCacheEntry> | null {
  const seen = new Set<object>();
  const queue: unknown[] = [root];
  let steps = 0;
  while (queue.length > 0 && steps < 5000) {
    steps += 1;
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;
    if (seen.has(current)) continue;
    seen.add(current);
    const record = current as Record<string, ModuleCacheEntry>;
    const hit = record[moduleId] ?? record[Number(moduleId)];
    if (hit && typeof hit === "object" && "exports" in hit) return record;
    for (const key of Object.getOwnPropertyNames(current)) {
      let child: unknown;
      try {
        child = (current as Record<string, unknown>)[key];
      } catch {
        continue;
      }
      if (child && typeof child === "object") queue.push(child);
    }
  }
  return null;
}

function evictWebpackModule(
  cache: Record<string, ModuleCacheEntry>,
  moduleId: string,
): void {
  delete cache[moduleId];
  delete cache[Number(moduleId)];
}

function isVirtualListFactory(factory: unknown): factory is WebpackFactory {
  if (typeof factory !== "function") return false;
  const tagged = factory as TaggedFactory;
  return (
    tagged.__spotifyExtVirtualList === true ||
    matchesVirtualListNeedle(factory.toString())
  );
}

function createVirtualListPatch(ctx: VirtualListPatchContext) {
  function wrapHook(original: VirtualListHook): VirtualListHook {
    const wrapped: VirtualListHook = (props) => {
      if (Object.prototype.hasOwnProperty.call(props, "initialItems")) {
        return original(props);
      }
      if (!isDiscographyPath(routePathname())) return original(props);
      const userPred = props.itemIsValidPredicate ?? (() => true);
      const hidden = ctx.hiddenIds();
      return original({
        ...props,
        itemIsValidPredicate: (value: unknown) => {
          if (!userPred(value)) return false;
          const uri =
            value && typeof value === "object"
              ? (value as { uri?: string }).uri
              : undefined;
          if (typeof uri !== "string") return true;
          const m = ctx.albumUriRe.exec(uri);
          if (!m) return true;
          return !hidden.has(m[1]);
        },
      });
    };
    (wrapped as { __spotifyExtDisc?: boolean }).__spotifyExtDisc = true;
    return wrapped;
  }

  function isVirtualListExportHook(
    hook: unknown,
  ): hook is VirtualListHook & { __spotifyExtDisc?: boolean } {
    return (
      typeof hook === "function" &&
      (hook as { __spotifyExtDisc?: boolean }).__spotifyExtDisc === true
    );
  }

  function wrapFactory(original: WebpackFactory): WebpackFactory {
    const tagged = original as TaggedFactory;
    if (tagged.__spotifyExtWrapped) return original;
    const wrapped: WebpackFactory = function (module, exports, require) {
      original(module, exports, require);
    };
    Object.defineProperty(wrapped, "__spotifyExtWrapped", { value: true });
    Object.defineProperty(wrapped, "__spotifyExtVirtualList", { value: true });
    return wrapped;
  }

  function patchFactoryMap(modules: Record<string, unknown>): boolean {
    let touched = false;
    for (const id of Object.keys(modules)) {
      const factory = modules[id];
      if (!isVirtualListFactory(factory)) continue;
      const tagged = factory as TaggedFactory;
      if (tagged.__spotifyExtWrapped) continue;
      modules[id] = wrapFactory(factory);
      touched = true;
    }
    return touched;
  }

  function assignExportE(mod: Record<string, unknown>, hook: VirtualListHook): void {
    try {
      Object.defineProperty(mod, "E", {
        value: hook,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      mod.E = hook;
    }
  }

  function patchModuleExport(
    req: WebpackRequire,
    moduleId: string = VIRTUAL_LIST_MODULE,
  ): boolean {
    if (!isDiscographyPath(routePathname())) return false;
    try {
      const mod = req(moduleId);
      const hook = mod.E;
      if (typeof hook !== "function") return false;
      if (isVirtualListExportHook(hook)) return true;
      if (!matchesVirtualListNeedle(hook.toString())) return false;
      assignExportE(mod, wrapHook(hook as VirtualListHook));
      return isVirtualListExportHook(mod.E);
    } catch {
      return false;
    }
  }

  return {
    patchFactoryMap,
    patchModuleExport,
    isVirtualListExportHook,
    wrapHook,
  };
}

let virtualListExportPatched = false;
let evictAttempted = false;

export function applyVirtualListAlbumPatch(
  req: WebpackRequire,
  patchCtx: VirtualListPatchContext,
): boolean {
  if (!isDiscographyPath(routePathname())) return virtualListExportPatched;
  if (virtualListExportPatched) return true;

  const patch = createVirtualListPatch(patchCtx);
  const moduleId = findModuleIdByExportBody() ?? VIRTUAL_LIST_MODULE;

  patch.patchFactoryMap(req.m);
  if (patch.patchModuleExport(req, moduleId)) {
    virtualListExportPatched = true;
    return true;
  }

  if (!evictAttempted) {
    evictAttempted = true;
    const roots: unknown[] = [globalThis];
    for (const key of BUNDLE_CHUNK_KEYS) {
      const chunk = (globalThis as Record<string, unknown>)[key];
      if (!Array.isArray(chunk)) continue;
      roots.push(chunk);
      for (const entry of chunk) {
        if (!Array.isArray(entry) || typeof entry[2] !== "function") continue;
        try {
          const r = entry[2]({});
          if (r && typeof r === "object") roots.push(r);
        } catch {}
      }
    }
    for (const root of roots) {
      const cache = findWebpackModuleCache(root, moduleId);
      if (cache) evictWebpackModule(cache, moduleId);
    }
    try {
      if (patch.patchModuleExport(req, moduleId)) {
        virtualListExportPatched = true;
        return true;
      }
    } catch {}
  }
  return false;
}

function hookWebpackModulesAssignment(
  onModules: (modules: Record<string, unknown>) => void,
): void {
  const tagged = globalThis as typeof globalThis & {
    __spotifyExtModulesHook?: boolean;
  };
  if (tagged.__spotifyExtModulesHook) return;

  const patchIfPresent = (): boolean => {
    const modules = (
      globalThis as typeof globalThis & {
        __webpack_modules__?: Record<string, unknown>;
      }
    ).__webpack_modules__;
    if (modules && typeof modules === "object") {
      onModules(modules);
      return true;
    }
    return false;
  };

  const existing = Object.getOwnPropertyDescriptor(
    globalThis,
    "__webpack_modules__",
  );
  if (existing && !existing.configurable) {
    patchIfPresent();
    tagged.__spotifyExtModulesHook = true;
    return;
  }

  let stored: Record<string, unknown> | undefined;

  try {
    Object.defineProperty(globalThis, "__webpack_modules__", {
      configurable: true,
      enumerable: true,
      get() {
        return stored;
      },
      set(value) {
        if (value && typeof value === "object") {
          onModules(value as Record<string, unknown>);
        }
        stored = value as Record<string, unknown>;
        Object.defineProperty(globalThis, "__webpack_modules__", {
          value: stored,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      },
    });
  } catch {
    patchIfPresent();
  }
  tagged.__spotifyExtModulesHook = true;
}

export function installWebpackEarlyHooks(): void {
  const ALBUM_URI = /^spotify:album:([0-9A-Za-z]+)$/;
  const patchCtx = {
    hiddenIds: readHiddenAlbumIdsEarly,
    albumUriRe: ALBUM_URI,
  };
  const virtualListPatch = createVirtualListPatch(patchCtx);

  const tagged = globalThis as typeof globalThis & {
    __spotifyExtOdpHook?: boolean;
  };
  if (!tagged.__spotifyExtOdpHook) {
    const orig = Object.defineProperty;
    Object.defineProperty = function <T>(
      obj: T,
      prop: PropertyKey,
      desc: PropertyDescriptor & ThisType<unknown>,
    ): T {
      if (
        prop !== "E" ||
        !desc ||
        typeof desc.get !== "function" ||
        !obj ||
        typeof obj !== "object"
      ) {
        return orig(obj, prop, desc);
      }
      const origGet = desc.get;
      const nextDesc = { ...desc };
      nextDesc.get = () => {
        const val = origGet();
        if (virtualListPatch.isVirtualListExportHook(val)) return val;
        if (
          typeof val === "function" &&
          matchesVirtualListNeedle(val.toString())
        ) {
          return virtualListPatch.wrapHook(val);
        }
        return val;
      };
      return orig(obj, prop, nextDesc);
    } as typeof Object.defineProperty;
    tagged.__spotifyExtOdpHook = true;
  }

  function hookChunkPush(chunk: BundleChunk): boolean {
    const chunkTagged = chunk as BundleChunk & { __spotifyExtChunkHook?: boolean };
    if (chunkTagged.__spotifyExtChunkHook) return true;
    const original = chunk.push.bind(chunk);
    chunk.push = ((entry: unknown) => {
      const tuple = entry as [
        unknown,
        Record<string, unknown> | undefined,
        unknown,
      ];
      const modules = tuple[1];
      if (modules) virtualListPatch.patchFactoryMap(modules);
      return original(entry as unknown[]);
    }) as BundleChunk["push"];
    chunkTagged.__spotifyExtChunkHook = true;
    return true;
  }

  function ensureBundleChunkPushHook(
    key: (typeof BUNDLE_CHUNK_KEYS)[number],
  ): void {
    const globalRecord = globalThis as Record<string, unknown>;
    const existing = globalRecord[key];
    if (existing && typeof (existing as BundleChunk).push === "function") {
      hookChunkPush(existing as BundleChunk);
      return;
    }
    let chunkValue: unknown;
    try {
      Object.defineProperty(globalThis, key, {
        configurable: true,
        enumerable: true,
        get() {
          return chunkValue;
        },
        set(value) {
          chunkValue = value;
          Object.defineProperty(globalThis, key, {
            value: chunkValue,
            writable: true,
            configurable: true,
            enumerable: true,
          });
          if (value && typeof (value as BundleChunk).push === "function") {
            hookChunkPush(value as BundleChunk);
          }
        },
      });
    } catch {
      if (existing && typeof (existing as BundleChunk).push === "function") {
        hookChunkPush(existing as BundleChunk);
      }
    }
  }

  for (const key of BUNDLE_CHUNK_KEYS) {
    ensureBundleChunkPushHook(key);
  }
  (globalThis as typeof globalThis & { __spotifyExtBootstrap?: boolean })
    .__spotifyExtBootstrap = true;

  hookWebpackModulesAssignment((modules) => {
    virtualListPatch.patchFactoryMap(modules);
  });

  const modules = (globalThis as typeof globalThis & {
    __webpack_modules__?: Record<string, unknown>;
  }).__webpack_modules__;
  if (modules) virtualListPatch.patchFactoryMap(modules);

  const req = obtainWebpackRequire();
  if (req) cacheWebpackRequire(req);

  (globalThis as typeof globalThis & { __spotifyExtPostSnapshot?: boolean })
    .__spotifyExtPostSnapshot = true;
}
