/**
 * 已验证的内核代次（peer 枚举的唯一事实来源）。
 *
 * - `id`：semver 精确版本（发布 tag）
 * - `peerRange`：写入 package.json 的范围（node-semver 预发布需显式枚举）
 * - `sessionApi`：Session 读日志的形状（见 readOwnEvents / readInheritedEventCount）
 */
export const KERNEL_GENERATIONS = [
    {
        id: '0.1.1-rc.2',
        peerRange: '^0.1.1-rc.2',
        sessionApi: 'legacy-events',
    },
    {
        id: '0.1.2-rc.1',
        peerRange: '^0.1.2-rc.1',
        sessionApi: 'own-events',
    },
];
/**
 * 随内核代次一起 bump 的 peer 包（宿主 hoisting 变化会波及这些运行时 import）。
 * cordis / schemastery 等独立 semver 包**不**列入——它们不随内核 rc 枚举。
 */
export const KERNEL_SCOPED_PACKAGES = [
    '@deepseek-ai/dsh-agent',
    '@deepseek-ai/dsh-commands',
    '@deepseek-ai/dsh-llm',
    '@deepseek-ai/dsh-schedule',
    '@deepseek-ai/dsh-session',
    '@deepseek-ai/dsh-session-projection',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-tools',
];
/** dsh-commands 在 0.1.1 之前还有一代 rc.0，peer 需额外并上。 */
const EXTRA_PEER_RANGES = {
    '@deepseek-ai/dsh-commands': ['^0.0.1-rc.1'],
};
/** 由 KERNEL_GENERATIONS 拼出的 peer 范围串（`a || b`）。 */
export function peerRangeFor(packageName) {
    const extras = EXTRA_PEER_RANGES[packageName] ?? [];
    return [...extras, ...KERNEL_GENERATIONS.map((g) => g.peerRange)].join(' || ');
}
/** 全部需逐代枚举的 `{ package, range }`（sync-peer-matrix / 矩阵测试共用）。 */
export function peerMatrixEntries() {
    return KERNEL_SCOPED_PACKAGES.map((packageName) => ({
        packageName,
        range: peerRangeFor(packageName),
    }));
}
/**
 * 读取「本会话自有」事件日志（不含 fork 继承前缀时由调用方配合 offset）。
 *
 * - 0.1.2+：`session.ownEvents()`（推荐；仅 live 段）
 * - 0.1.1：`session.events`（含 seed；配合 seedLength 切片）
 */
export function readOwnEvents(session) {
    const surface = session;
    if (typeof surface.ownEvents === 'function') {
        return surface.ownEvents();
    }
    return surface.events ?? [];
}
/**
 * 读取「fork 继承前缀长度」——`foldScheduleEvents` 第二参数。
 *
 * - 0.1.2+：`session.inheritedEventCount`（SessionLogOffset 品牌数字，运行时仍是 number）
 * - 0.1.1：`session.header.seedLength`（等价物；此前实现漏了这条回退）
 * - 均缺失：0（新建会话 / 测试假 Session）
 *
 * 统一以裸 `number` 返回：cache key 可用 `===`；传入 foldScheduleEvents 时
 * 0.1.2 的 brandshape 校验接受 safe integer。
 */
export function readInheritedEventCount(session) {
    const surface = session;
    const modern = surface.inheritedEventCount;
    if (typeof modern === 'number' && Number.isSafeInteger(modern) && modern >= 0) {
        return modern;
    }
    const seed = surface.header?.seedLength;
    if (typeof seed === 'number' && Number.isSafeInteger(seed) && seed >= 0) {
        return seed;
    }
    return 0;
}
/** 探测到的 sessionApi 代次（诊断 / 测试用；不参与业务分支）。 */
export function detectSessionApi(session) {
    return typeof session.ownEvents === 'function'
        ? 'own-events'
        : 'legacy-events';
}
