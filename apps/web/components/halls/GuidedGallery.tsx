"use client";

import type { ExhibitPack, HallVisitState, MuseumObject } from "@ai-museum/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import type { HallSceneCharacter } from "./HallScene";

type Citation = { title: string; url?: string; locator?: string };
type GuideMessage = { role: "visitor" | "guide"; content: string; citations?: Citation[] };

type Props = {
  pack: ExhibitPack;
  progress?: HallVisitState | null;
  mode: "child" | "adult";
  characters: HallSceneCharacter[];
  onSelectCharacter: (id: string) => void;
  onReturn: () => void;
  onOpenMap: () => void;
  onNextHall?: (id: string) => void;
};

const factLabels = {
  established: "史料明确",
  interpretation: "研究判断",
  disputed: "仍有不确定",
} as const;

function openingLine(hallId: string, guideId: string, stationId: string) {
  const hallLines: Record<string, Record<string, Record<string, string>>> = {
    "renaissance-florence": {
    "leonardo-da-vinci": {
      city: "先别急着寻找“天才”。你看，这座城市先提出了什么难题，又召集了多少双手来回答？",
      workshop: "靠近一些看。画面不会掩盖所有制作痕迹——观察哪里已经完成，哪里还在试探。",
      patrons: "委托人买下的不只是颜料和木板。他们也在安排自己希望被别人怎样看见。",
      symbol: "作品离开工坊以后，观看它的人会继续改变它。你觉得这尊雕像在警惕谁？",
    },
    michelangelo: {
      city: "一扇这样的铜门，不会靠一句灵感铸成。先算算材料、年月，以及一遍遍失败的代价。",
      workshop: "别让签名骗了你。大作品背后总有训练、助手和脏得洗不掉的双手。",
      patrons: "出钱的人当然会开口，但材料也会反驳，艺术家更不该只会点头。",
      symbol: "这块石头先被别人放弃，后来又被城市改变了去处。作品的命运从不只在工作室里决定。",
    },
    },
    "renaissance-rome": {
      raphael: {
        sketch: "先看纸上的犹豫。每一道被改过的轮廓，都比‘我一开始就知道答案’更接近真实的工作。",
        cartoon: "画稿必须让远方的织工也读得懂。构图到了这里，既是图像，也是给协作者的指令。",
        workshop: "我的名字很醒目，但这样一整间宫殿不可能只靠一双手。你不妨先找找工作坊留下的尺度。",
        prints: "墙面留在罗马，版画却会远行。风格传播得越快，作者与复制者的关系就越值得追问。",
      },
      michelangelo: {
        sketch: "别急着看成品。纸上的肩、背和脚，才会告诉你一个动作经过多少次不满意。",
        cartoon: "把图放到这么大，不是为了气派，是为了让别人能接手。材料会逼迫想法学会说清楚。",
        workshop: "大师的名声可以盖过许多助手。先看工程尺度，再问一个人究竟能亲手完成多少。",
        prints: "刻刀不是画笔，黑白也不是颜色的残缺。换一种材料，设计就必须重新被发明。",
      },
    },
    "renaissance-observation": {
      galileo: {
        model: "一张宇宙图可以很有说服力，但先别把整齐当成证明。我们还要问，它预测得准不准。",
        measure: "数字若总差那么一点，就不能永远怪观测者。真正麻烦的证据，常从小小的偏差开始。",
        telescope: "镜筒让我看见新东西，也可能让我看见镜片的缺陷。重要的是记录、重复，再请别人来看。",
        debate: "证据一旦印出来，就不再只属于观察者。读者会检查它，权威也会回应它。",
      },
      "johannes-kepler": {
        model: "哥白尼换了宇宙的中心，但一张新图只是开始。模型还要接受那些不肯变整齐的数据。",
        measure: "火星只差了几个角分，却足够逼我放弃圆。请留意：难题不是误差大，而是误差持续出现。",
        telescope: "望远镜带来现象，计算负责追问这些现象与整个体系是否相容。两者缺一不可。",
        debate: "我可以支持伽利略的发现，也不必赞同他的每一种论证。公开讨论的价值正在这里。",
      },
    },
  };
  return hallLines[hallId]?.[guideId]?.[stationId] ?? "你先看，我会在旁边；需要时直接问我。";
}

function conclusionCopy(hallId: string) {
  if (hallId === "renaissance-rome") return {
    title: "大师既是创作者，也是组织者；竞争改变了试错、协作和传播的方式，却也让许多双手藏进一个签名。",
    body: "现在你可以回头寻找被忽略的劳动，也可以跟随下一座展厅，看证据怎样改变人们理解宇宙的方式。",
  };
  if (hallId === "renaissance-observation") return {
    title: "新宇宙不是被一件仪器突然证明的：模型、精密数据、望远镜记录和公开争论共同改变了可信的标准。",
    body: "现在你可以回头复查证据链，也可以继续认识伽利略或开普勒，追问他们仍然无法回答的问题。",
  };
  return {
    title: "天才没有被城市制造，但城市不断给了他们难题、材料、同伴和观众。",
    body: "现在你可以回头细看某件作品，也可以去认识相关人物或进入下一座展厅。",
  };
}

export function GuidedGallery({ pack, progress, mode, characters, onSelectCharacter, onReturn, onOpenMap, onNextHall }: Props) {
  const { hall, assets, objects, sources } = pack;
  const experience = hall.experience!;
  const initialStationId = hall.stations.some((station) => station.id === progress?.lastStationId)
    ? progress!.lastStationId
    : hall.stations[0].id;
  const [stationId, setStationId] = useState(initialStationId);
  const [introVisible, setIntroVisible] = useState(!progress?.viewedObjectIds.length);
  const [guideStatus, setGuideStatus] = useState<"offered" | "browsing_alone" | "active">("offered");
  const [guideId, setGuideId] = useState<string>();
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [guideInput, setGuideInput] = useState("");
  const [guideBusy, setGuideBusy] = useState(false);
  const [guideNotice, setGuideNotice] = useState("");
  const [routeReminderUsed, setRouteReminderUsed] = useState(false);
  const [midpointHandled, setMidpointHandled] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [focusedObjectIndex, setFocusedObjectIndex] = useState(0);
  const [guidePanelOpen, setGuidePanelOpen] = useState(false);
  const [selectedObjectId, setSelectedObjectId] = useState<string>();
  const [failedAssetIds, setFailedAssetIds] = useState<string[]>([]);
  const [viewed, setViewed] = useState(progress?.viewedObjectIds ?? []);
  const [visited, setVisited] = useState(progress?.visitedCharacterIds ?? []);
  const [completed, setCompleted] = useState(progress?.completedStationIds ?? []);
  const revisionRef = useRef(progress?.revision ?? 0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLElement | null>(null);
  const station = hall.stations.find((item) => item.id === stationId) ?? hall.stations[0];
  const stationIndex = hall.stations.findIndex((item) => item.id === station.id);
  const stationObjects = station.objectIds.map((id) => objects.find((object) => object.id === id)).filter((object): object is MuseumObject => Boolean(object));
  const focusedObject = stationObjects[focusedObjectIndex] ?? stationObjects[0];
  const selectedObject = objects.find((object) => object.id === selectedObjectId);
  const entranceAsset = assets.find((asset) => asset.id === hall.theme.lightAssetId) ?? assets[0];
  const guides = useMemo(() => experience.guideCharacterIds.map((id) => characters.find((character) => character.id === id)).filter((character): character is HallSceneCharacter => Boolean(character)), [characters, experience.guideCharacterIds]);
  const guide = guides.find((character) => character.id === guideId);
  const alternateGuide = guides.find((character) => character.id !== guideId);

  useEffect(() => {
    setStationId(initialStationId);
    setIntroVisible(!progress?.viewedObjectIds.length);
    setViewed(progress?.viewedObjectIds ?? []);
    setVisited(progress?.visitedCharacterIds ?? []);
    setCompleted(progress?.completedStationIds ?? []);
    revisionRef.current = progress?.revision ?? 0;
    setGuideStatus("offered");
    setGuideId(undefined);
    setMessages([]);
    setMidpointHandled(false);
    setRouteReminderUsed(false);
    setRouteOpen(false);
    setFocusedObjectIndex(0);
    setGuidePanelOpen(false);
    setFailedAssetIds([]);
  }, [hall.id, initialStationId, progress?.revision]);

  useEffect(() => {
    if (!selectedObjectId) return;
    drawerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && closeObject();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [selectedObjectId]);

  useEffect(() => {
    if (!guidePanelOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setGuidePanelOpen(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [guidePanelOpen]);

  function save(nextStation: string, nextViewed = viewed, nextCompleted = completed, nextVisited = visited) {
    const run = saveQueueRef.current.catch(() => undefined).then(async () => {
      const send = (expectedRevision: number) => fetch(`/api/halls/${hall.id}/progress`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sceneVersion: hall.sceneVersion, lastStationId: nextStation, viewedObjectIds: nextViewed, visitedCharacterIds: nextVisited, completedStationIds: nextCompleted, expectedRevision }),
      });
      try {
        let response = await send(revisionRef.current);
        let result = await response.json();
        if (response.status === 409 && result.state) {
          revisionRef.current = result.state.revision;
          response = await send(revisionRef.current);
          result = await response.json();
        }
        if (result.state) revisionRef.current = result.state.revision;
      } catch {
        // Static visiting remains available while progress persistence is offline.
      }
    });
    saveQueueRef.current = run;
    return run;
  }

  function visitStation(nextId: string) {
    const nextCompleted = nextId === station.id ? completed : [...new Set([...completed, station.id])];
    setCompleted(nextCompleted);
    setStationId(nextId);
    setFocusedObjectIndex(0);
    setRouteOpen(false);
    setIntroVisible(false);
    void save(nextId, viewed, nextCompleted);
    if (guideId) setMessages((current) => [...current, { role: "guide" as const, content: openingLine(hall.id, guideId, nextId) }].slice(-8));
    if (guideId && nextId === experience.midpointStationId && !midpointHandled) setGuidePanelOpen(true);
    setGuideNotice("");
  }

  function chooseGuide(nextGuideId: string) {
    const nextVisited = [...new Set([...visited, nextGuideId])];
    setVisited(nextVisited);
    setGuideId(nextGuideId);
    setGuideStatus("active");
    setGuidePanelOpen(false);
    setIntroVisible(false);
    setMessages([{ role: "guide", content: openingLine(hall.id, nextGuideId, station.id) }]);
    setGuideNotice("");
    void save(station.id, viewed, completed, nextVisited);
  }

  function dismissGuide() {
    setGuideStatus("browsing_alone");
    setGuideId(undefined);
    setMessages([]);
    setGuidePanelOpen(false);
    setGuideNotice("好的，接下来不会有人主动打断你。需要时可以随时再邀请。 ");
  }

  function openObject(objectId: string) {
    drawerTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const nextViewed = [...new Set([...viewed, objectId])];
    const nextCompleted = stationIndex === hall.stations.length - 1 ? [...new Set([...completed, station.id])] : completed;
    setViewed(nextViewed);
    setCompleted(nextCompleted);
    setSelectedObjectId(objectId);
    void save(station.id, nextViewed, nextCompleted);
  }

  function closeObject() {
    setSelectedObjectId(undefined);
    requestAnimationFrame(() => drawerTriggerRef.current?.focus());
  }

  function markAssetFailed(assetId: string) {
    setFailedAssetIds((current) => current.includes(assetId) ? current : [...current, assetId]);
  }

  async function askGuide(message = guideInput.trim()) {
    if (!guideId || !message || guideBusy) return;
    const visitorMessage: GuideMessage = { role: "visitor", content: message };
    const nextMessages = [...messages, visitorMessage];
    setMessages(nextMessages);
    setGuideInput("");
    setGuideBusy(true);
    setGuideNotice("");
    try {
      const response = await fetch(`/api/halls/${hall.id}/guide`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterId: guideId,
          stationId: station.id,
          objectId: selectedObject?.id ?? focusedObject?.id,
          message,
          history: nextMessages.slice(-6),
          ageBand: mode === "child" ? "13-15" : "16+",
          routeReminderUsed,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "人物暂时无法回答");
      if (result.action === "dismiss") {
        setGuideNotice(result.answer ?? "好的，你可以自己慢慢看。");
        setGuideStatus("browsing_alone");
        setGuideId(undefined);
        setMessages([]);
        return;
      }
      if (result.action === "switch" && result.nextCharacterId) {
        setGuideNotice(result.answer ?? "已切换导览人物，路线与展品保持不变。");
        chooseGuide(result.nextCharacterId);
        return;
      }
      if (result.routeReminderUsed) setRouteReminderUsed(true);
      setMessages((current) => [...current, { role: "guide", content: result.answer, citations: result.citations }]);
      if (result.mode === "rules") setGuideNotice("当前使用馆藏讲解模式；自由参观不受影响。 ");
    } catch (error) {
      setGuideNotice(error instanceof Error ? `${error.message}。你仍可继续查看全部展品。` : "人物暂时无法回答，你仍可继续查看全部展品。");
    } finally {
      setGuideBusy(false);
    }
  }

  const style = {
    "--hall-deep": hall.theme.tokens.bgDeep,
    "--hall-soft": hall.theme.tokens.bgSoft,
    "--hall-surface": hall.theme.tokens.surface,
    "--hall-ink": hall.theme.tokens.ink,
    "--hall-accent": hall.theme.tokens.accent,
    "--hall-highlight": hall.theme.tokens.highlight,
  } as React.CSSProperties;

  return <section className={`guided-gallery immersive-${mode}`} style={style}>
    <header className="hall-scene-topbar">
      <button className="hall-back" type="button" onClick={onReturn}>← 返回时期馆</button>
      <span>{hall.entrance.kicker}</span>
      <button className="hall-map-link" type="button" onClick={onOpenMap}>关系与时间线</button>
    </header>

    <section className={`guided-entrance ${introVisible ? "expanded" : "compact"}`}>
      {!failedAssetIds.includes(entranceAsset.id)
        ? <img src={entranceAsset.path} width={entranceAsset.width} height={entranceAsset.height} alt={entranceAsset.alt} onError={() => markAssetFailed(entranceAsset.id)} />
        : <div className="guided-image-fallback entrance"><b>展馆环境图暂时无法加载</b><span>四幕路线、展品说明和人物导览仍可继续使用。</span></div>}
      <div className="guided-entrance-shade" aria-hidden="true" />
      <div className="guided-entrance-copy">
        <small>{hall.entrance.kicker}</small>
        <h1>{hall.title}</h1>
        <p>{hall.question}</p>
        <span>{experience.recommendedMinutes} 分钟推荐路线 · {experience.quickMinutes} 分钟也能自由速览</span>
        {introVisible && <div className="guided-entrance-actions">
          <button className="primary" type="button" onClick={() => visitStation(hall.stations[0].id)}>{hall.entrance.primaryActionLabel}</button>
          <button className="secondary" type="button" onClick={() => { setIntroVisible(false); document.querySelector(".guided-route-summary")?.scrollIntoView({ behavior: "smooth" }); }}>我想自由参观</button>
        </div>}
      </div>
      <span className="representation-label">艺术化虚构展馆 · 非真实建筑复原</span>
    </section>

    {introVisible && <section className="guided-welcome">
      <div>
        <small>参观方式</small>
        <h2>路线为你准备，选择权留给你</h2>
        <p>{hall.guideText}</p>
      </div>
      <aside>
        <small>门口的接待者 · 可选</small>
        <h3>需要有人陪你一起看吗？</h3>
        <div className="guided-guide-cards">{guides.map((character) => <button type="button" key={character.id} onClick={() => chooseGuide(character.id)}>
          <span>{character.portrait ? <img src={character.portrait} alt="" /> : character.name.slice(0, 1)}</span>
          <b>{character.name}</b>
          <small>{character.summary}</small>
        </button>)}</div>
        <button className="quiet" type="button" onClick={() => { setGuideStatus("browsing_alone"); setIntroVisible(false); }}>我先自己看看</button>
      </aside>
    </section>}

    <section className="guided-route-summary" aria-label="推荐参观路线">
      <div>
        <small>主线进度 · 第 {station.order} 幕 / {hall.stations.length}</small>
        <b>{station.title}</b>
      </div>
      <button className="secondary" type="button" aria-expanded={routeOpen} onClick={() => setRouteOpen((value) => !value)}>
        {routeOpen ? "收起路线" : "查看全部路线"}
      </button>
    </section>
    {routeOpen && <nav className="guided-route-menu" aria-label="四幕路线">
      {hall.stations.map((item) => <button key={item.id} type="button" className={item.id === station.id ? "active" : completed.includes(item.id) ? "visited" : ""} onClick={() => visitStation(item.id)} aria-current={item.id === station.id ? "step" : undefined}>
        <small>第 {item.order} 幕</small><span>{item.title}</span>
      </button>)}
    </nav>}

    <main className="guided-stage">
        <header>
          <small>第 {station.order} 幕 · 推荐路线</small>
          <h2>{station.title}</h2>
          <p>{station.body}</p>
          {station.question && <blockquote>{station.question}</blockquote>}
        </header>
        {focusedObject && (() => {
          const asset = assets.find((item) => item.id === focusedObject.assetId);
          return <article className="guided-object guided-object-focus" key={focusedObject.id}>
            <div className="guided-object-image" aria-hidden="true">
              {asset && !failedAssetIds.includes(asset.id)
                ? <img src={asset.path} width={asset.width} height={asset.height} loading={stationIndex === 0 ? "eager" : "lazy"} alt={asset.alt} onError={() => markAssetFailed(asset.id)} />
                : <span className="guided-image-fallback"><b>作品图像暂不可用</b><small>{focusedObject.name}的展签与来源仍可查看</small></span>}
            </div>
            <div>
              <small>{stationObjects.length > 1 ? `本幕展品 ${focusedObjectIndex + 1} / ${stationObjects.length} · ` : ""}{focusedObject.factStatus ? factLabels[focusedObject.factStatus] : "馆藏展品"} · {focusedObject.dateLabel}</small>
              <h3>{focusedObject.name}</h3>
              {focusedObject.creatorLabel && <p>{focusedObject.creatorLabel}</p>}
              <b>{focusedObject.shortLabel}</b>
              <button className="primary" type="button" onClick={() => openObject(focusedObject.id)}>{viewed.includes(focusedObject.id) ? "再次打开完整展签" : "打开完整展签"}</button>
            </div>
          </article>;
        })()}
        {guideStatus === "active" && guide ? <aside className={`guided-companion ${guideId === "michelangelo" ? "michelangelo" : ""}`}>
          <span>{guide.portrait ? <img src={guide.portrait} alt="" /> : guide.name.slice(0, 1)}</span>
          <div><small>{guide.name} · 可选陪伴</small><p>{messages.at(-1)?.content ?? openingLine(hall.id, guide.id, station.id)}</p></div>
          <button className="secondary" type="button" onClick={() => setGuidePanelOpen(true)}>和他聊聊</button>
        </aside> : <aside className="guided-companion invite">
          <div><small>人物导览 · 可选</small><p>{guideNotice || "想听历史人物怎样理解眼前这件展品？"}</p></div>
          <button className="secondary" type="button" onClick={() => setGuidePanelOpen(true)}>邀请讲解</button>
        </aside>}
        {station.transition && <p className="guided-transition"><small>这一幕的连接</small>{station.transition}</p>}
        {stationIndex === hall.stations.length - 1 && <section className="guided-conclusion">
          <small>离场前 · 把 {objects.length} 件展品重新连起来</small>
          <h2>{conclusionCopy(hall.id).title}</h2>
          <p>{conclusionCopy(hall.id).body}</p>
          <div>
            <button className="primary" type="button" onClick={() => guide ? onSelectCharacter(guide.id) : guides[0] && onSelectCharacter(guides[0].id)}>继续认识历史人物</button>
            {hall.exit.nextHallId && onNextHall && <button className="secondary" type="button" onClick={() => onNextHall(hall.exit.nextHallId!)}>进入下一展厅</button>}
          </div>
        </section>}
        <footer className="guided-stage-nav single-focus">
          <button className="quiet" type="button" disabled={stationIndex <= 0 && focusedObjectIndex <= 0} onClick={() => focusedObjectIndex > 0 ? setFocusedObjectIndex((value) => value - 1) : visitStation(hall.stations[stationIndex - 1]?.id)}>
            {focusedObjectIndex > 0 ? "← 上一件作品" : "← 上一幕"}
          </button>
          {focusedObjectIndex < stationObjects.length - 1 ? <button className="primary" type="button" onClick={() => setFocusedObjectIndex((value) => value + 1)}>下一件作品 →</button> : <button className="primary" type="button" disabled={stationIndex >= hall.stations.length - 1} onClick={() => visitStation(hall.stations[stationIndex + 1]?.id)}>进入下一幕 →</button>}
        </footer>
      </main>

    {guidePanelOpen && <div className="guided-guide-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setGuidePanelOpen(false); }}>
      <aside className={`guided-dock ${guideId === "michelangelo" ? "michelangelo" : ""}`} role="dialog" aria-modal="true" aria-label="人物导览">
        {guideStatus === "active" && guide ? <>
          <header>
            <span>{guide.portrait ? <img src={guide.portrait} alt="" /> : guide.name.slice(0, 1)}</span>
            <div><small>正在陪伴你</small><h3>{guide.name}</h3></div>
            <button type="button" aria-label="收起人物导览" onClick={() => setGuidePanelOpen(false)}>×</button>
          </header>
          <div className="guided-dock-actions">
            {alternateGuide && <button type="button" onClick={() => chooseGuide(alternateGuide.id)}>换成{alternateGuide.name}</button>}
            <button type="button" onClick={dismissGuide}>我想自己看看</button>
          </div>
          {station.id === experience.midpointStationId && alternateGuide && !midpointHandled && <section className="guided-encounter">
            <small>行程过半 · 遇见另一位同行者</small>
            <b>{alternateGuide.name}也站在这件作品前。</b>
            <p>路线不会改变。你想换一种讲解视角吗？</p>
            <div><button type="button" onClick={() => { chooseGuide(alternateGuide.id); setMidpointHandled(true); }}>换一位同行</button><button type="button" onClick={() => { setMidpointHandled(true); setGuidePanelOpen(false); }}>继续和{guide.name}</button></div>
          </section>}
          <div className="guided-messages" aria-live="polite">
            {messages.map((message, index) => <article key={`${message.role}-${index}`} className={message.role}>
              <p>{message.content}</p>
              {message.citations?.length ? <details><summary>本次讲解依据</summary>{message.citations.map((citation) => citation.url ? <a key={`${citation.title}-${citation.url}`} href={citation.url} target="_blank" rel="noreferrer">{citation.title}</a> : <span key={citation.title}>{citation.title}</span>)}</details> : null}
            </article>)}
            {guideBusy && <p className="guided-thinking">正在结合当前展品回答…</p>}
          </div>
          {focusedObject?.observationPrompt && <button className="guided-suggestion" type="button" disabled={guideBusy} onClick={() => void askGuide(focusedObject.observationPrompt!)}>{focusedObject.observationPrompt}</button>}
          <form className="guided-composer" onSubmit={(event) => { event.preventDefault(); void askGuide(); }}>
            <input value={guideInput} onChange={(event) => setGuideInput(event.target.value)} maxLength={600} aria-label={`向${guide.name}询问当前展品`} placeholder="直接问这件作品…" />
            <button type="submit" disabled={guideBusy || !guideInput.trim()}>发送</button>
          </form>
        </> : <section className="guided-invite">
          <button className="guided-invite-close" type="button" aria-label="关闭人物邀请" onClick={() => setGuidePanelOpen(false)}>×</button>
          <small>{guideNotice ? "已回到自由参观" : "可选人物导览"}</small>
          <h3>{guideNotice || "想听人物怎么理解眼前这件展品？"}</h3>
          <p>邀请不会改变路线，也不会解锁或隐藏任何展品。</p>
          {guides.map((character) => <button className="primary" type="button" key={character.id} onClick={() => chooseGuide(character.id)}>邀请{character.name}</button>)}
        </section>}
      </aside>
    </div>}

    {selectedObject && <div className="guided-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeObject(); }}>
      <aside ref={drawerRef} className="guided-object-drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="guided-object-title">
        <header><div><small>{selectedObject.factStatus ? factLabels[selectedObject.factStatus] : "馆藏展品"}</small><h2 id="guided-object-title">{selectedObject.name}</h2></div><button type="button" onClick={closeObject} aria-label="关闭展品详情">×</button></header>
        {(() => {
          const asset = assets.find((item) => item.id === selectedObject.assetId);
          return asset && !failedAssetIds.includes(asset.id)
            ? <figure><img src={asset.path} width={asset.width} height={asset.height} alt={asset.alt} onError={() => markAssetFailed(asset.id)} /><figcaption>{selectedObject.licenseNote}</figcaption></figure>
            : <div className="guided-image-fallback drawer"><b>作品图像暂不可用</b><span>你仍可阅读完整展签、观察提示与馆藏来源。</span></div>;
        })()}
        <dl>
          <div><dt>作者与年代</dt><dd>{selectedObject.creatorLabel}<br />{selectedObject.dateLabel}{selectedObject.placeLabel ? ` · ${selectedObject.placeLabel}` : ""}</dd></div>
          <div><dt>你正在看什么</dt><dd>{selectedObject.description}</dd></div>
          <div><dt>为什么现在看它</dt><dd>{selectedObject.significance}</dd></div>
          <div><dt>观察入口</dt><dd>{selectedObject.observationPrompt}</dd></div>
        </dl>
        <section><small>馆藏与图像来源</small>{sources.filter((source) => selectedObject.sourceIds.includes(source.id)).map((source) => <article key={source.id}><b>{source.title}</b><p>{source.note}</p>{source.url && <a href={source.url} target="_blank" rel="noreferrer">打开来源 ↗</a>}</article>)}</section>
        <div className="guided-drawer-actions">{guide ? <button className="primary" type="button" onClick={() => { setSelectedObjectId(undefined); setGuideInput(`你会怎样看${selectedObject.name}？`); setGuidePanelOpen(true); }}>问问{guide.name}</button> : <button className="primary" type="button" onClick={() => { setSelectedObjectId(undefined); setGuidePanelOpen(true); }}>邀请人物一起看</button>}<button className="secondary" type="button" onClick={closeObject}>继续自己看</button></div>
      </aside>
    </div>}
  </section>;
}
