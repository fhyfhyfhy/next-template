/** 作品广场游标指向的位置：上一页最后一条任务的创建时间和 id。 */
export interface FeedCursor {
  createdAt: number;
  id: string;
}

// 格式是 "<创建时间毫秒>.<id>"。浏览器只原样传回，不解析；改格式时旧游标解析失败，会被当成第一页。
export function encodeFeedCursor({ createdAt, id }: FeedCursor) {
  return `${createdAt}.${id}`;
}

/** 解析不了时返回 null。 */
export function decodeFeedCursor(cursor: string): FeedCursor | null {
  const match = /^(\d+)\.(.+)$/.exec(cursor);
  if (!match) return null;
  return { createdAt: Number(match[1]), id: match[2] };
}
