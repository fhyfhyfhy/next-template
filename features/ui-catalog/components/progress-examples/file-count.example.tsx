"use client";

import { useFormatter } from "next-intl";

import {
  ProgressIndicator,
  ProgressLabel,
  ProgressRoot,
  ProgressTrack,
  ProgressValue,
} from "@/components/ui/progress";

export const metadata = {
  title: "按数量显示进度",
  description:
    "进度不是百分比时传 format，格式化的就是 value 本身。ProgressValue 的函数 children 和 getAriaValueText 收到格式化好的数字，各自拼成可见文字和读屏文字；进度未知时它们分别收到 null 和空字符串。总数也经 useFormatter 格式化。",
  order: 30,
};

const total = 10;

/** max 是文件总数，value 是已上传的个数。 */
export function Example() {
  const formatter = useFormatter();
  const formattedTotal = formatter.number(total);
  return (
    <ProgressRoot
      value={3}
      max={total}
      format={{ style: "decimal" }}
      // 不传时读屏只读出格式化好的数字“3”，要连同总数和单位一起读。
      getAriaValueText={(uploaded) =>
        uploaded === ""
          ? `进度未知，共 ${formattedTotal} 个文件`
          : `已上传 ${uploaded} 个文件，共 ${formattedTotal} 个`
      }
      className="w-full max-w-sm"
    >
      <ProgressLabel>上传中</ProgressLabel>
      <ProgressValue>
        {(uploaded) => `${uploaded ?? "—"} / ${formattedTotal}`}
      </ProgressValue>
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
