/* tslint:disable */
/* eslint-disable */

/**
 * 在浏览器内对完整 IPA 字节做 sinf 注入 + iTunesMetadata 注入。
 * 输入：
 *   ipa_bytes: 完整 IPA Uint8Array
 *   song_list_0_json: Apple downloadProduct 响应里的 songList[0]（JSON 字符串）
 *   email: Apple ID
 * 输出：patched IPA bytes（Uint8Array）
 */
export function applyPatch(ipa_bytes: Uint8Array, song_list_0_json: string, email: string): Uint8Array;

/**
 * 单独执行 sinf 注入（不写 iTunesMetadata），返回 ApplyResult JSON + 新字节。
 */
export function applySignaturesOnly(ipa_bytes: Uint8Array, song_list_0_json: string, email: string): any;

/**
 * 生成 iOS .mobileconfig（包装 itms-services://）字符串
 */
export function buildMobileconfig(manifest_url: string, display_name: string): string;

/**
 * 生成 iOS OTA manifest.plist 字符串
 */
export function buildOtaManifest(ipa_url: string, bundle_id: string, version: string, title: string): string;

/**
 * 提取 IPA 内最大的 AppIcon PNG，返回 Uint8Array（找不到返回空）
 */
export function extractIcon(ipa_bytes: Uint8Array): Uint8Array;

/**
 * 提取 IPA 内的 iTunesMetadata.plist + Info.plist 元数据，返回 JSON 兼容的对象
 * 不返回 icon bytes（用 extract_icon 单独取）
 */
export function extractMetadata(ipa_bytes: Uint8Array): any;

/**
 * 检查 IPA 包内容（仅读取，不修改字节）
 * ipa_bytes: 完整 IPA 字节
 * 返回 IpaInspection（JSON 兼容）
 */
export function inspect(ipa_bytes: Uint8Array): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly applyPatch: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly applySignaturesOnly: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly buildMobileconfig: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly buildOtaManifest: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly extractIcon: (a: number, b: number) => [number, number];
    readonly extractMetadata: (a: number, b: number) => [number, number, number];
    readonly inspect: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
