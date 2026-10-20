# 一苇 · 协作约定与经验

古文观止入门学习 PWA（GitHub Pages：https://zxy8125ss.github.io/yiwei/ ，仓库名全小写）。

## 用户要的
- 以「读懂」为主；按三阶段共 40 篇由易到难（篇目见 `data/catalog.json`），先做第一阶段 12 篇，后两阶段再铺。
- 每篇：导读（作者/背景/脉络/一句话主旨/读法提示）、逐句注释+译文、注音、重点字词卡、遮字自测、到期复习。
- **注音只标**：生僻字、通假字（标"通×"）、多音字/古今异读。常用字不标，宁少勿滥。
- 朗读：用户选了「每篇放名家朗读的具体页面链接，逐个打开核实后再放」。没核实过的链接一律不放（`@listen` 行）。云端打不开视频平台页面，需在用户电脑在线时用浏览器核实。
- 视觉：宣纸书卷风——米白纸色、墨色正文、朱砂红点缀、竖排标题；细线、无阴影、无纹理（用户嫌米黄格子纸、厚阴影、满屏粗宋体「土」）。
- 篇目与标题以中华书局 2008 版《古文观止》（葛兆光题解、戴燕注解，ISBN 9787101062250）为准，用户会配这本纸书读。

## 内容怎么做
- 精讲稿在 `src/content/*.txt`，格式：`@` 元信息、`#p` 分段、`=` 句子（`=*` 名句）、`~` 注释（`|` 分隔）、`>` 译文、`@word 字|例句|释义|类型`。
  注音写法：`{字:拼音}`、通假 `{字:拼音:通“×”}`。
- 原文底本：开源 Ancient-China-Books/guwenguanzhi（MIT，吴氏原本，繁体）→ `src/extract.py` 抽取转简体存 `src/source.json`。
- `python3 -I src/build.py data` 编译出 `data/texts.json`，并与底本**逐字比对**，报告所有差异。底本与课本写法不同时一律从底本，在注释里注明课本写法；真要用异文用 `@allow 底本=本稿`。
- 写完跑 `python3 -I src/fixq.py src/content/*.txt` 把英文引号换成中文引号。
- 新增篇目后要重新生成字体子集：`src/subset.sh`（需要先 `npm pack @expo-google-fonts/noto-serif-sc` 解到 `/home/claude/yiwei-work/fonts/package`，脚本里路径按需改），字体文件名带 `?v=` 版本参数，改了要升。

## 技术要点
- 纯静态：`index.html` + `style.css` + `app.js` + `sw.js`，数据在 `data/`。
- 版本号三处一起改：`app.js` 的 `VERSION`、`version.json`、`sw.js` 的 `CACHE`（以及 index.html / sw.js 里的 `?v=`）。打开或切回 App 时检查 version.json，有新版直接刷新；自测进行中则等做完再刷新。
- 记录存 localStorage（`yw.state.v1`），每天自动留本机快照 7 份（`yw.snaps.v1`）；「我的」页可导出/导入备份文件。**永远不让用户删主屏幕图标**（会丢记录）。
- 交付前：`python3 src/shots.py`（390px 截图、深浅色、横向溢出检查）、`python3 src/flow.py`（交互逐个点一遍），都要先 `python3 -m http.server 8765` 起本地服务。
