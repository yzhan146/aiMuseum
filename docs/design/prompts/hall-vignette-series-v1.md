# AI Museum 九展厅主视觉 Prompt Set v1

每张图都用一次独立的 ImageGen 生成任务。使用时将“共享系列 Prompt”与对应展厅的“场景 Prompt”组合起来，不要把九个场景放在一张图中生成。

## 共享系列 Prompt

```text
Use case: historical-scene
Asset type: vertical 4:5 right-side hero vignette for an AI Museum exhibition entrance, viewed by children age 9–12 and adults.
Primary request: Create a premium museum editorial illustration and historically grounded artistic reconstruction. The image must communicate the exhibition's central historical question through a core object, supporting evidence, and a restrained environmental backdrop.
Style/medium: painterly 2D museum concept art with realistic historic materials, subtle depth, controlled theatrical lighting, and refined children's nonfiction-book clarity; sophisticated and approachable, not cartoonish and not photorealistic enough to be mistaken for a real artifact photograph.
Composition/framing: vertical 4:5; one strong core object in the middle-right, supporting objects in the foreground, quiet historical context behind it, darkened edges that blend into the exhibition's specified web color; strong silhouette at small card size; no frame and no interface elements.
Constraints: historically plausible material culture; explicitly an artistic reconstruction; no readable or invented writing; use only abstract marks, lines, dots, stamps, and blank ruled structure; no text, letters, numbers, names, logo, watermark, caption, border, or UI.
Avoid: modern objects, fantasy clichés, generic stereotypes, weapons, battle spectacle, blood, bodies, horror, sexual content, propaganda, fake legible writing, clutter, and glossy 3D-render aesthetics.
```

## 1. 长安：诗人与世界城市

输出：`tang-changan-hall-vignette-v1.png`

```text
Scene/backdrop: a refined Tang-dynasty display inspired by a Chang'an ward and market crossroads. A partially opened poetry scroll sits beside a travel token and a small ceramic trade vessel. Behind them, layered silhouettes suggest a city gate, tiled roofs, market awnings, and routes extending toward distant regions.
Subject: the poetry scroll is the strongest visual anchor, with handmade paper fibers, silk binding cord, and abstract ink traces. Supporting objects express travel, trade, friendship, and cultural exchange.
Lighting/mood: evening museum glow; curious, cosmopolitan, calm sense of discovery.
Color palette: deep indigo #263f72, lapis blue, aged cream, muted gold, cinnabar accents, small touches of celadon.
Materials/textures: handmade paper, silk cord, glazed ceramic, worn wood, matte lacquer.
```

## 2. 佛法东行与丝路旅行

输出：`tang-buddhism-hall-vignette-v1.png`

```text
Scene/backdrop: a calm Tang-era translation and travel display. An opened manuscript and bound folded folios rest beside a writing brush, inkstone, compact travel bundle, and a route token. Behind them, a translation hall, mountain pass, caravan route, and sea horizon connect inland and maritime journeys.
Subject: the opened manuscript is the visual anchor. Supporting objects show that translation, copying, travel, and teaching required many collaborators.
Lighting/mood: serene amber light; patient, contemplative, adventurous without spectacle.
Color palette: deep teal #1d6170, aged gold, warm parchment, muted vermilion, sea blue-gray.
Materials/textures: handmade paper, silk thread, dark wood, inkstone, woven travel cloth.
```

## 3. 安史之乱：盛世为何转折

输出：`tang-rebellion-hall-vignette-v1.png`

完整独立 Prompt 见 [tang-rebellion-hall-vignette-v1.md](./tang-rebellion-hall-vignette-v1.md)。

```text
Scene/backdrop: a dim Tang-inspired archival gallery. A warm spotlight falls on an aged folded administrative document, a restrained seal impression, and a partially unfolded route map. Distant silhouettes of a city wall and interrupted road suggest the collapse of order and displacement.
Subject: the document is central. Communicate how war changes documents, roads, families, and ordinary life without glorifying combat.
Color palette: deep burgundy #633d3b, faded cinnabar, charcoal, aged cream, muted bronze.
```

## 4. 佛罗伦萨：艺术为何需要赞助人

输出：`renaissance-florence-hall-vignette-v1.png`

```text
Scene/backdrop: a fifteenth-century Florentine workshop display. A partially unrolled commission contract sits beside a wax seal, pigment shells, charcoal stylus, compass, and coin weight. Subtle arcades, workshop shelves, and the distant Florence skyline suggest the city's patronage network.
Subject: the contract is the anchor. Tools and pigments reveal that art required labor, materials, time, money, and agreement.
Lighting/mood: warm north-window light and restrained museum spotlight; curious, industrious, subtly political.
Color palette: olive brown #5c5738, aged parchment, terracotta, muted ultramarine, wax red, antique gold.
Materials/textures: parchment, wax, walnut wood, ground pigment, linen, tarnished brass.
```

## 5. 罗马工作坊：大师如何竞争

输出：`renaissance-rome-hall-vignette-v1.png`

```text
Scene/backdrop: an early-sixteenth-century Roman workshop still life with no people. A large folded fresco preparation sheet and overlapping sketch papers rest on a wooden table beside charcoal, red chalk, a compass, pounce wheel, pigment bowl, and folded linen. A tall stone arch and partly prepared plaster wall suggest a monumental commission.
Subject: layered paper, revised abstract lines, erased contours, pinholes, and working tools are central. Do not reproduce any known artwork or anatomy study.
Lighting/mood: raking studio light revealing corrections and paper texture; energetic, thoughtful, safe.
Color palette: deep oxblood #673e3b, warm plaster, chalk white, charcoal gray, muted terracotta.
Materials/textures: rag paper, charcoal, chalk, lime plaster, worn wood, ceramic.
```

## 6. 从日心说到望远镜

输出：`renaissance-observation-hall-vignette-v1.png`

```text
Scene/backdrop: an early-seventeenth-century European study and observatory display. A simple wooden-and-brass telescope rests beside a circular astronomical diagram, compass, and printed pages. A window reveals a crescent moon and subtle planetary paths; a quiet hand press silhouette suggests public circulation of ideas.
Subject: the telescope is the visual anchor. Geometric charts contain lines and dots only, without labels or formulas.
Lighting/mood: cool moonlight balanced with warm study light; wonder, precision, intellectual courage.
Color palette: deep navy #173d5c, muted brass, aged cream, slate blue, amber highlights.
Materials/textures: worn wood, brass, handmade paper, glass lens, ink.
```

## 7. 索尔维会议：自然是概率的吗

输出：`physics-solvay-hall-vignette-v1.png`

```text
Scene/backdrop: a formal early-twentieth-century European conference room. A framed sepia artistic reconstruction of a group conference portrait sits behind a round table. The distant adults are fully clothed, deliberately indistinct, and not exact likenesses. On the table are facing notebooks and two contrasting abstract diagrams; a chalkboard carries only lines, dots, and geometric traces.
Subject: the shared table, shared evidence, and different diagram arrangements express intellectual disagreement. The framed image must read as a reconstruction, not an authentic photograph.
Lighting/mood: soft conference-room daylight with warm museum accents; thoughtful, collaborative, intellectually tense but calm.
Color palette: charcoal gray #4e4640, sepia, warm taupe, aged ivory, muted brass.
Materials/textures: matte photographic paper, wool upholstery, dark wood, chalk, handmade paper.
```

## 8. 原子内部：理论与实验

输出：`physics-atom-hall-vignette-v1.png`

```text
Scene/backdrop: an early-to-mid-twentieth-century laboratory display with no people. A cloud-chamber viewing plate with delicate curved particle tracks is central, beside a brass-and-glass detector, photographic plates, blank ruled notebook, and dials without numbers. Subtle arcs behind it imply changing atomic models.
Subject: physically plausible experimental tracks are the clearest feature; they look like indirect evidence, not fireworks or fantasy magic.
Lighting/mood: cool controlled laboratory light with restrained cyan glow; curiosity, patience, evidence.
Color palette: deep teal #164f59, oxidized brass, charcoal, glass blue, pale cyan, aged ivory.
Materials/textures: glass, brass, matte steel, photographic emulsion, paper, dark wood.
```

## 9. 流亡、战争与科学责任

输出：`physics-responsibility-hall-vignette-v1.png`

```text
Scene/backdrop: a restrained 1930s–1950s archival travel display with no people. An open travel-document folder and folded letters sit beside spectacles, a fountain pen, a blank luggage tag, and a packed leather suitcase. Behind them, a railway platform, ocean-liner gangway, and darkened laboratory window suggest departure and uncertain choices.
Subject: documents, letters, and suitcase form the central triangle. Do not identify a real person and do not show national symbols or readable document details.
Lighting/mood: subdued station light and warm desk lamp; reflective, morally serious, humane, safe for children.
Color palette: slate blue-gray #334553, worn leather brown, aged ivory, muted red wax, cold steel, amber highlights.
Materials/textures: paper, cloth-bound folder, leather, brass clasp, glass, dark wood.
```

## 使用边界

- 所有图片必须在界面标记为“历史主题艺术重建”。
- 图片不是史料证据；史料 Claim、展签和来源必须保持为独立的可访问文本。
- 正式上线前必须进行史实、时代物质文化、儿童安全、伪文字和许可审核。
- 发现生成图出现可读伪文字、现代物件或冒充真实档案的细节时，必须替换，而不是在文案中掩盖。
