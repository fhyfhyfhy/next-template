import { z } from "zod";

import type { Translator } from "@/lib/i18n/translator";

import { TASK_NAME_MAX_LENGTH } from "../constants/task-rules";

/**
 * 任务名称的规则：去掉首尾空白后 1 到 40 个字，和数据层的校验一致。创建、重命名的表单和 action 共用，
 * 校验文案由调用方传入的 `t` 按当前 locale 生成。
 */
export const createTaskNameSchema = (t: Translator) =>
  z
    .string()
    .trim()
    .min(1, t("demo-task.validation.nameRequired"))
    .max(
      TASK_NAME_MAX_LENGTH,
      t("demo-task.validation.nameTooLong", { max: TASK_NAME_MAX_LENGTH }),
    );
