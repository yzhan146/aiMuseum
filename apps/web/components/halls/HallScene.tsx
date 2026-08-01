"use client";

import type { ExhibitPack, HallVisitState } from "@ai-museum/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuidedGallery } from "./GuidedGallery";

export type HallSceneCharacter = {
  id: string;
  name: string;
  life: string;
  summary: string;
  portrait?: string;
};

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

export function HallScene(props: Props) {
  if (props.pack.hall.experience?.kind === "guided_gallery") return <GuidedGallery {...props} />;
  return <ClassicHallScene {...props} />;
}

function ClassicHallScene({ pack, progress, mode, characters, onSelectCharacter, onReturn, onOpenMap, onNextHall }: Props) {
  const { hall, assets, objects, sources } = pack;
  const initial = hall.stations.some((item) => item.id === progress?.lastStationId) ? progress!.lastStationId : hall.stations[0].id;
  const [stationId, setStationId] = useState(initial);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revision, setRevision] = useState(progress?.revision ?? 0);
  const [viewed, setViewed] = useState(progress?.viewedObjectIds ?? []);
  const [visited, setVisited] = useState(progress?.visitedCharacterIds ?? []);
  const [completed, setCompleted] = useState(progress?.completedStationIds ?? []);
  const revisionRef = useRef(progress?.revision ?? 0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const objectButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const station = hall.stations.find((item) => item.id === stationId) ?? hall.stations[0];
  const anchor = objects.find((item) => item.id === hall.entrance.anchorObjectId) ?? objects[0];
  const assetId = mode === "child" ? hall.theme.lightAssetId : hall.theme.archiveAssetId;
  const sceneAsset = assets.find((item) => item.id === assetId) ?? assets[0];
  const people = useMemo(() => hall.characterRefs.map((ref) => ({ ref, person: characters.find((item) => item.id === ref.id) })).filter((item): item is { ref: typeof hall.characterRefs[number]; person: HallSceneCharacter } => Boolean(item.person)), [characters, hall.characterRefs]);

  useEffect(() => {
    setStationId(initial);
    setRevision(progress?.revision ?? 0);
    revisionRef.current = progress?.revision ?? 0;
    setViewed(progress?.viewedObjectIds ?? []);
    setVisited(progress?.visitedCharacterIds ?? []);
    setCompleted(progress?.completedStationIds ?? []);
  }, [hall.id, initial, progress?.revision]);

  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeDrawer();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  function save(nextStation: string, nextViewed = viewed, nextVisited = visited, nextCompleted = completed) {
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
        if (result.state) {
          revisionRef.current = result.state.revision;
          setRevision(result.state.revision);
        }
      } catch {
        // The visit continues offline; the next interaction will retry.
      }
    });
    saveQueueRef.current = run;
    return run;
  }

  function goStation(next: string) {
    const nextCompleted = [...new Set([...completed, stationId])];
    setCompleted(nextCompleted);
    setStationId(next);
    void save(next, viewed, visited, nextCompleted);
  }

  function openObject() {
    const nextViewed = [...new Set([...viewed, anchor.id])];
    setViewed(nextViewed);
    setDrawerOpen(true);
    void save(stationId, nextViewed);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    requestAnimationFrame(() => objectButtonRef.current?.focus());
  }

  function meet(characterId: string) {
    const nextVisited = [...new Set([...visited, characterId])];
    setVisited(nextVisited);
    void save("characters", viewed, nextVisited, [...new Set([...completed, "characters"])]);
    onSelectCharacter(characterId);
  }

  const style = {
    "--hall-deep": hall.theme.tokens.bgDeep,
    "--hall-soft": hall.theme.tokens.bgSoft,
    "--hall-surface": hall.theme.tokens.surface,
    "--hall-ink": hall.theme.tokens.ink,
    "--hall-accent": hall.theme.tokens.accent,
    "--hall-highlight": hall.theme.tokens.highlight,
  } as React.CSSProperties;

  return <section className={`immersive-hall immersive-${mode}`} style={style}>
    <header className="hall-scene-topbar">
      <button className="hall-back" type="button" onClick={onReturn}>← 返回时期馆</button>
      <span>{hall.entrance.kicker}</span>
      <button className="hall-map-link" type="button" onClick={onOpenMap}>查看关系与时间线</button>
    </header>

    <section className="hall-scene-hero">
      <img className="hall-scene-art" src={sceneAsset.path} width={sceneAsset.width} height={sceneAsset.height} alt={sceneAsset.alt} />
      <div className="hall-scene-shade" aria-hidden="true" />
      <div className="hall-scene-copy">
        <small>{hall.entrance.kicker}</small>
        <h1>{hall.title}</h1>
        <p>{hall.question}</p>
        {hall.contentWarning && <aside className="hall-warning"><b>{hall.contentWarning.label}</b><span>{hall.contentWarning.description}</span></aside>}
        <button className="hall-scene-primary" type="button" onClick={() => goStation("object")}>{hall.entrance.primaryActionLabel}</button>
      </div>
      <article className="hall-object-callout">
        <small>核心物件</small>
        <b>{anchor.name}</b>
        <span>{anchor.shortLabel}</span>
      </article>
      <span className="representation-label">历史主题艺术重建</span>
    </section>

    <nav className="hall-route" aria-label="展厅参观路线">
      {hall.stations.map((item) => <button key={item.id} type="button" className={item.id === stationId ? "active" : completed.includes(item.id) ? "complete" : ""} onClick={() => goStation(item.id)} aria-current={item.id === stationId ? "step" : undefined}><small>0{item.order}</small><span>{item.title}</span></button>)}
    </nav>

    <section className="hall-station" aria-live="polite">
      <div className="hall-station-copy">
        <small>第 {station.order} 站 · {station.title}</small>
        <h2>{station.type === "orientation" ? hall.guideTitle : station.type === "object" ? anchor.name : station.type === "character_relation" ? "历史不是一个人的独白" : "把问题带出展厅"}</h2>
        <p>{station.body}</p>
        {station.type === "orientation" && <button className="primary" type="button" onClick={() => goStation("object")}>去看核心物件</button>}
        {station.type === "object" && <button ref={objectButtonRef} className="primary" type="button" onClick={openObject}>{viewed.includes(anchor.id) ? "再次查看完整展签" : "打开完整展签"}</button>}
        {station.type === "character_relation" && <button className="secondary" type="button" onClick={onOpenMap}>在关系图中理解他们</button>}
        {station.type === "reflection" && <div className="reflection-actions"><button className="primary" type="button" onClick={() => people[0] && meet(people[0].person.id)}>带着问题去见一位人物</button>{hall.exit.nextHallId && onNextHall && <button className="secondary" type="button" onClick={() => onNextHall(hall.exit.nextHallId!)}>继续下一个展厅</button>}</div>}
      </div>
      {station.type === "object" ? <button ref={objectButtonRef} className="hall-object-stage" type="button" onClick={openObject} aria-label={`打开${anchor.name}完整展签`}><span>{anchor.kind === "instrument" ? "仪" : anchor.kind === "map" ? "图" : anchor.kind === "artwork" ? "艺" : "卷"}</span><b>{anchor.name}</b><small>点击查看我们凭什么这样布展</small></button> : station.type === "character_relation" ? <div className="hall-character-wall">{people.map(({ ref, person }) => <button type="button" key={person.id} onClick={() => meet(person.id)}><span className="hall-character-portrait">{person.portrait ? <img src={person.portrait} alt="" /> : person.name.slice(0, 1)}</span><b>{person.name}</b><small>{ref.relationshipLabel}</small></button>)}</div> : <blockquote className="hall-question-card"><span>本厅问题</span><p>{station.type === "reflection" ? hall.exit.reflectionQuestion : hall.question}</p></blockquote>}
    </section>

    {drawerOpen && <div className="hall-drawer-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}><aside ref={drawerRef} className="hall-object-drawer" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="object-title"><header><div><small>核心物件展签</small><h2 id="object-title">{anchor.name}</h2></div><button type="button" onClick={closeDrawer} aria-label="关闭展签">×</button></header><span className="representation-label static-label">艺术重建 · 不冒充真实文物</span><dl><div><dt>时间与地点</dt><dd>{anchor.dateLabel}{anchor.placeLabel ? ` · ${anchor.placeLabel}` : ""}</dd></div><div><dt>你正在看什么</dt><dd>{anchor.description}</dd></div><div><dt>它为什么重要</dt><dd>{anchor.significance}</dd></div><div><dt>视觉说明</dt><dd>{anchor.visualDescription}</dd></div></dl><section><small>策展来源说明</small>{sources.filter((source) => anchor.sourceIds.includes(source.id)).map((source) => <article key={source.id}><b>{source.title}</b><p>{source.note}</p></article>)}</section><button className="primary" type="button" onClick={() => { closeDrawer(); goStation("characters"); }}>认识与它相连的人物</button></aside></div>}
  </section>;
}
