# Demo 的文件经通用上传直传对象存储

Demo 后端模拟真实后端处理用户文件的方式：文件本体存在兼容 S3 API 的对象存储里，数据库只记元数据。用户上传先经通用的上传资源（独立的 `demo-upload` feature 和 `uploads` 表）签发 presigned URL，浏览器把文件直传到存储，业务记录再通过附件关联使用这次上传。这样文件不经过业务 server，签名和校验由 server 负责，换成真实的 S3 或 R2 只需要改配置。本地用 Docker Compose 里的 Versity Gateway 充当对象存储。引用关系参照 Rails Active Storage 的 blobs 加 attachments，记在 `demo-upload` 自己的 `upload_attachments` 表里，所以它不用了解业务表，就能判断哪些上传没被使用。

## Considered Options

- 文件经 Route Handler 转发到存储：只需一个请求，但文件要经过业务 server，部署到 serverless 时还受请求体大小限制，和真实系统处理上传的方式不同。
- 每种资源各有一个签发接口（比如 `tasks/:id/cover/upload-url`）：签发时就知道用途，可以用 key 前缀防冒用；但每多一种上传就要多一套接口，孤儿文件只能靠扫描存储来找。
- 业务记录直接存 key，不设上传 id：读取时少一次查询，但 key 属于存储层的细节，迁移 bucket、改命名规则时，所有引用它的业务表都要跟着改。
- 业务表用外键引用上传（比如 `tasks.cover_upload_id`）：有引用完整性，但"有没有被使用"的信息分散在各业务表里，`demo-upload` 看不到。清理时只能逐个试删，靠外键 `RESTRICT` 拦下被引用的，每一轮都要把已被使用的老上传重新试一遍。
- 按内容 hash 去重：要把 checksum 签进上传 URL，删除时还要看引用计数；有登录的系统里，跨用户去重还会泄露"别人是否传过这个文件"。Demo 里没有能体现它价值的场景。
- 本地存储用 MinIO、LocalStack 或 Garage：MinIO 社区版已停止维护，LocalStack 的镜像需要账号 token，Garage 不支持 bucket policy。

## Consequences

- 上传分三步：Server Action 按 purpose 校验并签发上传 URL；浏览器把文件 PUT 到存储；业务记录的 Server Action 用上传 id 关联，关联前先 HEAD 核对对象的类型和大小。
- `upload_attachments` 的每一行记录一个 `(record_type, record_id, name)` 用了哪个上传，比如 `("task", "task-01", "cover")`。`upload_id` 唯一，冲突时返回 `UPLOAD_ALREADY_USED`；`(record_type, record_id, name)` 唯一，一个任务只有一张封面。重复提交同样的关联什么也不做。
- `record_id` 指向哪张表由 `record_type` 决定，没法对业务表建外键。业务记录删除时，所属 feature 要在同一个事务里调用 `demo-upload` 解除它的全部关联，所以 `demo-upload` 的函数接受调用方传入的事务。漏调的后果只是文件不会被清理，不会误删正在使用的文件。
- `uploads` 表不存状态。创建超过 1 小时、而且没有 attachment 的上传，由 `demo-upload` 的清理任务连同对象一起删除。换封面、删任务时都只改 attachment，不当场删文件，删除只有这一条路径。
- `uploads/` 前缀的公开读策略只在开发环境的初始化脚本里设置：R2 没有 bucket policy API，公开读要靠它自己的公开域名，所以公开地址是一个配置项。
- presigned 上传 URL 要把 `Content-Type` 签进去，S3 client 要设置 `requestChecksumCalculation: "WHEN_REQUIRED"`。Versity 不会拒绝 SDK 默认附带的空 checksum 参数，用它开发时发现不了这个问题，但换成 Garage、SeaweedFS 等存储后上传会失败。
