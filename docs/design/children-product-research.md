# 面向小学年龄用户的产品设计调研

- 日期：2026-07-16
- 用途：AI Museum Stage 3 设计修订
- 说明：以下结论用于寻找可迁移的设计模式，不代表复制任何单一产品的视觉风格。

## 1. 观察样例

### PBS KIDS

PBS KIDS 将儿童体验组织在熟悉角色和具体活动周围，核心分类是 Games、Videos 等直接行动。其产品说明强调“有趣且安全”的学习游戏。可迁移模式是：角色承担导航锚点，入口用儿童能理解的行动表达，而不是抽象信息架构。

- https://pbskids.org/apps/play-pbs-kids-games
- https://pbskids.org/sesame/games/ernies-dinosaur-daycare/

### National Geographic Kids

National Geographic Kids 依靠强图片、短标题、视频/阅读等少量内容类型组织科学与历史主题。可迁移模式是：真实材料和视觉场景本身提供吸引力，不一定需要额外游戏化层。

- https://kids.nationalgeographic.com/science/
- https://kids.nationalgeographic.com/history

### Scratch

Scratch 主要面向 8–16 岁，说明这个年龄段可以使用具有真实创造力的工具；其家长说明强调逐步指南、即时反馈、创造性学习和有限收集儿童注册信息。可迁移模式是：不要低估儿童能力，但要让第一步明确、反馈及时、隐私边界清楚。

- https://scratch.mit.edu/help/parents/

### Khan Academy Kids

Khan Academy Kids 强调自适应学习路径和中断后继续下一活动。其主要年龄比 AI Museum 更低，因此不直接借用幼儿角色风格；可迁移的是“单一路径、自动续接、减少成人帮助”的连续体验。

- https://www.khanacademy.org/kids
- https://khankids.zendesk.com/hc/en-us/articles/360014856151-Learning-Topics-Using-Khan-Academy-Kids-in-Educational-Settings

## 2. 儿童权益与隐私约束

UNICEF 将儿童最佳利益、安全、包容和发展置于数字产品设计中心。英国 ICO 的 Children’s Code 进一步要求高隐私默认、数据最小化、限制分享，并禁止用诱导手段让儿童提供不必要数据或降低隐私保护。

- https://www.unicef.org/innocenti/projects/childrens-best-interests-digital-world
- https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/

对 AI Museum 的直接约束：

- 不用“人物会伤心”“告诉我更多我才能记住你”等情感诱导获得信息。
- 不用连续签到、排行榜或损失厌恶推动回访。
- 记忆和个性化采用低敏、最小、可见、可纠正和可暂停原则。
- 隐私说明必须使用儿童可以理解的语言，但不能隐藏真实影响。

## 3. 设计推论

这是根据样例和规范形成的项目判断，而不是来源的直接结论：

1. 对 9–12 岁儿童，“轻快”应接近现代互动杂志和探索地图，不应照搬学龄前动画产品。
2. 每个屏幕只保留一个任务，最多三个注意焦点；兴趣通过场景、人物和内容变化维持。
3. 真实历史照片、物件、地点和关系本身就是视觉资产，应优先于无意义装饰。
4. 对话是核心舞台，来源、图谱和时间线按需进入，避免桌面分析工具式三栏布局。
5. 成人维护者虽能理解复杂历史，但不应被假设懂技术，因此采用逐步向导、直白术语和单条审核。

## 4. 仍需真实用户验证

公开网站只能提供模式参考，不能替代目标用户研究。在工程原型阶段至少应邀请：

- 5–8 名 9–12 岁儿童完成首次提问、查看来源、切换人物和纠正记忆；
- 3–5 名非技术成人完成创建人物、登记来源和审核一条候选知识。

观察任务完成、误点、求助、犹豫和理解偏差，不以“喜欢这个颜色吗”作为主要结论。
