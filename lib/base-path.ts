/**
 * app 所在的 basePath，空字符串表示部署在根路径。要部署在某个路径下的项目只在这里设置：next.config.ts 读它，
 * 不经过 Next 的 Link、router 和 redirect 拼出的 URL 也读它，比如语言切换器的整页链接和 fetchApi 的同源请求，因为 Next 只给自己生成的
 * URL 加 basePath。
 */
export const BASE_PATH = "";
