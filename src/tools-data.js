/* tools-data.js — Curated AI tools catalog */
var CATALOG_META = {
  lastCheckedAt: '2026-07-09',
  policyUrl: 'https://github.com/qwdingyu/GPTSession2CPAandSub2API/blob/main/docs/07_%E5%B7%A5%E5%85%B7%E6%94%B6%E5%BD%95%E6%A0%87%E5%87%86%E4%B8%8E%E6%95%B0%E6%8D%AE%E6%B2%BB%E7%90%86_20260709.md',
  note: '优先收录官方产品、主流开源项目和有明确使用场景的 AI 工具。'
};

var CATEGORIES = [
  { id: 'all', label: '全部', icon: '⊞' },
  { id: 'llm', label: 'LLM / 对话', icon: '💬' },
  { id: 'coding', label: '编程助手', icon: '⌨️' },
  { id: 'image', label: '图像生成', icon: '🎨' },
  { id: 'video', label: '视频生成', icon: '🎬' },
  { id: 'audio', label: '语音 / 音频', icon: '🎵' },
  { id: 'search', label: 'AI 搜索', icon: '🔍' },
  { id: 'agents', label: '智能体框架', icon: '🧠' },
  { id: 'productivity', label: '效率工具', icon: '⚡' },
  { id: 'infra', label: '基础设施', icon: '☁️' },
];

var TOOLS = [
  // ── LLM / 对话 ──
  { id:'openai', name:'OpenAI', description:'GPT-4o、GPT-4o-mini、o1、o3 系列前沿模型，以及 DALL·E、Whisper、TTS 多模态 API', category:'llm', url:'https://platform.openai.com', icon:'🤖', tags:['GPT-4o','API','多模态'], featured:true },
  { id:'anthropic', name:'Anthropic Claude', description:'Claude 3.5 Sonnet、Claude 3 Haiku — 长上下文、安全对齐的对话模型', category:'llm', url:'https://docs.anthropic.com', icon:'🧑‍💻', tags:['Claude','长上下文','安全'], featured:true },
  { id:'google-gemini', name:'Google Gemini', description:'Gemini 2.0 Flash、Pro — Google 最新多模态大模型，原生支持工具调用', category:'llm', url:'https://ai.google.dev', icon:'🔮', tags:['Gemini','Google','多模态'], featured:true },
  { id:'deepseek', name:'DeepSeek', description:'DeepSeek-V3、R1 推理模型 — 性价比极高的开源大模型', category:'llm', url:'https://platform.deepseek.com', icon:'🦈', tags:['开源','高性价比','推理'] },
  { id:'xai-grok', name:'xAI Grok', description:'Grok-2 / Grok-3 Beta — 实时知识、幽默风格的对话 AI', category:'llm', url:'https://x.ai', icon:'⚡', tags:['实时','幽默','X平台'] },
  { id:'meta-llama', name:'Meta Llama', description:'Llama 3 / Llama 4 开源大模型家族，支持本地部署和微调', category:'llm', url:'https://llama.meta.com', icon:'🦙', tags:['开源','本地部署','微调'] },
  { id:'mistral', name:'Mistral AI', description:'Mistral Large、Small 系列高效模型，注重隐私和边缘部署', category:'llm', url:'https://mistral.ai', icon:'🌬️', tags:['高效','隐私','欧洲'] },
  { id:'cohere', name:'Cohere', description:'Command R+ 系列 — 企业级 RAG 与工具调用模型', category:'llm', url:'https://cohere.com', icon:'🌐', tags:['RAG','企业','嵌入'] },

  // ── 编程助手 ──
  { id:'copilot', name:'GitHub Copilot', description:'VS Code、JetBrains、Neovim 全平台 AI 代码补全与聊天', category:'coding', url:'https://github.com/features/copilot', icon:'🐙', tags:['代码补全','多IDE','聊天'], featured:true },
  { id:'cursor', name:'Cursor', description:'AI-first 代码编辑器，内置多模型对话、代码补全和内联编辑', category:'coding', url:'https://cursor.com', icon:'📝', tags:['AI编辑器','多模型','内联编辑'], featured:true },
  { id:'windsurf', name:'Windsurf (Codeium)', description:'流式 AI IDE，支持 Cascade 多文件编辑和深度上下文感知', category:'coding', url:'https://codeium.com/windsurf', icon:'🏄', tags:['多文件','上下文','IDE'] },
  { id:'claude-code', name:'Claude Code', description:'Anthropic 官方终端 AI 编程代理，深度理解代码库', category:'coding', url:'https://docs.anthropic.com/en/docs/claude-code', icon:'💻', tags:['终端','代理','Claude'] },
  { id:'cline', name:'Cline', description:'VS Code 中自主编程代理，可规划、创建、编辑文件和执行命令', category:'coding', url:'https://github.com/cline/cline', icon:'🤖', tags:['自主','VS Code','开源'] },
  { id:'aider', name:'Aider', description:'终端 AI 结对编程，支持多文件和 git 感知', category:'coding', url:'https://aider.chat', icon:'🦎', tags:['终端','结对编程','git'] },
  { id:'codex-cli', name:'Codex CLI', description:'OpenAI 官方终端编码代理，轻量级、o3/o4-mini 驱动', category:'coding', url:'https://codex.cli', icon:'🖥️', tags:['终端','OpenAI','轻量'] },

  // ── 图像生成 ──
  { id:'midjourney', name:'Midjourney', description:'高品质 AI 图像生成，以其艺术风格和细节著称', category:'image', url:'https://midjourney.com', icon:'🎭', tags:['高品质','艺术','Discord'], featured:true },
  { id:'dalle', name:'DALL·E 3', description:'OpenAI 图像生成模型，通过 ChatGPT 或 API 使用', category:'image', url:'https://openai.com/dall-e-3', icon:'🎨', tags:['OpenAI','文本生图','API'] },
  { id:'stable-diffusion', name:'Stable Diffusion 3', description:'Stability AI 开源图像生成模型，支持本地部署和商业使用', category:'image', url:'https://stability.ai', icon:'🖼️', tags:['开源','本地部署','自定义'] },
  { id:'flux', name:'Flux.1', description:'Black Forest Labs 推出的高性能开源图像生成模型', category:'image', url:'https://blackforestlabs.ai', icon:'🌌', tags:['开源','快速','高品质'] },
  { id:'comfyui', name:'ComfyUI', description:'基于节点的 Stable Diffusion 工作流工具，灵活可编程', category:'image', url:'https://comfyui.org', icon:'🔗', tags:['工作流','节点','SD'] },

  // ── 视频生成 ──
  { id:'runway', name:'Runway Gen-3', description:'文本/图片生成视频，支持运动笔刷和视频编辑', category:'video', url:'https://runwayml.com', icon:'🎥', tags:['文生视频','运动笔刷','编辑'], featured:true },
  { id:'pika', name:'Pika 2.0', description:'AI 视频创作平台，支持文本/图片生成与视频风格化', category:'video', url:'https://pika.art', icon:'⭐', tags:['文生视频','风格化','简单'] },
  { id:'sora', name:'Sora', description:'OpenAI 视频生成模型，高保真物理世界模拟', category:'video', url:'https://sora.com', icon:'🌊', tags:['OpenAI','物理模拟','高保真'] },
  { id:'kling', name:'Kling 1.6', description:'快手 AI 视频生成，高画质、好用的中文视频工具', category:'video', url:'https://klingai.com', icon:'🎞️', tags:['中文','快手上出','高品质'] },

  // ── 语音 / 音频 ──
  { id:'elevenlabs', name:'ElevenLabs', description:'AI 语音合成与克隆，支持多语言、情感表达和声音库', category:'audio', url:'https://elevenlabs.io', icon:'🗣️', tags:['语音合成','克隆','多语言'], featured:true },
  { id:'openai-tts', name:'OpenAI TTS / Whisper', description:'OpenAI 文本转语音与语音识别 API，Whisper 开源模型', category:'audio', url:'https://platform.openai.com/docs/guides/speech-to-text', icon:'🎤', tags:['ASR','TTS','开源'] },
  { id:'suno', name:'Suno', description:'AI 音乐生成，输入歌词或提示词即可生成完整歌曲', category:'audio', url:'https://suno.com', icon:'🎵', tags:['音乐','歌词','创作'] },
  { id:'udio', name:'Udio', description:'AI 音乐生成，高质量音乐创作平台', category:'audio', url:'https://udio.com', icon:'🎶', tags:['音乐','高质量','创作'] },

  // ── AI 搜索 ──
  { id:'perplexity', name:'Perplexity', description:'AI 答案引擎，实时搜索+深度推理，带引用来源', category:'search', url:'https://perplexity.ai', icon:'🔍', tags:['搜索','实时','引用'], featured:true },
  { id:'youcom', name:'You.com', description:'AI 搜索引擎，集成多种模型和工具', category:'search', url:'https://you.com', icon:'🌐', tags:['搜索','多模型','工具'] },
  { id:'scispace', name:'SciSpace', description:'AI 学术论文阅读与研究助手，解释、总结、对比论文', category:'search', url:'https://scispace.com', icon:'📚', tags:['学术','论文','研究'] },

  // ── 智能体框架 ──
  { id:'langchain', name:'LangChain / LangGraph', description:'LLM 应用开发框架，支持链式调用、Agent 和有状态图', category:'agents', url:'https://langchain.com', icon:'⛓️', tags:['框架','Agent','RAG'], featured:true },
  { id:'crewai', name:'CrewAI', description:'多智能体协作编排框架，定义角色、任务和流程', category:'agents', url:'https://crewai.com', icon:'👥', tags:['多智能体','编排','协作'] },
  { id:'autogen', name:'AutoGen (Microsoft)', description:'微软多智能体对话框架，支持代码执行和工具调用', category:'agents', url:'https://microsoft.github.io/autogen', icon:'🏗️', tags:['多智能体','微软','代码执行'] },
  { id:'dify', name:'Dify', description:'开源 LLM 应用开发平台，可视化工作流和 RAG 管道', category:'agents', url:'https://dify.ai', icon:'🧩', tags:['开源','可视化','工作流'] },

  // ── 效率工具 ──
  { id:'notion-ai', name:'Notion AI', description:'在文档、数据库和笔记中融入 AI 辅助写作与问答', category:'productivity', url:'https://notion.so/product/ai', icon:'📝', tags:['写作','文档','知识库'], featured:true },
  { id:'grammarly', name:'Grammarly', description:'AI 写作助手，语法检查、风格优化和语气调整', category:'productivity', url:'https://grammarly.com', icon:'✍️', tags:['写作','语法','英文'] },
  { id:'otter', name:'Otter.ai', description:'AI 会议助手，实时转录、摘要和行动项提取', category:'productivity', url:'https://otter.ai', icon:'🎙️', tags:['会议','转录','摘要'] },
  { id:'zapier-central', name:'Zapier Central', description:'AI 自动化工作流，连接数千应用实现智能业务流程', category:'productivity', url:'https://zapier.com/central', icon:'⚡', tags:['自动化','工作流','集成'] },

  // ── 基础设施 ──
  { id:'huggingface', name:'Hugging Face', description:'开源模型中心、Spaces 部署和 Datasets 数据集平台', category:'infra', url:'https://huggingface.co', icon:'🤗', tags:['开源','模型库','社区'], featured:true },
  { id:'replicate', name:'Replicate', description:'云端 ML API，一键部署和调用开源模型', category:'infra', url:'https://replicate.com', icon:'🔄', tags:['API','部署','云端'] },
  { id:'together', name:'Together AI', description:'开源和自定义模型的推理 API，支持高速推理', category:'infra', url:'https://together.ai', icon:'🤝', tags:['推理','API','开源'] },
  { id:'groq', name:'Groq', description:'超低延迟 LPU 推理引擎，LLM 推理速度最快之一', category:'infra', url:'https://groq.com', icon:'⚡', tags:['快速','推理','LPU'] },
  { id:'workers-ai', name:'Cloudflare Workers AI', description:'在边缘节点运行 AI 推理，与 Workers 生态深度集成', category:'infra', url:'https://developers.cloudflare.com/workers-ai', icon:'🌍', tags:['边缘','Serverless','Cloudflare'] },
];

// Sort: featured first, then alphabetically
TOOLS.sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  return a.name.localeCompare(b.name, 'zh');
});

TOOLS.forEach((tool) => {
  if (!tool.lastCheckedAt) tool.lastCheckedAt = CATALOG_META.lastCheckedAt;
  if (tool.featured && !tool.recommendReason) tool.recommendReason = '按行业认知度、实用性和当前分类代表性推荐。';
});
