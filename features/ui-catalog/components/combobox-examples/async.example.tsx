"use client";

import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";

import {
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxPortal,
  ComboboxPositioner,
  ComboboxRoot,
  ComboboxStatus,
} from "@/components/ui/combobox";
import { FieldLabel, FieldRoot } from "@/components/ui/field";
import { keepPreviousData, queryOptions, useQuery } from "@/lib/react-query";

export const metadata = {
  title: "边输入边加载选项",
  description:
    "输入停顿后经 query 搜索，把匹配项交给 Root；列表说不清的状态由 Status 播报。",
  order: 20,
};

interface Person {
  email: string;
  name: string;
}

const people: Person[] = [
  { email: "ada@example.com", name: "Ada Lovelace" },
  { email: "alan@example.com", name: "Alan Turing" },
  { email: "grace@example.com", name: "Grace Hopper" },
  { email: "linus@example.com", name: "Linus Torvalds" },
];

/** 模拟一次服务端搜索；换关键词时 React Query 中止旧请求。 */
async function searchPeople(term: string, signal: AbortSignal) {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 400);
    signal.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(signal.reason);
    });
  });
  const wanted = term.toLowerCase();
  return people.filter((person) =>
    `${person.name} ${person.email}`.toLowerCase().includes(wanted),
  );
}

/** feature 把这个 factory 放在自己的 api/。 */
const searchPeopleQueryOptions = (term: string) =>
  queryOptions({
    queryKey: ["ui-catalog", "people", { term }],
    queryFn: ({ signal }) => searchPeople(term, signal),
  });

/**
 * 搜索已经筛过，filter={null} 让 Root 原样显示 items。选项是对象，itemToStringLabel 决定选中后输入框里显示什么。
 * 只有打字才搜索：选中一项会把它的文字写进输入框，那不是关键词。新结果到达前继续显示上一次的结果。
 */
export function Example() {
  const [term, setTerm] = useState("");
  const [debouncedTerm] = useDebouncedValue(term, 300);
  const [picked, setPicked] = useState<Person | null>(null);
  const search = useQuery({
    ...searchPeopleQueryOptions(debouncedTerm),
    enabled: debouncedTerm !== "",
    placeholderData: keepPreviousData,
  });
  const matches = term === "" ? [] : (search.data ?? []);
  const status =
    term === ""
      ? "输入名字或邮箱搜索。"
      : term !== debouncedTerm || search.isFetching
        ? "正在搜索…"
        : search.error
          ? "搜索失败，请稍后重试。"
          : matches.length === 0
            ? "没有匹配的人。"
            : null;
  return (
    <FieldRoot className="w-full max-w-xs">
      <FieldLabel>成员</FieldLabel>
      <ComboboxRoot<Person>
        items={matches}
        filter={null}
        value={picked}
        itemToStringLabel={(person) => person.email}
        isItemEqualToValue={(person, chosen) => person.email === chosen.email}
        onValueChange={setPicked}
        onInputValueChange={(next, { reason }) => {
          if (reason === "input-change" || next === "") setTerm(next.trim());
        }}
      >
        <ComboboxInput placeholder="名字或邮箱" />
        <ComboboxPortal>
          <ComboboxPositioner>
            <ComboboxPopup>
              <ComboboxStatus>{status}</ComboboxStatus>
              <ComboboxList>
                {(person: Person) => (
                  <ComboboxItem key={person.email} value={person}>
                    <span className="flex min-w-0 flex-col">
                      <span>{person.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {person.email}
                      </span>
                    </span>
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxPopup>
          </ComboboxPositioner>
        </ComboboxPortal>
      </ComboboxRoot>
      <p role="status" className="mt-1 text-xs text-muted-foreground">
        {`已选：${picked?.email ?? "无"}`}
      </p>
    </FieldRoot>
  );
}
