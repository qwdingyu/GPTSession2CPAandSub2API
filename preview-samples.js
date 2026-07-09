/**
 * 浏览器验证辅助脚本：在 Node 中预览 converter.js 的纯函数输出，
 * 帮助预期浏览器端转换结果，但不替代浏览器测试。
 *
 * 注意：Node vm 上下文里的对象原型行为与真实浏览器不完全一致。
 * 当 `sample-sub.json` 只有一个 account 时，浏览器中 `convertSubPayload`
 * 应返回直接展平的 snake_case 字段；但在 Node VM 里，该对象不会通过
 * `isPlainObject` 检测，因此会额外出现 `payload` 包装层。
 * 以下输出中的 `payload` 包装是 Node VM 特例，不代表浏览器实际行为。
 * 请优先以浏览器测试为准。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const projectRoot = path.resolve(__dirname);
const docsDir = path.join(projectRoot, 'docs');
const srcDir = path.join(projectRoot, 'src');

// 构造最小浏览器环境，让 converter.js 的 IIFE 能找到全局 FlowPilotConverter
const context = vm.createContext({
  console,
  JSON,
  String,
  Object,
  Array,
  Error,
  RegExp,
  Date,
  Math,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  encodeURIComponent,
  decodeURIComponent,
  encodeURI,
  decodeURI,
  FlowPilotConverter: undefined,
});

const code = fs.readFileSync(path.join(srcDir, 'converter.js'), 'utf8');
vm.runInContext(code, context);

function safeStringify(label, value) {
  console.log(`\n--- ${label} ---`);
  console.log(JSON.stringify(value, null, 2));
}

try {
  const cpaSample = JSON.parse(fs.readFileSync(path.join(docsDir, 'sample-cpa.json'), 'utf8'));
  const subSample = JSON.parse(fs.readFileSync(path.join(docsDir, 'sample-sub.json'), 'utf8'));

  console.log('docs/sample-cpa.json 转 SUB:');
  const cpaToSub = context.FlowPilotConverter.convertCpaPayload(cpaSample, {
    mode: 'lossless',
    sourceName: 'sample-cpa.json',
  });
  safeStringify('convertCpaPayload (cpa-to-sub)', cpaToSub);

  console.log('\ndocs/sample-sub.json 转 CPA:');
  const subToCpa = context.FlowPilotConverter.convertSubPayload(subSample, {
    mode: 'lossless',
    sourceName: 'sample-sub.json',
  });
  safeStringify('convertSubPayload (sub-to-cpa)', subToCpa);

  console.log('\n注意：SUB->CPA 输出中的 `payload` 包装是 Node VM 特例，不代表浏览器行为。');
  console.log('浏览器中单文件转换结果应直接为展平的 snake_case 字段。');
  console.log('说明：以上输出对应浏览器「文件互转」区域的单文件转换结果。');
  console.log('批量转换会为每个输入文件独立生成类似结构。');
} catch (error) {
  console.error('样本预览失败：', error.message);
  process.exitCode = 1;
}
