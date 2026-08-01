"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ExhibitPack,
  HallVisitState,
  PendingRelationshipTransition,
  RelationshipPublicState,
} from "@ai-museum/sdk";
import { buildConversationClues } from "@/lib/conversation-clues";
import { resolveMuseumHallDeepLink } from "@/lib/museum-deep-link";
import { HallScene } from "@/components/halls/HallScene";
import { RelationshipAddressDialog } from "@/components/relationships/RelationshipAddressDialog";
import { RelationshipChip } from "@/components/relationships/RelationshipChip";
import { RelationshipDrawer } from "@/components/relationships/RelationshipDrawer";
import { RelationshipMilestone } from "@/components/relationships/RelationshipMilestone";
import { RelationshipResetDialog } from "@/components/relationships/RelationshipResetDialog";

type Tier = "white" | "blue" | "purple" | "orange" | "gold";
type PortraitStyle = "cartoon" | "realistic";
type PortraitVariant = {
  assetPath?: string;
  alt: string;
  representation:
    | "historical_portrait"
    | "evidence_based_reconstruction"
    | "artistic_interpretation";
  sourceLabel?: string;
  license?: string;
};
type CharacterExhibit = {
  overview: string;
  biography: string[];
  influence: string;
  legacy: string;
  works: string[];
  conversationStarters: string[];
  discoveries: Array<{
    id: string;
    kind: string;
    title: string;
    content: string;
    keywords: string[];
  }>;
};
type Character = {
  id: string;
  periodId: string;
  name: string;
  initial: string;
  life: string;
  tier: Tier;
  curatorRole: string;
  summary: string;
  exhibit: CharacterExhibit;
  relationCharacterIds: string[];
  portraitVariants: { cartoon: PortraitVariant; realistic: PortraitVariant };
};
type Hall = {
  id: string;
  title: string;
  question: string;
  guideTitle: string;
  guideText: string;
  characterIds: string[];
  sceneRef?: { exhibitPackId: string; version: string };
  previewAsset?: string;
  anchorObjectLabel?: string;
};
type Period = {
  id: string;
  title: string;
  years: string;
  place: string;
  mark: string;
  theme: "tang" | "renaissance" | "physics";
  inquiry: string;
  halls: Hall[];
  characters: Character[];
};
type Collection = {
  ownedCharacterIds: string[];
  stars: number;
  fragments: number;
  firstFreeEligible: boolean;
  firstFreeUsed: boolean;
  revision: number;
};
type Draw = {
  id: string;
  periodId: string;
  resultCharacterId: string;
  duplicate: boolean;
  fragmentReward: number;
  costStars: number;
  status: "committed" | "revealed";
};
type ExploreData = {
  periods: Period[];
  collection: Collection;
  pendingDraw: Draw | null;
};
type Thread = {
  id: string;
  characterId: string;
  summary?: string;
  lastMessageAt?: string;
};
type Message = {
  id?: string;
  role: "user" | "character";
  content: string;
  citations?: Array<{ sourceId: string; title: string; locator: string }>;
  characterVersion?: string;
  narrator?: string;
};
type Route =
  | "mode"
  | "home"
  | "conversation"
  | "explore"
  | "period"
  | "hall"
  | "map"
  | "encounter"
  | "person"
  | "museum"
  | "pack"
  | "chat";
type ChatFontSize = "small" | "medium" | "large";
type RelationshipAction =
  "pause" | "resume" | "address" | "revoke-address" | "reset" | null;

const routeNames: Record<Route, string> = {
  mode: "视觉模式",
  home: "选择参观方式",
  conversation: "人物交流",
  explore: "探索历史",
  period: "历史时期",
  hall: "历史展厅",
  map: "关系与时间线",
  encounter: "人物相遇",
  person: "人物资料",
  museum: "我的博物馆",
  pack: "人物卡包",
  chat: "长期对话",
};
const tierLabels: Record<Tier, string> = {
  white: "线索人物",
  blue: "关键人物",
  purple: "核心人物",
  orange: "时代人物",
  gold: "典藏人物",
};
const validRoutes = new Set(Object.keys(routeNames));
const initialOwnedCount = 36;

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

export function Museum({ displayName }: { displayName: string }) {
  const [dataState, setData] = useState<ExploreData | null>(null);
  const data: ExploreData = dataState ?? {
    periods: [],
    collection: {
      ownedCharacterIds: [],
      stars: 0,
      fragments: 0,
      firstFreeEligible: false,
      firstFreeUsed: false,
      revision: 0,
    },
    pendingDraw: null,
  };
  const [route, setRoute] = useState<Route>("home");
  const [mode, setMode] = useState<"child" | "adult">("child");
  const [periodId, setPeriodId] = useState("physics-revolution");
  const [selectedId, setSelectedId] = useState("albert-einstein");
  const [hallId, setHallId] = useState("physics-solvay");
  const [hallPack, setHallPack] = useState<ExhibitPack | null>(null);
  const [hallProgress, setHallProgress] = useState<HallVisitState | null>(null);
  const [hallLoading, setHallLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [evidenceSeen, setEvidenceSeen] = useState(false);
  const [encounterDone, setEncounterDone] = useState(false);
  const [drawResult, setDrawResult] = useState<Draw | null>(null);
  const [confirmDraw, setConfirmDraw] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [runtimeMode, setRuntimeMode] = useState("正在准备人物回答");
  const [portraitStyles, setPortraitStyles] = useState<
    Record<string, PortraitStyle>
  >({});
  const [chatFontSize, setChatFontSize] = useState<ChatFontSize>("medium");
  const [memoOpen, setMemoOpen] = useState(false);
  const [relationships, setRelationships] = useState<
    Record<string, RelationshipPublicState | undefined>
  >({});
  const [relationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState("");
  const [relationshipDrawerOpen, setRelationshipDrawerOpen] = useState(false);
  const [relationshipAddressOpen, setRelationshipAddressOpen] = useState(false);
  const [relationshipResetOpen, setRelationshipResetOpen] = useState(false);
  const [relationshipAction, setRelationshipAction] =
    useState<RelationshipAction>(null);
  const [relationshipMilestone, setRelationshipMilestone] =
    useState<PendingRelationshipTransition | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  const refreshExplore = useCallback(async () => {
    const response = await fetch("/api/explore");
    if (!response.ok) throw new Error("无法加载历史目录");
    const next = (await response.json()) as ExploreData;
    setData(next);
    return next;
  }, []);
  const refreshThreads = useCallback(async () => {
    const response = await fetch("/api/threads");
    const next = await response.json();
    setThreads(next.threads ?? []);
    return next.threads ?? ([] as Thread[]);
  }, []);
  const refreshRelationship = useCallback(
    async (characterId: string, signal?: AbortSignal) => {
      setRelationshipLoading(true);
      setRelationshipError("");
      try {
        const response = await fetch(
          `/api/characters/${characterId}/relationship`,
          { signal },
        );
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "无法加载关系状态");
        const relationship = result.relationship as RelationshipPublicState;
        setRelationships((current) => ({
          ...current,
          [characterId]: relationship,
        }));
        if (relationship.pendingTransition)
          setRelationshipMilestone(relationship.pendingTransition);
        return relationship;
      } catch (reason) {
        if ((reason as { name?: string })?.name !== "AbortError")
          setRelationshipError(
            reason instanceof Error ? reason.message : "无法加载关系状态",
          );
        return undefined;
      } finally {
        if (!signal?.aborted) setRelationshipLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void (async () => {
      try {
        const saved = localStorage.getItem("ai-museum-visitor");
        if (saved) {
          const state = JSON.parse(saved);
          if (state.mode) setMode(state.mode);
          if (state.periodId) setPeriodId(state.periodId);
          if (state.selectedId) setSelectedId(state.selectedId);
          if (state.hallId) setHallId(state.hallId);
          if (state.portraitStyles) setPortraitStyles(state.portraitStyles);
          if (["small", "medium", "large"].includes(state.chatFontSize))
            setChatFontSize(state.chatFontSize);
        }
        const query = new URLSearchParams(location.search);
        const queryMode = query.get("mode");
        if (queryMode === "child" || queryMode === "adult") setMode(queryMode);
        const hash = location.hash.slice(1);
        if (validRoutes.has(hash)) setRoute(hash as Route);
        const nextExplore = await refreshExplore();
        const requestedHall = resolveMuseumHallDeepLink(nextExplore.periods, query.get("hall"));
        if (requestedHall) {
          setPeriodId(requestedHall.periodId);
          setHallId(requestedHall.hallId);
          setRoute("hall");
          history.replaceState(null, "", `${location.pathname}${location.search}#hall`);
        }
        await refreshThreads();
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "页面加载失败");
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshExplore, refreshThreads]);
  useEffect(() => {
    const onHash = () => {
      const hash = location.hash.slice(1);
      if (validRoutes.has(hash)) setRoute(hash as Route);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(
        "ai-museum-visitor",
        JSON.stringify({
          mode,
          periodId,
          selectedId,
          hallId,
          portraitStyles,
          chatFontSize,
        }),
      );
    } catch {}
  }, [mode, periodId, selectedId, hallId, portraitStyles, chatFontSize]);

  const periods = data?.periods ?? [];
  const period = periods.find((item) => item.id === periodId) ?? periods[0];
  const characters = periods.flatMap((item) => item.characters);
  const selected =
    characters.find((item) => item.id === selectedId) ?? characters[0];
  const hall =
    period?.halls.find((item) => item.id === hallId) ?? period?.halls[0];
  const selectedHall =
    period?.halls.find((item) => item.characterIds.includes(selected?.id)) ??
    hall;
  const owned = (id: string) =>
    Boolean(data?.collection.ownedCharacterIds.includes(id));
  const ownedInPeriod = (p: Period) =>
    p.characters.filter((character) => owned(character.id)).length;
  const relationship = selected ? (relationships[selected.id] ?? null) : null;

  useEffect(() => {
    if (
      !selected ||
      !dataState?.collection.ownedCharacterIds.includes(selected.id)
    ) {
      setRelationshipLoading(false);
      return;
    }
    const controller = new AbortController();
    void refreshRelationship(selected.id, controller.signal);
    return () => controller.abort();
  }, [selected?.id, dataState?.collection.revision, refreshRelationship]);

  useEffect(() => {
    setRelationshipMilestone(null);
    setRelationshipDrawerOpen(false);
    setRelationshipAddressOpen(false);
    setRelationshipResetOpen(false);
  }, [selected?.id]);

  useEffect(() => {
    if (!hall?.id) return;
    const controller = new AbortController();
    setHallLoading(true);
    fetch(`/api/halls/${hall.id}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "无法加载展厅");
        setHallPack(result.pack);
        setHallProgress(result.progress ?? null);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") {
          setHallPack(null);
          setError(reason instanceof Error ? reason.message : "无法加载展厅");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setHallLoading(false);
      });
    return () => controller.abort();
  }, [hall?.id]);

  function go(next: Route) {
    setRoute(next);
    setError("");
    setNotice("");
    if (location.hash !== `#${next}`) location.hash = next;
    scrollTo({ top: 0, behavior: "smooth" });
  }
  function choosePeriod(next: Period, target: Route = "period") {
    setPeriodId(next.id);
    setHallId(next.halls[0].id);
    setExpanded(false);
    go(target);
  }
  function choosePerson(character: Character, target: Route = "person") {
    setSelectedId(character.id);
    setPeriodId(character.periodId);
    setEvidenceSeen(false);
    setEncounterDone(false);
    setMemoOpen(false);
    setSearchOpen(false);
    go(target);
  }
  function setVisualMode(next: "child" | "adult") {
    setMode(next);
    const url = new URL(location.href);
    url.searchParams.set("mode", next);
    history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    toast(next === "child" ? "已切换到轻快版" : "已切换到典藏版");
  }
  function portraitStyle(character: Character) {
    return (
      portraitStyles[character.id] ??
      (mode === "child" ? "cartoon" : "realistic")
    );
  }
  function togglePortrait(character: Character) {
    setPortraitStyles((current) => ({
      ...current,
      [character.id]:
        portraitStyle(character) === "cartoon" ? "realistic" : "cartoon",
    }));
  }
  function toast(message: string) {
    setNotice(message);
    setTimeout(
      () => setNotice((current) => (current === message ? "" : current)),
      2600,
    );
  }
  function beginWithQuestion(question: string) {
    setInput(question);
    go("chat");
    setTimeout(() => chatInputRef.current?.focus(), 80);
  }

  const openThread = useCallback(
    async (characterId: string) => {
      const createdResponse = await fetch("/api/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ characterId }),
      });
      const created = await createdResponse.json();
      if (!created.thread) throw new Error(created.error ?? "无法打开对话");
      setThreadId(created.thread.id);
      const historyResponse = await fetch(
        `/api/threads/${created.thread.id}/messages`,
      );
      const history = await historyResponse.json();
      setMessages(history.messages ?? []);
      await refreshThreads();
    },
    [refreshThreads],
  );
  useEffect(() => {
    if (route !== "chat" || !selected || !owned(selected.id)) return;
    void openThread(selected.id).catch((reason) =>
      setError(reason instanceof Error ? reason.message : "无法恢复对话"),
    );
  }, [route, selected?.id, openThread]);
  useEffect(() => {
    if (route !== "chat" || messages.length === 0) return;
    const frame = requestAnimationFrame(() => {
      const container = chatScrollRef.current;
      const target = latestMessageRef.current;
      if (!container || !target) return;
      const top =
        container.scrollTop +
        target.getBoundingClientRect().top -
        container.getBoundingClientRect().top -
        10;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [route, threadId, messages]);

  async function completeEncounter() {
    if (!selected || !period || encounterDone) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/exploration-events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          characterId: selected.id,
          periodId: period.id,
          type: "encounter_completed",
          idempotencyKey: `encounter:${selected.id}`,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "相遇没有保存");
      setData((current) =>
        current ? { ...current, collection: result.collection } : current,
      );
      setEncounterDone(true);
      toast(
        result.repeated
          ? "这次相遇之前已经记录过"
          : "完成相遇：获得20探索星和首次免费开包",
      );
      setTimeout(() => go("pack"), 650);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "相遇没有保存");
    } finally {
      setBusy(false);
    }
  }

  async function draw() {
    if (!period || busy) return;
    setBusy(true);
    setError("");
    try {
      const idempotencyKey = uuid();
      const response = await fetch("/api/draws", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ periodId: period.id, idempotencyKey }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "人物卡开启失败");
      setData((current) =>
        current
          ? {
              ...current,
              collection: result.collection,
              pendingDraw: result.draw,
            }
          : current,
      );
      setDrawResult(result.draw);
      setConfirmDraw(false);
    } catch (reason) {
      setConfirmDraw(false);
      setError(reason instanceof Error ? reason.message : "人物卡开启失败");
    } finally {
      setBusy(false);
    }
  }
  async function acknowledgeDraw(target: Route) {
    if (!drawResult) return;
    try {
      await fetch(`/api/draws/${drawResult.id}/reveal`, { method: "POST" });
    } catch {}
    const resultCharacter = characters.find(
      (item) => item.id === drawResult.resultCharacterId,
    );
    if (resultCharacter) setSelectedId(resultCharacter.id);
    setDrawResult(null);
    setData((current) =>
      current ? { ...current, pendingDraw: null } : current,
    );
    go(target);
  }

  async function ask() {
    const question = input.trim();
    if (!question || busy || !threadId) return;
    setInput("");
    setBusy(true);
    setError("");
    const optimistic: Message = { role: "user", content: question };
    setMessages((current) => [...current, optimistic]);
    try {
      const response = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: question,
          ageBand: "9-12",
          locale: "zh-CN",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "回答失败");
      setMessages((current) => [
        ...current,
        {
          id: result.messageId,
          role: "character",
          content: result.answer,
          citations: result.citations,
          characterVersion: result.version,
          narrator: result.narratorNote,
        },
      ]);
      if (result.relationship) {
        const next = result.relationship as RelationshipPublicState;
        setRelationships((current) => ({
          ...current,
          [next.characterId]: next,
        }));
        if (next.pendingTransition)
          setRelationshipMilestone(next.pendingTransition);
        else setTimeout(() => void refreshRelationship(next.characterId), 1_200);
      }
      const evidence =
        Array.isArray(result.citations) && result.citations.length > 0;
      setRuntimeMode(
        result.mode === "cloud-model"
          ? result.boundary
            ? "人物对话 · 边界提醒"
            : evidence
              ? "人物对话 · 史料增强"
              : "人物对话 · 角色演绎"
          : result.mode === "local-model"
            ? evidence
              ? "人物对话 · 史料增强"
              : "人物对话 · 角色演绎"
            : "基础体验 · 智能对话未连接",
      );
      await refreshThreads();
    } catch (reason) {
      setMessages((current) => current.slice(0, -1));
      setInput(question);
      setError(reason instanceof Error ? reason.message : "回答失败");
    } finally {
      setBusy(false);
      requestAnimationFrame(() => chatInputRef.current?.focus());
    }
  }

  async function patchRelationship(
    action: "pause" | "resume" | "set_address" | "revoke_address",
    extra: Record<string, unknown> = {},
  ) {
    if (!selected) return;
    setRelationshipError("");
    const uiAction: RelationshipAction =
      action === "set_address"
        ? "address"
        : action === "revoke_address"
          ? "revoke-address"
          : action;
    setRelationshipAction(uiAction);
    try {
      const response = await fetch(
        `/api/characters/${selected.id}/relationship`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, ...extra }),
        },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "关系设置没有保存");
      const next = result.relationship as RelationshipPublicState;
      setRelationships((current) => ({ ...current, [selected.id]: next }));
      return next;
    } catch (reason) {
      setRelationshipError(
        reason instanceof Error ? reason.message : "关系设置没有保存",
      );
      return undefined;
    } finally {
      setRelationshipAction(null);
    }
  }
  async function saveRelationshipAddress(value: string) {
    const next = await patchRelationship("set_address", { value });
    if (next) {
      setRelationshipAddressOpen(false);
      toast("称呼许可已保存");
    }
  }
  async function revokeRelationshipAddress() {
    const next = await patchRelationship("revoke_address");
    if (next) {
      setRelationshipAddressOpen(false);
      toast("称呼许可已撤销");
    }
  }
  async function resetSelectedRelationship() {
    if (!selected) return;
    setRelationshipError("");
    setRelationshipAction("reset");
    try {
      const response = await fetch(
        `/api/characters/${selected.id}/relationship`,
        { method: "DELETE" },
      );
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "关系没有重置");
      setRelationships((current) => ({
        ...current,
        [selected.id]: result.relationship as RelationshipPublicState,
      }));
      setRelationshipMilestone(null);
      setRelationshipResetOpen(false);
      toast("已从初识重新开始，聊天记录仍然保留");
    } catch (reason) {
      setRelationshipError(
        reason instanceof Error ? reason.message : "关系没有重置",
      );
    } finally {
      setRelationshipAction(null);
    }
  }

  useEffect(() => {
    if (route !== "chat" || !selected || !relationshipMilestone) return;
    const controller = new AbortController();
    const transitionId = relationshipMilestone.id;
    const timer = setTimeout(() => {
      void fetch(`/api/characters/${selected.id}/relationship`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "ack_transition", transitionId }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const result = await response.json();
          if (response.ok && result.relationship) {
            setRelationships((current) => ({
              ...current,
              [selected.id]: result.relationship as RelationshipPublicState,
            }));
            setRelationshipMilestone((current) => current?.id === transitionId ? null : current);
          }
        })
        .catch(() => {});
    }, 5_000);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [route, selected?.id, relationshipMilestone?.id]);

  const searchResults = useMemo(() => {
    const query = search.trim();
    if (!query) return [];
    const direct = characters.filter((character) =>
      character.name.toLowerCase().includes(query.toLowerCase()),
    );
    const relationIds = new Set(
      direct.flatMap((character) => character.relationCharacterIds),
    );
    const related = characters.filter(
      (character) =>
        relationIds.has(character.id) &&
        !direct.some((item) => item.id === character.id),
    );
    return [
      ...direct.map((character) => ({ character, reason: "姓名匹配" })),
      ...related.map((character) => ({
        character,
        reason: `与${direct[0]?.name ?? "搜索人物"}有正式关系线索`,
      })),
    ].slice(0, 8);
  }, [search, characters]);
  const conversationClues = useMemo(
    () => (selected ? buildConversationClues(selected, messages) : []),
    [selected, messages],
  );

  if (loading)
    return (
      <main className={`visitor-app ${mode}`}>
        <div className="visitor-loading">
          <span>AI MUSEUM</span>
          <h1>正在打开历史大门…</h1>
        </div>
      </main>
    );
  if (!dataState || !period || !selected)
    return (
      <main className="visitor-app child">
        <div className="visitor-loading">
          <h1>历史目录没有准备好</h1>
          <p>{error}</p>
          <button
            type="button"
            className="primary"
            onClick={() => location.reload()}
          >
            重新加载
          </button>
        </div>
      </main>
    );

  function portraitFace(character: Character, style: PortraitStyle) {
    const variant = character.portraitVariants?.[style];
    return (
      <span className={`portrait-face portrait-${style}`} aria-hidden="true">
        <span className="portrait-art">
          {variant?.assetPath ? (
            <img src={variant.assetPath} alt="" />
          ) : (
            <span className="portrait-placeholder">
              <b>{character.initial}</b>
              <small>
                {style === "cartoon" ? "卡通形象待添加" : "写实形象待添加"}
              </small>
            </span>
          )}
        </span>
        <span className="portrait-provenance">
          {variant?.sourceLabel ?? "形象来源待补充"}
        </span>
      </span>
    );
  }
  function portrait(
    character: Character,
    size: "mini" | "large" | "stage" = "mini",
  ) {
    const style = portraitStyle(character);
    const current = style === "cartoon" ? "卡通" : "写实";
    const next = style === "cartoon" ? "写实" : "卡通";
    return (
      <button
        type="button"
        className={`portrait-button portrait-${size}`}
        data-style={style}
        onClick={(event) => {
          event.stopPropagation();
          togglePortrait(character);
        }}
        aria-label={`当前为${current}形象，切换为${next}形象`}
        title={`当前为${current}形象，点击切换`}
      >
        <span className="portrait-card-inner">
          {portraitFace(character, "cartoon")}
          {portraitFace(character, "realistic")}
        </span>
        <span className="portrait-switch-hint" aria-hidden="true">
          ↻ {current}
        </span>
      </button>
    );
  }
  function messageAvatar(character: Character) {
    const preferred = character.portraitVariants[portraitStyle(character)];
    const source =
      preferred.assetPath ?? character.portraitVariants.realistic.assetPath;
    return (
      <span className="message-avatar character-avatar" aria-hidden="true">
        {source ? <img src={source} alt="" /> : character.initial}
      </span>
    );
  }

  function header() {
    const museumRoute = ["explore", "period", "hall", "map", "encounter"].includes(route);
    const conversationRoute = ["conversation", "person", "museum", "pack", "chat"].includes(route);
    return (
      <header className={`visitor-header ${route === "home" ? "entry-header" : ""}`}>
        <button
          className="visitor-brand"
          onClick={() => go("home")}
          aria-label="返回 AI Museum 主页"
        >
          AI Museum
        </button>
        {route !== "home" && <nav aria-label="主要导航">
          <button
            className={museumRoute ? "active" : ""}
            onClick={() => go("explore")}
          >
            参观博物馆
          </button>
          <button
            className={conversationRoute ? "active" : ""}
            onClick={() => go("conversation")}
          >
            人物交流
          </button>
        </nav>}
        {route !== "home" && conversationRoute && <button
          className="visitor-search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="搜索人物或关系"
        >
          ⌕ <span>搜索人物或关系</span>
        </button>}
        {route !== "home" && conversationRoute && <button
          className="star-pill"
          onClick={() => toast("探索星只来自真实学习事件")}
        >
          ✦ {data.collection.stars}
        </button>}
        <a
          className="account-nav"
          href="/account"
          aria-label={`打开${displayName}的账户`}
        >
          <span aria-hidden="true">
            {displayName.slice(0, 1).toUpperCase()}
          </span>
          <b>{displayName}</b>
        </a>
        <button
          className="mode-toggle"
          onClick={() => setSettingsOpen(true)}
          aria-label="打开显示设置"
        >
          显示
        </button>
      </header>
    );
  }

  function periodCard(item: Period) {
    return (
      <button
        key={item.id}
        className={`period-card ${item.theme}`}
        data-mark={item.mark}
        onClick={() => choosePeriod(item)}
      >
        <span>
          {item.years} · 已认识 {ownedInPeriod(item)}/12
        </span>
        <h2>{item.title}</h2>
        <p>{item.inquiry}</p>
        <b>进入这个时期 →</b>
        {mode === "adult" && <small>{item.place}</small>}
      </button>
    );
  }
  function personCard(
    character: Character,
    reason?: string,
    interactive = true,
  ) {
    const details = (
      <>
        <b>{character.name}</b>
        <small>
          {reason ?? `${character.life} · ${tierLabels[character.tier]}`}
        </small>
        <em className={owned(character.id) ? "owned" : "public"}>
          {owned(character.id)
            ? "✓ 已获得 · 可长期对话"
            : "生平开放 · 长期对话待解锁"}
        </em>
      </>
    );
    return (
      <article
        key={character.id}
        className={`person-card tier-${character.tier}`}
      >
        {portrait(character, "mini")}
        {interactive ? (
          <button
            type="button"
            className="person-card-main"
            onClick={() => choosePerson(character)}
            aria-label={`打开${character.name}的人物资料`}
          >
            {details}
          </button>
        ) : (
          <div className="person-card-main">{details}</div>
        )}
      </article>
    );
  }

  function modeView() {
    return (
      <section className="museum-mode-page">
        <header>
          <small>只改变视觉，不改变功能</small>
          <h1>选择你喜欢的博物馆样子</h1>
          <p>人物、历史内容、对话与学习进度完全相同，以后也可以随时切换。</p>
        </header>
        <div className="museum-mode-grid">
          <button
            type="button"
            className={mode === "child" ? "selected" : ""}
            onClick={() => setMode("child")}
          >
            <span className="museum-mode-preview">
              <img
                src="/museum/halls/child-mode-preview-v1.webp"
                alt="两位小访客沿彩色路线探索诗笺、城门和望远镜"
              />
              <b>轻快版</b>
            </span>
            <h2>明亮、清楚、有探索感</h2>
            <p>活泼色彩、清楚任务和更大的点击区域。</p>
          </button>
          <button
            type="button"
            className={mode === "adult" ? "selected" : ""}
            onClick={() => setMode("adult")}
          >
            <span className="museum-mode-preview">
              <img
                src="/exhibits/renaissance-florence/1.0.0/scene.webp"
                alt="文艺复兴时期的典藏式历史场景重建"
              />
              <b>典藏版</b>
            </span>
            <h2>克制、沉稳、有档案感</h2>
            <p>更安静的材质与排版，保留传统博物馆氛围。</p>
          </button>
        </div>
        <button
          type="button"
          className="primary museum-mode-enter"
          onClick={() => {
            setVisualMode(mode);
            go("home");
          }}
        >
          使用{mode === "child" ? "轻快版" : "典藏版"}进入主页
        </button>
      </section>
    );
  }

  function home() {
    const recent = threads[0];
    const recentCharacter = recent
      ? characters.find((item) => item.id === recent.characterId)
      : undefined;
    const recentPortrait = recentCharacter?.portraitVariants[
      portraitStyle(recentCharacter)
    ]?.assetPath;
    return (
      <section className="museum-entry" aria-labelledby="museum-entry-title">
        <header>
          <small>欢迎回来，{displayName}</small>
          <h1 id="museum-entry-title">今天，你想怎样走进历史？</h1>
          <p>先选择一种体验。之后可以随时返回这里重新选择。</p>
        </header>
        <div className="museum-entry-choices">
          <button
            className="museum-entry-choice visit"
            type="button"
            onClick={() => go("explore")}
          >
            <img
              src="/exhibits/renaissance-florence/1.0.0/scene.webp"
              alt="文艺复兴展馆场景"
            />
            <span className="museum-entry-shade" aria-hidden="true" />
            <span className="museum-entry-copy">
              <small>从环境与展品开始</small>
              <b>参观博物馆</b>
              <em>选择时期与展厅，沿推荐动线参观，也可以完全自由浏览。</em>
              <strong>选择展厅 →</strong>
            </span>
          </button>
          <button
            className="museum-entry-choice talk"
            type="button"
            onClick={() => go("conversation")}
          >
            {recentPortrait ? (
              <img src={recentPortrait} alt="" />
            ) : (
              <span className="museum-entry-person" aria-hidden="true">人</span>
            )}
            <span className="museum-entry-shade" aria-hidden="true" />
            <span className="museum-entry-copy">
              <small>{recentCharacter ? "继续上次相遇" : "选择一位历史人物"}</small>
              <b>与历史人物深入交流</b>
              <em>
                {recentCharacter
                  ? `继续和${recentCharacter.name}的长期对话。`
                  : "查看人物资料，开始或继续一段长期对话。"}
              </em>
              <strong>
                {recentCharacter ? `继续和${recentCharacter.name}交流` : "进入人物区"} →
              </strong>
            </span>
          </button>
        </div>
      </section>
    );
  }

  function conversationHome() {
    const recent = threads[0];
    const recentCharacter = recent
      ? characters.find((item) => item.id === recent.characterId)
      : undefined;
    return (
      <>
        <section className="visitor-hero">
          <p>人物交流</p>
          <h1>
            {recentCharacter ? "继续一段未完的对话" : "你想先认识哪位历史人物？"}
          </h1>
          <span>
            {recentCharacter
              ? "你与每位人物的旧对话都会独立保存。"
              : "可以先查看人物资料，再决定是否开始长期交流。"}
          </span>
        </section>
        {recentCharacter ? (
          <article className="continue-card">
            {portrait(recentCharacter, "large")}
            <div>
              <small>继续上次对话</small>
              <h2>{recentCharacter.name}</h2>
              <p>{recent?.summary ?? recentCharacter.summary}</p>
              <div className="actions">
                <button
                  className="primary"
                  onClick={() => choosePerson(recentCharacter, "chat")}
                >
                  继续长期对话
                </button>
                <button
                  className="secondary"
                  onClick={() => choosePerson(recentCharacter, "person")}
                >
                  看看人物资料
                </button>
              </div>
            </div>
          </article>
        ) : (
          <article className="first-step">
            <div>
              <small>第一次探索</small>
              <h2>从人物名册中选择一位想认识的人</h2>
              <p>
                完成一次有史料依据的人物相遇后，将获得20探索星和一次免费开包。
              </p>
            </div>
            <button className="primary" onClick={() => go("museum")}>
              打开人物名册
            </button>
          </article>
        )}
        <div className="center-actions">
          <button className="secondary" onClick={() => go("museum")}>
            查看我的人物收藏 · {data.collection.ownedCharacterIds.length}/
            {initialOwnedCount}
          </button>
        </div>
      </>
    );
  }
  function explore() {
    return (
      <>
        <section className="visitor-hero">
          <p>第一步 · 选择历史时期</p>
          <h1>你想走进哪一段历史？</h1>
          <span>每个时期有12位人物和3个由时间、地点与关系组织的展厅。</span>
        </section>
        <div className="period-grid">{periods.map(periodCard)}</div>
      </>
    );
  }
  function periodView() {
    return (
      <>
        <section
          className={`period-hero ${period.theme}`}
          data-mark={period.mark}
        >
          <small>
            {period.years} · {period.place}
          </small>
          <h1>{period.title}</h1>
          <p>{period.inquiry}</p>
        </section>
        <section className="section-title">
          <div>
            <small>从一个真实场景开始</small>
            <h2>三个历史展厅</h2>
          </div>
          <span>人物因共同事件和证据相连</span>
        </section>
        <div className="hall-grid hall-preview-grid">
          {period.halls.map((item, index) => (
            <article className="hall-card hall-preview-card" key={item.id}>
              {item.previewAsset && <img src={item.previewAsset} alt="" />}
              <div>
                <small>
                  展厅 {index + 1} · {item.anchorObjectLabel ?? "主题物件"}
                </small>
                <h3>{item.title}</h3>
                <p>{item.question}</p>
                <button
                  className={index === 0 ? "primary" : "secondary"}
                  onClick={() => {
                    setHallId(item.id);
                    go("hall");
                  }}
                >
                  {index === 0 ? "进入推荐展厅" : "看看这个展厅"}
                </button>
              </div>
            </article>
          ))}
        </div>
      </>
    );
  }
  function hallView() {
    const people = (hall?.characterIds ?? [])
      .map((id) => characters.find((item) => item.id === id))
      .filter(Boolean) as Character[];
    if (hallLoading && !hallPack)
      return (
        <div className="visitor-loading embedded">
          <span>历史展厅</span>
          <h1>正在布置展厅…</h1>
        </div>
      );
    if (!hallPack)
      return (
        <section className="visitor-hero">
          <p>展厅暂时不可用</p>
          <h1>{hall?.title}</h1>
          <span>你可以返回时期馆，人物资料和长期对话仍然可用。</span>
          <button className="primary" onClick={() => go("period")}>
            返回时期馆
          </button>
        </section>
      );
    return (
      <HallScene
        pack={hallPack}
        progress={hallProgress}
        mode={mode}
        characters={people.map((character) => ({
          id: character.id,
          name: character.name,
          life: character.life,
          summary: character.summary,
          portrait:
            character.portraitVariants[portraitStyle(character)].assetPath,
        }))}
        onSelectCharacter={(id) => {
          const character = characters.find((item) => item.id === id);
          if (character) choosePerson(character, "encounter");
        }}
        onReturn={() => go("period")}
        onOpenMap={() => go("map")}
        onNextHall={(id) => {
          const nextPeriod = periods.find((item) =>
            item.halls.some((next) => next.id === id),
          );
          if (nextPeriod) {
            setPeriodId(nextPeriod.id);
            setHallId(id);
            go("hall");
          }
        }}
      />
    );
  }
  function mapView() {
    const people = (hall?.characterIds ?? [])
      .map((id) => characters.find((item) => item.id === id))
      .filter(Boolean) as Character[];
    return (
      <>
        <section className="visitor-hero map-hero">
          <p>{hall?.title} · 关系与时间线</p>
          <h1>把人物放回同一个历史问题里</h1>
          <span>
            连线表示同处一个展厅主题，不自动等于亲密关系；进入人物资料可查看更具体的来源说明。
          </span>
        </section>
        <section className="history-map">
          <div className="timeline-axis">
            <span>{period.years}</span>
            <b>{hall?.title}</b>
            <span>{period.place}</span>
          </div>
          <div className="relation-network">
            {people.map((character, index) => (
              <button
                type="button"
                key={character.id}
                className={`map-person map-person-${index % 3}`}
                onClick={() => choosePerson(character, "person")}
              >
                <span>
                  {character.portraitVariants[portraitStyle(character)]
                    .assetPath ? (
                    <img
                      src={
                        character.portraitVariants[portraitStyle(character)]
                          .assetPath
                      }
                      alt=""
                    />
                  ) : (
                    character.initial
                  )}
                </span>
                <b>{character.name}</b>
                <small>{character.summary}</small>
              </button>
            ))}
          </div>
          <div className="map-actions">
            <button className="primary" onClick={() => go("hall")}>
              返回当前展厅
            </button>
            <button className="secondary" onClick={() => go("period")}>
              返回时期馆
            </button>
          </div>
        </section>
      </>
    );
  }
  function encounter() {
    const relations = selected.relationCharacterIds
      .map((id) => characters.find((item) => item.id === id))
      .filter(Boolean)
      .slice(0, 2) as Character[];
    return (
      <section className="encounter-shell">
        <header className="encounter-nav">
          <div>
            <small>博物馆相遇 · 不要求已获得</small>
            <b>{selectedHall?.title}</b>
          </div>
          <button className="secondary" onClick={() => go("hall")}>
            返回展厅
          </button>
        </header>
        <div className="meeting-room">
          <article className="presence-stage">
            {portrait(selected, "stage")}
            <div>
              <small>{selected.curatorRole}</small>
              <h1>{selected.name}</h1>
              <RelationshipChip characterName={selected.name} preview />
              <p>
                {selected.life} · {period.title}
              </p>
              <span>点击形象可在卡通版与写实版之间切换</span>
            </div>
          </article>
          <article className="presence-intro">
            <small>30秒认识我</small>
            <h2>{selected.summary}</h2>
            <p>
              <b>为什么在这里：</b>
              {selectedHall?.title}
              把我与同一事件、地点或知识网络中的人物连接起来。
            </p>
            <div className="time-place">
              <span>时间 · {selected.life}</span>
              <span>地点 · {period.place}</span>
            </div>
            {relations.length > 0 && (
              <div className="relation-links">
                <b>可以顺着关系认识</b>
                {relations.map((relation) => (
                  <button
                    className="quiet"
                    key={relation.id}
                    onClick={() => choosePerson(relation, "person")}
                  >
                    {relation.name}
                  </button>
                ))}
              </div>
            )}
            <div className="prompt-chips" aria-label="推荐问题">
              <span>当时发生了什么？</span>
              <span>你为什么这样选择？</span>
              <span>谁影响了你？</span>
            </div>
          </article>
        </div>
        <div className="conversation-stage">
          <article className="bubble character">
            欢迎来到这段历史。你可以先从一个选择、一段关系或一件当时发生的事问起。
          </article>
          <article className="bubble user">
            你为什么会出现在这个历史展厅？
          </article>
          <article className="bubble character">
            {selected.summary}
            。我会尽量只谈自己所处时代能知道的事情；需要补充后世知识时，会由博物馆旁白说明。
            {evidenceSeen && (
              <aside className="source-card">
                <b>史料依据</b>
                <span>
                  人物简介、关系与史料出处会分开展示；没有可靠依据的内容会明确标注。
                </span>
              </aside>
            )}
          </article>
          <div className="actions">
            <button className="secondary" onClick={() => setEvidenceSeen(true)}>
              {evidenceSeen ? "✓ 已查看依据" : "看看依据"}
            </button>
            {evidenceSeen && !encounterDone && (
              <button
                className="primary"
                disabled={busy}
                onClick={() => void completeEncounter()}
              >
                {busy ? "正在保存…" : "完成相遇 · +20探索星"}
              </button>
            )}
          </div>
        </div>
        <div className="sample-composer">
          <input
            disabled
            placeholder="完成这次相遇后，可以在长期对话中继续提问"
          />
          <button disabled>发送</button>
        </div>
      </section>
    );
  }
  function personView() {
    const relations = selected.relationCharacterIds
      .map((id) => characters.find((item) => item.id === id))
      .filter(Boolean) as Character[];
    return (
      <div className="profile-layout rich-profile">
        <aside className="profile-side">
          {portrait(selected, "large")}
          <small>AI 历史人物演绎</small>
          <h1>{selected.name}</h1>
          {owned(selected.id) && (
            <RelationshipChip
              characterName={selected.name}
              relationship={relationship}
              loading={relationshipLoading}
              error={relationshipError}
              onOpen={() => setRelationshipDrawerOpen(true)}
            />
          )}
          <p>
            {selected.life} · {tierLabels[selected.tier]}
          </p>
          <em className={owned(selected.id) ? "owned" : "public"}>
            {owned(selected.id) ? "✓ 已获得" : "基本资料开放"}
          </em>
          <div className="actions">
            {owned(selected.id) ? (
              <button className="primary" onClick={() => go("chat")}>
                继续长期对话
              </button>
            ) : (
              <button className="primary" onClick={() => go("encounter")}>
                完成博物馆相遇
              </button>
            )}
            <button className="secondary" onClick={() => go("hall")}>
              查看相关历史
            </button>
          </div>
          <div className="profile-period">
            <small>所在时空</small>
            <b>{period.title}</b>
            <span>
              {period.years} · {period.place}
            </span>
          </div>
        </aside>
        <section className="profile-main">
          <small>公开人物资料</small>
          <h2>{selected.exhibit.overview}</h2>
          <p className="profile-lead">
            先了解这个人的经历与处境，再选择一个真正想问的问题。
          </p>
          <section className="profile-section">
            <h3>一生中的几个转折</h3>
            <ol className="life-timeline">
              {selected.exhibit.biography.map((item, index) => (
                <li key={item}>
                  <span>{index + 1}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </section>
          <div className="profile-story-grid">
            <article>
              <small>如何影响时代</small>
              <h3>他改变了什么</h3>
              <p>{selected.exhibit.influence}</p>
            </article>
            <article>
              <small>后人的眼光</small>
              <h3>为什么今天仍在谈论</h3>
              <p>{selected.exhibit.legacy}</p>
            </article>
          </div>
          <section className="profile-section">
            <h3>作品、事件与思想</h3>
            <div className="work-chips">
              {selected.exhibit.works.map((work) => (
                <span key={work}>{work}</span>
              ))}
            </div>
          </section>
          <section className="profile-section">
            <h3>与他相连的人</h3>
            <div className="profile-relations">
              {relations.length ? (
                relations.slice(0, 5).map((relation) => (
                  <button
                    className="secondary"
                    key={relation.id}
                    onClick={() => choosePerson(relation, "person")}
                  >
                    {relation.name}
                  </button>
                ))
              ) : (
                <span>关系资料正在整理</span>
              )}
            </div>
          </section>
          <section className="profile-section conversation-starters">
            <small>不知道从哪里聊起？</small>
            <h3>带着一个好问题去见他</h3>
            <div>
              {selected.exhibit.conversationStarters.map((question) => (
                <button
                  className="secondary"
                  key={question}
                  onClick={() => beginWithQuestion(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          </section>
        </section>
      </div>
    );
  }
  function museum() {
    const ownedCharacters = characters.filter((character) =>
      owned(character.id),
    );
    const pending = data.pendingDraw;
    const pendingCharacter = pending
      ? characters.find((item) => item.id === pending.resultCharacterId)
      : undefined;
    return (
      <>
        <section className="visitor-hero">
          <p>我的博物馆</p>
          <h1>已认识 {data.collection.ownedCharacterIds.length} / 36 位人物</h1>
          <span>人物卡解锁长期关系；公共历史知识始终开放。</span>
        </section>
        {pending && pendingCharacter && (
          <article className="first-step pending">
            <div>
              <small>最近获得 · 结果已经保存</small>
              <h2>{pendingCharacter.name}正在等待你</h2>
              <p>即使关闭或刷新，这位人物仍已加入博物馆。</p>
            </div>
            <button
              className="primary"
              onClick={() => {
                setDrawResult(pending);
              }}
            >
              查看结果
            </button>
          </article>
        )}
        <div className="museum-overview">
          <article>
            <h2>{data.collection.ownedCharacterIds.length}/36</h2>
            <div className="progress">
              <i
                style={{
                  width: `${(data.collection.ownedCharacterIds.length / 36) * 100}%`,
                }}
              />
            </div>
            <p>
              探索星 {data.collection.stars} · 史料碎片{" "}
              {data.collection.fragments}
            </p>
            <button className="primary" onClick={() => go("explore")}>
              继续探索历史
            </button>
          </article>
          <article>
            {periods.map((item) => (
              <div className="collection-row" key={item.id}>
                <span>{item.title}</span>
                <b>{ownedInPeriod(item)}/12</b>
                <button
                  className="secondary"
                  onClick={() => choosePeriod(item, "pack")}
                >
                  卡包
                </button>
              </div>
            ))}
          </article>
        </div>
        <section className="section-title">
          <h2>已获得人物</h2>
          <span>点击打开人物资料</span>
        </section>
        <div className="people-grid">
          {ownedCharacters.map((character) => personCard(character))}
        </div>
      </>
    );
  }
  function pack() {
    const free =
      data.collection.firstFreeEligible && !data.collection.firstFreeUsed;
    const complete = ownedInPeriod(period) === 12;
    return (
      <>
        <div className="pack-layout">
          <article className={`pack-cover ${period.theme}`}>
            <small>{period.years} · 12位首发人物</small>
            <h1>{period.title}</h1>
            <p>
              {free
                ? "你完成了一次真实历史相遇，本次免费并保证获得未拥有人物。"
                : "每次开启消耗60探索星，约对应3次有效学习事件。"}
            </p>
            <div className="actions">
              <button
                className="primary"
                disabled={complete}
                onClick={() => setConfirmDraw(true)}
              >
                {complete
                  ? "本时期已全部收齐"
                  : free
                    ? "免费开启第一次人物卡"
                    : data.collection.stars >= 60
                      ? "用60探索星开启"
                      : `还差${60 - data.collection.stars}探索星`}
              </button>
              <button className="secondary" onClick={() => go("hall")}>
                先看历史展厅
              </button>
            </div>
          </article>
          <aside className="pack-rules">
            <article>
              <h3>公开规则</h3>
              <p>
                白35% · 蓝30% · 紫20% · 橙10% ·
                金5%。卡级表示本时期策展深度，不评价人物价值。
              </p>
            </article>
            <article>
              <h3>保底与恢复</h3>
              <p>
                首次免费保证未拥有。人物会先加入收藏再揭晓，即使刷新或断线也不会丢失。
              </p>
            </article>
            <article>
              <h3>当前状态</h3>
              <p>
                已认识 {ownedInPeriod(period)}/12 · 探索星{" "}
                {data.collection.stars} · 史料碎片 {data.collection.fragments}
              </p>
            </article>
          </aside>
        </div>
        <section className="section-title">
          <h2>本卡包12位人物</h2>
          <span>所有人的基本资料都可以浏览</span>
        </section>
        <div className="people-grid">
          {period.characters.map((character) => personCard(character))}
        </div>
      </>
    );
  }
  function chat() {
    const version =
      [...messages].reverse().find((message) => message.characterVersion)
        ?.characterVersion ?? "0.1.0";
    return (
      <section className="encounter-shell chat-shell">
        <header className="character-bar">
          {portrait(selected, "mini")}
          <div>
            <small>AI 历史人物演绎 · 长期对话 · 资料版本 v{version}</small>
            <b>{selected.name}</b>
            <RelationshipChip
              characterName={selected.name}
              relationship={relationship}
              loading={relationshipLoading}
              error={relationshipError}
              onOpen={() => setRelationshipDrawerOpen(true)}
            />
          </div>
          <span className="runtime-mode">{runtimeMode}</span>
          <button className="secondary" onClick={() => go("person")}>
            人物简介
          </button>
        </header>
        <div className="chat-view-options">
          <span>对话字号</span>
          <div role="group" aria-label="调整对话字号">
            {(["small", "medium", "large"] as ChatFontSize[]).map(
              (size, index) => (
                <button
                  type="button"
                  key={size}
                  className={chatFontSize === size ? "active" : ""}
                  aria-pressed={chatFontSize === size}
                  onClick={() => setChatFontSize(size)}
                >
                  {["小", "中", "大"][index]}
                </button>
              ),
            )}
          </div>
        </div>
        <div className="chat-workspace" data-font-size={chatFontSize}>
          <div className="chat-main">
            <p className="visitor-sr-only" aria-live="polite" aria-atomic="true">
              {messages.at(-1)?.role === "character"
                ? `${selected.name}说：${messages.at(-1)?.content}`
                : ""}
            </p>
            <div
              ref={chatScrollRef}
              className="conversation-stage chat-stage"
            >
              {messages.length === 0 && (
                <p className="empty-state">
                  这是你与{selected.name}
                  长期对话的开始。切换人物再回来，历史仍会保留。
                </p>
              )}
              {messages.map((message, index) => (
                <div
                  ref={
                    index === messages.length - 1 ? latestMessageRef : undefined
                  }
                  key={message.id ?? index}
                  className={`message-row ${message.role === "user" ? "user" : "character"}`}
                >
                  {message.role === "character" && messageAvatar(selected)}
                  <article
                    className={`bubble ${message.role === "user" ? "user" : "character"}`}
                    aria-label={`${message.role === "user" ? "你" : selected.name}说`}
                  >
                    <p>{message.content}</p>
                    {message.narrator && (
                      <aside className="narrator">
                        博物馆旁白：{message.narrator}
                      </aside>
                    )}
                    {message.citations?.map((citation) => (
                      <small
                        className="citation"
                        key={`${citation.sourceId}:${citation.locator}`}
                      >
                        {citation.title} · {citation.locator}
                      </small>
                    ))}
                  </article>
                  {message.role === "user" && (
                    <span
                      className="message-avatar user-avatar"
                      aria-hidden="true"
                    >
                      我
                    </span>
                  )}
                </div>
              ))}
              {relationshipMilestone && (
                <RelationshipMilestone
                  characterName={selected.name}
                  transition={relationshipMilestone}
                />
              )}
              {busy && <p className="thinking">正在检索人物记忆与史料…</p>}
            </div>
            <form
              className="sample-composer active-composer"
              onSubmit={(event) => {
                event.preventDefault();
                void ask();
              }}
            >
              <input
                ref={chatInputRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                aria-label={`和${selected.name}继续对话`}
                placeholder={`和${selected.name}继续对话…`}
              />
              <button className="primary" disabled={busy || !threadId}>
                发送
              </button>
            </form>
          </div>
          <aside
            className="conversation-memo discovery-panel"
            data-expanded={memoOpen}
            aria-label="历史发现"
          >
            <header>
              <div>
                <small>从对话中发现宝藏</small>
                <h2>历史发现</h2>
              </div>
              <button
                type="button"
                className="memo-toggle"
                aria-expanded={memoOpen}
                onClick={() => setMemoOpen((value) => !value)}
              >
                {memoOpen ? "收起" : "展开"}
              </button>
            </header>
            {conversationClues.length ? (
              <ol>
                {conversationClues.map((clue) => (
                  <li key={clue.id}>
                    <span>✦ {clue.kind}</span>
                    <b>{clue.title}</b>
                    <p>{clue.detail}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="memo-empty">
                <b>宝藏还藏在对话里</b>
                <p>
                  聊到代表作品、名句、关键关系或历史事件时，值得收藏的发现会出现在这里。
                </p>
              </div>
            )}
            <footer>
              只记录馆藏策划内容和带来源的史料，不再摘录普通寒暄。
            </footer>
          </aside>
        </div>
      </section>
    );
  }

  function bottomNav() {
    if (["home", "hall", "map", "encounter"].includes(route)) return null;
    return (
      <nav className="visitor-bottom-nav" aria-label="移动端主要导航">
        <button
          className=""
          onClick={() => go("home")}
        >
          <span>⌂</span>选择
        </button>
        <button
          className={
            ["explore", "period"].includes(route) ? "active" : ""
          }
          onClick={() => go("explore")}
        >
          <span>⌕</span>参观
        </button>
        <button
          className={
            ["conversation", "person", "museum", "pack", "chat"].includes(route)
              ? "active"
              : ""
          }
          onClick={() => go("conversation")}
        >
          <span>◉</span>人物
        </button>
      </nav>
    );
  }
  function settingsPanel() {
    if (!settingsOpen) return null;
    return (
      <div
        className="overlay-bg"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}
      >
        <section
          className="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
        >
          <header>
            <div>
              <small>显示设置</small>
              <h2 id="settings-title">选择你的参观风格</h2>
            </div>
            <button
              className="secondary"
              onClick={() => setSettingsOpen(false)}
              aria-label="关闭显示设置"
            >
              关闭
            </button>
          </header>
          <article>
            <h3>选择视觉主题</h3>
            <p>
              功能、人物和历史事实完全相同；轻快版默认使用卡通头像，典藏版默认使用写实重建头像。
            </p>
            <div className="theme-options">
              <button
                className={mode === "child" ? "active" : "secondary"}
                aria-pressed={mode === "child"}
                onClick={() => setVisualMode("child")}
              >
                轻快版
              </button>
              <button
                className={mode === "adult" ? "active" : "secondary"}
                aria-pressed={mode === "adult"}
                onClick={() => setVisualMode("adult")}
              >
                典藏版
              </button>
            </div>
          </article>
          <a className="entry-link" href="/account">
            <b>{displayName}的账户与进度</b>
            <span>管理账户并安全退出</span>
          </a>
          <a className="entry-link studio-link" href="/studio">
            <b>进入维护者工作台</b>
            <span>你将离开参观区，管理人物包与史料</span>
          </a>
        </section>
      </div>
    );
  }

  const views: Record<Route, () => React.ReactNode> = {
    mode: modeView,
    home,
    conversation: conversationHome,
    explore,
    period: periodView,
    hall: hallView,
    map: mapView,
    encounter,
    person: personView,
    museum,
    pack,
    chat,
  };
  if (route === "mode")
    return (
      <main className={`visitor-app ${mode} mode-only`} data-mode={mode}>
        {modeView()}
        {notice && (
          <div className="visitor-toast" role="status">
            {notice}
          </div>
        )}
      </main>
    );
  return (
    <main className={`visitor-app ${mode}`} data-mode={mode}>
      {header()}
      <div className="visitor-main">
        {error && (
          <div className="persistent-error" role="alert">
            <b>这一步没有完成</b>
            <span>{error}。已保存的数据不会丢失，你可以返回或重试。</span>
            <button onClick={() => setError("")} aria-label="关闭错误提示">
              ×
            </button>
          </div>
        )}
        {views[route]()}
      </div>
      {bottomNav()}
      {settingsPanel()}
      <RelationshipDrawer
        open={relationshipDrawerOpen}
        characterName={selected.name}
        relationship={relationship}
        loading={relationshipLoading}
        error={relationshipError}
        pendingAction={relationshipAction}
        stageChangedLabel={relationship?.stageChangedAt
          ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(
              new Date(relationship.stageChangedAt),
            )
          : undefined}
        onClose={() => setRelationshipDrawerOpen(false)}
        onTogglePaused={() =>
          void patchRelationship(
            relationship?.status === "paused" ? "resume" : "pause",
          )
        }
        onManageAddress={
          relationship &&
          ["young_friend", "old_friend", "kindred_spirit"].includes(
            relationship.stage,
          )
            ? () => setRelationshipAddressOpen(true)
            : undefined
        }
        onRevokeAddress={relationship?.preferredAddress
          ? () => void revokeRelationshipAddress()
          : undefined}
        onOpenMemories={() => location.assign("/memories")}
        onReset={() => setRelationshipResetOpen(true)}
      />
      <RelationshipAddressDialog
        open={relationshipAddressOpen}
        characterName={selected.name}
        currentAddress={relationship?.preferredAddress?.value}
        busy={relationshipAction === "address" || relationshipAction === "revoke-address"}
        error={relationshipError}
        onClose={() => setRelationshipAddressOpen(false)}
        onSave={(value) => void saveRelationshipAddress(value)}
        onRevoke={relationship?.preferredAddress
          ? () => void revokeRelationshipAddress()
          : undefined}
      />
      <RelationshipResetDialog
        open={relationshipResetOpen}
        characterName={selected.name}
        busy={relationshipAction === "reset"}
        error={relationshipError}
        onClose={() => setRelationshipResetOpen(false)}
        onConfirm={() => void resetSelectedRelationship()}
      />
      {notice && (
        <div className="visitor-toast" role="status">
          {notice}
        </div>
      )}
      {searchOpen && (
        <div
          className="overlay-bg"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
        >
          <section
            className="search-panel"
            role="dialog"
            aria-modal="true"
            aria-label="搜索人物或关系"
          >
            <header>
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="输入人物姓名，例如：爱因斯坦"
              />
              <button
                className="secondary"
                onClick={() => setSearchOpen(false)}
              >
                关闭
              </button>
            </header>
            {search ? (
              <>
                <small>人物与关系结果</small>
                <div className="search-results">
                  {searchResults.length ? (
                    searchResults.map((item) =>
                      personCard(item.character, item.reason),
                    )
                  ) : (
                    <p className="empty-state">
                      没有找到匹配人物。试试完整姓名或先浏览历史时期。
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="search-empty">
                <b>关系搜索不会打断当前页面</b>
                <p>搜索人物后，会先显示本人，再显示与他有正式关系线索的人。</p>
              </div>
            )}
          </section>
        </div>
      )}
      {confirmDraw && (
        <div className="overlay-bg">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="draw-title"
          >
            <small>结果会先保存</small>
            <h2 id="draw-title">
              {data.collection.firstFreeEligible &&
              !data.collection.firstFreeUsed
                ? "使用首次免费开包"
                : "确认开启人物卡"}
            </h2>
            <p>
              {data.collection.firstFreeEligible &&
              !data.collection.firstFreeUsed
                ? "保证获得一位尚未拥有的人物。"
                : "本次消耗60探索星；概率和重复补偿已经公开。"}
            </p>
            <dl>
              <div>
                <dt>当前探索星</dt>
                <dd>{data.collection.stars} ✦</dd>
              </div>
              <div>
                <dt>本次消耗</dt>
                <dd>
                  {data.collection.firstFreeEligible &&
                  !data.collection.firstFreeUsed
                    ? "免费"
                    : "60 ✦"}
                </dd>
              </div>
            </dl>
            <div className="actions">
              <button
                className="primary"
                disabled={busy}
                onClick={() => void draw()}
              >
                {busy ? "正在提交结果…" : "确认开启"}
              </button>
              <button
                className="secondary"
                onClick={() => setConfirmDraw(false)}
              >
                先不打开
              </button>
            </div>
          </section>
        </div>
      )}
      {drawResult && (
        <div className="overlay-bg">
          <section
            className="modal reveal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-title"
          >
            <small>结果已经保存 · 可安全关闭</small>
            <h2 id="reveal-title">
              {drawResult.duplicate ? "再次遇见" : "新人物加入你的博物馆"}
            </h2>
            {personCard(
              characters.find(
                (item) => item.id === drawResult.resultCharacterId,
              )!,
              undefined,
              false,
            )}
            {drawResult.duplicate && (
              <p>重复人物已转化为{drawResult.fragmentReward}个史料碎片。</p>
            )}
            <div className="actions">
              <button
                className="primary"
                onClick={() => void acknowledgeDraw("chat")}
              >
                开始长期对话
              </button>
              <button
                className="secondary"
                onClick={() => void acknowledgeDraw("hall")}
              >
                先看相关历史
              </button>
              <button
                className="quiet"
                onClick={() => {
                  setDrawResult(null);
                  go("museum");
                }}
              >
                稍后再看
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
