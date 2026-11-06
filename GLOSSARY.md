# Next Template

一个提交 prompt 生成 3D 模型的应用，同时是 Next.js 项目模板：从它派生的项目保留约定和工具链，换上自己的业务。

## Language

**Sample product**:
本仓库自带的业务（任务和上传），按真实项目的写法实现，不另设演示用的代码。派生项目删掉它、写自己的业务；需要参考写法时，到模板的仓库里看。
_Avoid_: Demo、示例应用、sample app

**UI catalog**:
`/ui` 页面：设计系统组件的目录，每个组件有一个可调参数的 playground 和若干 Example。派生项目和设计系统一起保留它。
_Avoid_: UI demo、showcase、组件展示

**Example**:
UI catalog 里一个可以单独复制的用法文件，对应组件的一种使用场景。
_Avoid_: demo

## 多语言

**Source locale**（源语言）:
写新文案时使用的语言，其他 locale 的文案都由它翻译而来。它的文案一旦修改，其他 locale 都要重新翻译。
_Avoid_: 基准语言、主语言；也不要叫默认语言，默认 locale 是用户偏好未知时显示的语言，是另一个概念

## 任务

**Task**:
用户提交的一次生成任务。应用没有账号，任务不属于某个人：所有访客看到和改的是同一批任务。名称唯一，可以收藏，完成后生成一个可下载的 3D 模型文件（`.glb`）。任务有一张封面图，作为它在列表、卡片和详情页上的缩略图；用户可以上传图片替换封面图，没上传时显示默认占位图。
_Avoid_: job、generation

**Comment**:
某个 Task 下的一条文字评论，只有内容和发表时间，没有作者。任务被删除时，它的评论一起删除。
_Avoid_: 留言、备注

**Task status**:
Task 当前所处的阶段，依次为 `pending`、`running`（带进度）、`done` 或 `failed`。只有 `failed` 的任务可以重试，重试后回到 `pending`。

**Generator**:
模拟外部生成服务的后台程序：推进 Task 的状态和进度，写入日志，任务完成时产出模型文件。
_Avoid_: 生成器、worker、定时器

**Upload**:
用户为某个用途（比如 Task 的封面图）上传的一个文件。先上传，再被一条业务记录使用，一个 Upload 只能被一条记录使用；创建后一段时间仍没被使用的会被清理。
_Avoid_: 附件、file
