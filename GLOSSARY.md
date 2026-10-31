# Next Demo

一套可复用的 Next.js 模板：约定、工具链，以及演示这些约定的可运行参考实现。

## Language

**Demo**:
`/demos` 下可运行的参考实现，供 agent 和开发者写代码时对照。从模板派生的项目也保留它。
_Avoid_: 示例应用、sample

**UI demo**:
Demo 里演示设计系统组件用法的部分，位于 `/demos/ui`。
_Avoid_: showcase、组件展示

**Example**:
UI demo 里一个可以单独复制的用法文件，对应组件的一种使用场景。
_Avoid_: 用 demo 指单个用法

**Data demo**:
Demo 里请求 Mock API 来演示数据请求的 task 小应用，包括验证它的 e2e 测试。
_Avoid_: 数据示例、task demo

**Mock API**:
模板自带的假后端，代替项目的真实后端，只在用 Demo 专用的命令运行时启动。Demo 的数据请求都发给它。
_Avoid_: mock server、假后端、fake backend

## 多语言

**Source locale**:
写新文案时使用的语言，其他 locale 的文案都由它翻译而来。它的文案一旦修改，其他 locale 都要重新翻译。
_Avoid_: 基准语言、主语言；也不要叫默认语言，默认 locale 是用户偏好未知时显示的语言，是另一个概念

## Demo 的虚构领域

**Demo task**:
Demo 虚构业务里，用户提交的一次生成任务。名称唯一，可以收藏，完成后生成一个可下载的 3D 模型文件（`.glb`）。任务有一张封面图，作为它在列表、卡片和详情页上的缩略图；用户可以上传图片替换封面图，没上传时显示默认占位图。
_Avoid_: job、generation

**Demo comment**:
某个 Demo task 下的一条文字评论，只有内容和发表时间，没有作者。任务被删除时，它的评论一起删除。
_Avoid_: 留言、备注

**Demo task status**:
Demo task 当前所处的阶段，依次为 `pending`、`running`（带进度）、`done` 或 `failed`。只有 `failed` 的任务可以重试，重试后回到 `pending`。
