import { z } from "zod";

import { fetchApi } from "@/lib/fetch";
import { mutationOptions } from "@/lib/react-query";

import { expireTaskListAction } from "./expire-task-list-action";

const resetMock = () =>
  fetchApi({
    url: "/__mock/reset",
    method: "POST",
    data: {},
    schema: z.null(),
    auth: false,
  });

/**
 * Restores the Mock API's seed data and clears its faults. The reset bypasses
 * the Next server, so the list page's server cache has to be expired
 * separately. Every query in the browser may be stale too, so all are
 * invalidated, and the reset succeeds only once they have refetched: faults
 * match by route pattern, so requests still in flight would use up the counts
 * of a fault that e2e injects right after the reset.
 */
export const resetMockMutationOptions = () =>
  mutationOptions({
    mutationFn: resetMock,
    onSuccess: async (_data, _variables, _onMutateResult, { client }) => {
      await expireTaskListAction();
      await client.invalidateQueries();
    },
  });
