// Mock API 返回的二进制内容：种子任务的封面图和 done 任务的 3D 模型文件，都按需生成，不放进仓库。

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

/** 种子任务的封面图：色相由任务 id 决定，同一个任务每次生成的图片相同。 */
export function generatedCoverSvg(taskId) {
  let hash = 0;
  for (const char of taskId) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  const from = `hsl(${hash} 70% 62%)`;
  const to = `hsl(${(hash + 40) % 360} 65% 42%)`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="360" viewBox="0 0 480 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
<rect width="480" height="360" fill="url(#g)"/>
<g fill="none" stroke="rgb(255 255 255 / 85%)" stroke-width="6" stroke-linejoin="round">
<path d="M240 90 330 140 330 230 240 280 150 230 150 140Z"/><path d="M150 140 240 190 330 140M240 190V280"/>
</g></svg>`;
}

/** 一个边长为 1 的立方体，打包成最小的合法 glTF 2.0 二进制（.glb）。 */
export function cubeGlb() {
  // prettier-ignore
  const positions = new Float32Array([
    -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5,
    -0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5,
  ]);
  // prettier-ignore
  const indices = new Uint16Array([
    0, 1, 2, 0, 2, 3, 1, 5, 6, 1, 6, 2, 5, 4, 7, 5, 7, 6,
    4, 0, 3, 4, 3, 7, 3, 2, 6, 3, 6, 7, 4, 5, 1, 4, 1, 0,
  ]);
  const binary = Buffer.concat([
    Buffer.from(positions.buffer),
    Buffer.from(indices.buffer),
  ]);
  const json = {
    asset: { version: "2.0", generator: "next-demo mock api" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binary.length }],
    bufferViews: [
      {
        buffer: 0,
        byteOffset: 0,
        byteLength: positions.byteLength,
        target: 34962,
      },
      {
        buffer: 0,
        byteOffset: positions.byteLength,
        byteLength: indices.byteLength,
        target: 34963,
      },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126,
        count: 8,
        type: "VEC3",
        min: [-0.5, -0.5, -0.5],
        max: [0.5, 0.5, 0.5],
      },
      { bufferView: 1, componentType: 5123, count: 36, type: "SCALAR" },
    ],
  };
  // glb 的每个 chunk 都要 4 字节对齐：JSON 用空格补齐，二进制用 0 补齐。
  const jsonChunk = pad(Buffer.from(JSON.stringify(json)), 0x20);
  const binChunk = pad(binary, 0);
  const total = 12 + 8 + jsonChunk.length + 8 + binChunk.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);
  return Buffer.concat([
    header,
    chunkHeader(jsonChunk.length, CHUNK_JSON),
    jsonChunk,
    chunkHeader(binChunk.length, CHUNK_BIN),
    binChunk,
  ]);
}

function pad(buffer, byte) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return Buffer.concat([buffer, Buffer.alloc(padding, byte)]);
}

function chunkHeader(length, type) {
  const header = Buffer.alloc(8);
  header.writeUInt32LE(length, 0);
  header.writeUInt32LE(type, 4);
  return header;
}
