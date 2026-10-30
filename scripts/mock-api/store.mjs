import { cubeGlb, generatedCoverSvg } from "./assets.mjs";
import { badRequest, conflict, ErrorCode, notFound } from "./responses.mjs";
import { createSeed } from "./seed.mjs";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 50;
const NAME_MAX_LENGTH = 40;
const PROMPT_MAX_LENGTH = 500;
const COMMENT_MAX_LENGTH = 500;
const SEARCH_LIMIT = 20;
const PROGRESS_STEP = 25;
const RUNNING_LOGS = ["解析 prompt", "生成网格", "生成贴图", "优化拓扑"];

/** 业务规则拒绝请求时抛出，由 server.mjs 转成对应的响应。 */
export class DomainError extends Error {
  constructor(response) {
    super(response.body.error.message);
    this.response = response;
  }
}

/** Mock API 的内存状态和 Demo task 的业务规则。 */
export function createStore() {
  let state = createSeed();
  const subscribers = new Map();

  function notify(task) {
    for (const listener of subscribers.get(task.id) ?? []) listener(task);
  }

  function advance(task) {
    if (task.status === "done" || task.status === "failed") return;
    if (task.status === "pending") {
      task.status = "running";
      task.progress = 0;
      task.logs.push("开始生成");
    } else if (task.progress < 100) {
      task.progress += PROGRESS_STEP;
      task.logs.push(RUNNING_LOGS[task.progress / PROGRESS_STEP - 1]);
    } else if (/fail/i.test(task.name)) {
      task.status = "failed";
      task.logs.push("生成失败：材质计算出错");
    } else {
      task.status = "done";
      task.logs.push("生成完成");
    }
    task.updatedAt = Date.now();
    notify(task);
  }

  function getTask(id) {
    const task = state.tasks.find((candidate) => candidate.id === id);
    if (!task) throw new DomainError(notFound(`任务 ${id} 不存在`));
    return task;
  }

  function assertNameAvailable(name, exceptId) {
    if (
      state.tasks.some((task) => task.name === name && task.id !== exceptId)
    ) {
      throw new DomainError(
        conflict(ErrorCode.TASK_NAME_TAKEN, `名称“${name}”已被占用`, {
          param: "name",
        }),
      );
    }
  }

  return {
    reset() {
      state = createSeed();
    },

    listTasks({ status, favorite, prompt, excludeId, sort, page, pageSize }) {
      const tasks = state.tasks.filter(
        (task) =>
          (status.length === 0 || status.includes(task.status)) &&
          (favorite === undefined || task.favorite === favorite) &&
          (prompt === undefined || task.prompt === prompt) &&
          task.id !== excludeId,
      );
      tasks.sort(compareBy(sort));
      return paginate(tasks, page, pageSize);
    },

    getTask,

    searchTasks(term) {
      const keyword = term.trim();
      if (!keyword) return [];
      return state.tasks
        .filter(
          (task) =>
            task.name.includes(keyword) || task.prompt.includes(keyword),
        )
        .sort(compareBy())
        .slice(0, SEARCH_LIMIT);
    },

    listFeed({ page, pageSize }) {
      const tasks = state.tasks
        .filter((task) => task.status === "done")
        .sort(compareBy());
      return paginate(tasks, page, pageSize);
    },

    createTask({ name, prompt }) {
      const taskName = requireText(name, "name", NAME_MAX_LENGTH);
      const taskPrompt = requireText(prompt, "prompt", PROMPT_MAX_LENGTH);
      assertNameAvailable(taskName);
      const now = Date.now();
      const task = {
        id: `task-${String(state.nextTaskNumber++).padStart(2, "0")}`,
        name: taskName,
        prompt: taskPrompt,
        status: "pending",
        progress: 0,
        favorite: false,
        cover: null,
        createdAt: now,
        updatedAt: now,
        logs: [],
      };
      state.tasks.push(task);
      return task;
    },

    /** 推进一步：pending → running 0% → 每步 +25% → 100% 之后进入终态；已在终态的任务不变。 */
    advanceTask(id) {
      const task = getTask(id);
      advance(task);
      return task;
    },

    advanceAll() {
      for (const task of state.tasks) advance(task);
    },

    /** 任务每次变化时调用 `listener`，返回取消订阅的函数。 */
    subscribe(taskId, listener) {
      const listeners = subscribers.get(taskId) ?? new Set();
      listeners.add(listener);
      subscribers.set(taskId, listeners);
      return () => listeners.delete(listener);
    },

    renameTask(id, { name }) {
      const task = getTask(id);
      const taskName = requireText(name, "name", NAME_MAX_LENGTH);
      assertNameAvailable(taskName, id);
      task.name = taskName;
      task.updatedAt = Date.now();
      return task;
    },

    setFavorite(id, { favorite }) {
      const task = getTask(id);
      if (typeof favorite !== "boolean") {
        throw new DomainError(badRequest("favorite 必须是布尔值"));
      }
      task.favorite = favorite;
      task.updatedAt = Date.now();
      return task;
    },

    retryTask(id) {
      const task = getTask(id);
      if (task.status !== "failed") {
        throw new DomainError(
          conflict(
            ErrorCode.TASK_NOT_RETRYABLE,
            "只有失败的任务可以重试，任务状态可能已经变化",
          ),
        );
      }
      task.status = "pending";
      task.progress = 0;
      task.logs = [];
      task.updatedAt = Date.now();
      notify(task);
      return task;
    },

    setCover(id, { contentType, bytes }) {
      const task = getTask(id);
      if (!contentType.startsWith("image/")) {
        throw new DomainError(badRequest("封面图必须是图片"));
      }
      task.cover = {
        kind: "upload",
        contentType,
        bytes,
        version: (task.cover?.version ?? 0) + 1,
      };
      task.updatedAt = Date.now();
      return task;
    },

    getCover(id) {
      const task = getTask(id);
      if (!task.cover) throw new DomainError(notFound(`任务 ${id} 没有封面图`));
      if (task.cover.kind === "upload") return task.cover;
      return {
        contentType: "image/svg+xml",
        bytes: Buffer.from(generatedCoverSvg(task.id)),
      };
    },

    /** done 任务的 3D 模型文件，其他状态按业务规则拒绝。 */
    getModel(id) {
      const task = getTask(id);
      if (task.status !== "done") {
        throw new DomainError(
          conflict(ErrorCode.TASK_NOT_DONE, "任务完成后才能下载模型"),
        );
      }
      return { filename: `${task.name}.glb`, bytes: cubeGlb() };
    },

    deleteTask(id) {
      getTask(id);
      state.tasks = state.tasks.filter((task) => task.id !== id);
      state.comments = state.comments.filter(
        (comment) => comment.taskId !== id,
      );
    },

    listComments(taskId) {
      getTask(taskId);
      return state.comments
        .filter((comment) => comment.taskId === taskId)
        .sort((a, b) => a.createdAt - b.createdAt);
    },

    addComment(taskId, { content }) {
      getTask(taskId);
      const text = requireText(content, "content", COMMENT_MAX_LENGTH);
      const comment = {
        id: `comment-${String(state.nextCommentNumber++).padStart(2, "0")}`,
        taskId,
        content: text,
        createdAt: Date.now(),
      };
      state.comments.push(comment);
      return comment;
    },

    deleteComment(taskId, commentId) {
      getTask(taskId);
      const exists = state.comments.some(
        (comment) => comment.id === commentId && comment.taskId === taskId,
      );
      if (!exists) throw new DomainError(notFound(`评论 ${commentId} 不存在`));
      state.comments = state.comments.filter(
        (comment) => comment.id !== commentId,
      );
    },
  };
}

/** 去掉首尾空白后长度在 1 到 `maxLength` 之间，否则按参数错误拒绝。 */
function requireText(value, field, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length === 0 || text.length > maxLength) {
    throw new DomainError(
      badRequest(`${field} 必须是 1 到 ${maxLength} 个字`, {
        param: field,
        params: { max: maxLength },
      }),
    );
  }
  return text;
}

function compareBy(sort) {
  switch (sort) {
    case "created_asc":
      return (a, b) => a.createdAt - b.createdAt;
    case "name_asc":
      return (a, b) => a.name.localeCompare(b.name, "zh-CN");
    default:
      return (a, b) => b.createdAt - a.createdAt;
  }
}

/** 页码从 1 开始，超出范围时返回空列表。 */
export function paginate(items, page = 1, pageSize = DEFAULT_PAGE_SIZE) {
  const size = Math.min(Math.max(pageSize, 1), MAX_PAGE_SIZE);
  const start = (Math.max(page, 1) - 1) * size;
  return {
    items: items.slice(start, start + size),
    total: items.length,
    page: Math.max(page, 1),
    pageSize: size,
    hasMore: start + size < items.length,
  };
}
