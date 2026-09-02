# CS180 portfolio — Lambert Lin

Live: <https://lambertalpha.github.io/cs180/>

## Layout

```
index.html            首页：夜梅 hero（Three.js）+ 纸面项目列表
style.css             各 project 页共用的纸感样式（Bodoni Moda / Newsreader / IBM Plex Mono）
petals.js             project 页报头的水墨梅枝 + 落瓣（纯 canvas）
proj0/                Project 0 页面与 media/
mei-assets/
  scene.js            夜梅场景：枝干扫掠、花朵/花苞、落瓣、光标花瓣、小蛾、dock、视差、卡片显现
  liquid.js           液态金属按钮（WebGL2 五通道），来自 Sylva，未改
  three.min.js        Three.js r128（本地）
  card-*.jpg          首页两张卡片的图
  index-paper-backup.html   旧的纯纸面首页备份
```

## 加一个新 project

1. 新建 `projN/index.html`，复制 `proj0/index.html` 的骨架，引用 `../style.css` 与 `../petals.js`。
2. 首页 `index.html`：把 `.index` 列表里对应行的 `<span class="soon">` 换成 `<a href="./projN/">`；
   需要的话把「Next up」卡片（`.card--stove`）换成新项目，图放 `mei-assets/card-*.jpg`（1000×520）。
3. 本地预览：`python3 -m http.server 8180` 后开 <http://localhost:8180/>。

## 场景调参（mei-assets/scene.js）

- 枝干走向：`buildNearBough()` / `buildFarBough()` 的控制点，坐标是各自 box 的比例（`ARCH` / `FAR` 定义 box 在 1600×880 舞台上的位置）。
- 花量与大小：`assembleBough(..., { blossoms, buds, blossomSize, budSize })`。
- 落瓣数量：`buildAmbient()` 里的 `COUNT`。
- 调试出口：`window.__mei = { scene, near, far, renderer, camera }`。
- 显现脉冲 7 秒后强制完成（隐藏标签页也不会卡在空场景）。

页面尊重 `prefers-reduced-motion`：静态渲染、无视差、无落瓣。
