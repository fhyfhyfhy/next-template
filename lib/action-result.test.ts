import { describe, expect, test } from "vitest";

import {
  ActionError,
  isActionError,
  toActionResult,
  unwrapActionResult,
} from "./action-result";
import { conflict, DomainError, errorBody } from "./domain-error";

const NAME_TAKEN = 40901;
const takenError = () =>
  conflict(NAME_TAKEN, "name taken", {
    param: "name",
    params: { name: "Lamp" },
  });

describe("toActionResult", () => {
  test("成功时返回数据", async () => {
    await expect(toActionResult(async () => 1)).resolves.toStrictEqual({
      ok: true,
      data: 1,
    });
  });

  test("预期的业务失败返回和 Route Handler 失败响应里一样的 error 对象", async () => {
    const error = takenError();
    await expect(
      toActionResult(async () => {
        throw error;
      }, [NAME_TAKEN]),
    ).resolves.toStrictEqual({ ok: false, error: errorBody(error).error });
  });

  test("其他错误照常抛出，包括没列在 expectedCodes 里的业务失败", async () => {
    const error = takenError();
    await expect(
      toActionResult(async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});

describe("unwrapActionResult", () => {
  test("成功时返回数据", () => {
    expect(unwrapActionResult({ ok: true, data: "task" })).toBe("task");
  });

  test("失败时抛出带 code、param、params 的 ActionError", () => {
    const { error } = errorBody(takenError());
    let thrown: unknown;
    try {
      unwrapActionResult({ ok: false, error });
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(ActionError);
    expect(thrown).toMatchObject({
      code: NAME_TAKEN,
      param: "name",
      params: { name: "Lamp" },
    });
    expect(isActionError(thrown, NAME_TAKEN)).toBe(true);
    expect(
      isActionError(new DomainError(409, NAME_TAKEN, "x"), NAME_TAKEN),
    ).toBe(false);
  });
});
