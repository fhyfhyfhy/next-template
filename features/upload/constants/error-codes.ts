// upload 的业务错误码，前三位是 HTTP status；通用错误码在 lib/request/domain-error.ts，各 feature 的码不能重复。

/** 这次上传已经被另一条记录使用，一个上传只能被一条记录使用。 */
export const UPLOAD_ALREADY_USED = 40904;
/** 存储里没有这次上传的文件，或文件的类型、大小和签发时声明的不一致：浏览器还没传完，或传了别的文件。 */
export const UPLOAD_NOT_READY = 40905;
