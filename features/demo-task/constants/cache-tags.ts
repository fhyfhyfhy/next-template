/**
 * The tag shared by every server cache read of a task list; it expires the
 * caches of the list page and the Gallery at once. The create, rename,
 * favorite, retry and delete Server Actions call updateTag after writing;
 * changes that bypass the Next server (a cover the browser uploads, task status
 * the Mock API advances on its own, the Fault lab's reset) expire it through
 * `expireTaskListAction`.
 */
export const TASK_LIST_TAG = "demo-task:list";
