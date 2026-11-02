// 种子数据固定不变：id、时间戳都是常量，Mock API 每次重启或重置后的数据完全相同，
// build 时缓存进静态 shell 的数据和 start 时的 Mock API 也就对得上。

const SEED_EPOCH = Date.UTC(2026, 9, 1);
const HOUR = 60 * 60 * 1000;

const PROMPTS = {
  fox: "一只低多边形风格的狐狸，坐姿，橙白配色",
  mech: "科幻机甲，金属质感，带发光的能量核心",
  house: "北欧风格的小木屋，雪地，烟囱冒烟",
  sword: "奇幻长剑，符文雕刻，蓝色宝石剑柄",
  car: "复古跑车，圆润车身，薄荷绿车漆",
  plant: "陶土盆里的多肉植物，卡通风格",
};

const TASKS = [
  ["低多边形狐狸", "fox", "done", true, true],
  ["坐着的狐狸 v2", "fox", "done", false, true],
  ["橙色狐狸草稿", "fox", "running", false, false],
  ["重装机甲", "mech", "done", true, true],
  ["机甲 fail 测试", "mech", "failed", false, false],
  ["侦察机甲", "mech", "done", false, false],
  ["雪地木屋", "house", "done", false, true],
  ["木屋夜景", "house", "done", true, true],
  ["木屋 fail 材质", "house", "failed", false, false],
  ["符文长剑", "sword", "done", false, true],
  ["蓝宝石剑柄", "sword", "pending", false, false],
  ["长剑低模", "sword", "done", false, false],
  ["薄荷绿跑车", "car", "done", true, true],
  ["跑车侧视", "car", "done", false, true],
  ["跑车 fail 轮毂", "car", "failed", false, false],
  ["复古跑车 v3", "car", "running", false, false],
  ["多肉盆栽", "plant", "done", false, true],
  ["卡通多肉", "plant", "done", false, false],
  ["多肉组合", "plant", "pending", false, false],
  ["多肉高模", "plant", "done", false, true],
];

const COMMENTS = [
  ["task-01", "耳朵的面数可以再少一点，更有低多边形的感觉。"],
  ["task-01", "配色很好，导出给游戏原型用了。"],
  ["task-04", "能量核心的发光能不能单独做一个材质？"],
  ["task-07", "烟囱的烟有点糊，下次试试更短的 prompt。"],
  ["task-13", "车漆颜色正是想要的。"],
];

/** 每次调用返回一份新的种子数据，重置时整体替换内存里的状态。 */
export function createSeed() {
  const tasks = TASKS.map(
    ([name, prompt, status, favorite, hasCover], index) => {
      const createdAt = SEED_EPOCH + index * HOUR;
      return {
        id: `task-${String(index + 1).padStart(2, "0")}`,
        name,
        prompt: PROMPTS[prompt],
        status,
        progress: status === "done" ? 100 : status === "running" ? 50 : 0,
        favorite,
        cover: hasCover ? { kind: "generated", version: 1 } : null,
        createdAt,
        updatedAt: createdAt + (status === "pending" ? 0 : HOUR / 2),
        logs: seedLogs(status),
      };
    },
  );
  const comments = COMMENTS.map(([taskId, content], index) => ({
    id: `comment-${String(index + 1).padStart(2, "0")}`,
    taskId,
    content,
    createdAt: SEED_EPOCH + 30 * HOUR + index * HOUR,
  }));
  return {
    tasks,
    comments,
    nextTaskNumber: tasks.length + 1,
    nextCommentNumber: comments.length + 1,
  };
}

function seedLogs(status) {
  if (status === "pending") return [];
  const logs = ["开始生成", "解析 prompt", "生成网格"];
  if (status === "done") logs.push("生成贴图", "生成完成");
  if (status === "failed") logs.push("生成失败：材质计算出错");
  return logs;
}
