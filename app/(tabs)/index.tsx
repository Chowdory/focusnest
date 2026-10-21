import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Phase = "focus" | "break";
type TaskCategory = "Konzept" | "Recherche" | "Admin" | "Persönlich" | "Unbekannt";
type Task = { id: string; title: string; done: boolean; category: TaskCategory };
type FocusSession = { id: string; completedAt: number; category: TaskCategory; minutes: number };
type SoundId = "rain" | "cafe" | "fire" | "waves";
type Sound = {
  id: SoundId;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  volume: number;
  enabled: boolean;
};
type SavedState = {
  focusMinutes: number;
  breakMinutes: number;
  tasks: Task[];
  activeTaskId?: string | null;
  phase?: Phase;
  isRunning?: boolean;
  remaining?: number;
  timerEndsAt?: number | null;
  sounds: Sound[];
  weekKey: string;
  weeklyCounts: number[];
  weeklySessions?: FocusSession[];
  lofiVolume?: number;
};

const STORAGE_KEY = "focusnest-state-v1";
const COLORS = {
  ink: "#1F2839",
  inkSoft: "#657083",
  night: "#172235",
  cream: "#FFF8EE",
  paper: "#FFFCF8",
  border: "#E9E1D7",
  amber: "#F4B36A",
  amberDeep: "#C8793F",
  sage: "#A5B7A0",
  sageDeep: "#6F8A76",
  blue: "#8AAFC1",
  white: "#FFFFFF",
};
const TASK_CATEGORIES: TaskCategory[] = ["Konzept", "Recherche", "Admin", "Persönlich"];
const STAT_CATEGORIES: TaskCategory[] = [...TASK_CATEGORIES, "Unbekannt"];
const DEFAULT_TASKS: Task[] = [
  { id: "task-1", title: "Konzept ausarbeiten", category: "Konzept", done: false },
  { id: "task-2", title: "Recherche bündeln", category: "Recherche", done: false },
  { id: "task-3", title: "Inbox leeren", category: "Admin", done: true },
];
const DEFAULT_SOUNDS: Sound[] = [
  { id: "rain", label: "Regen", icon: "rainy-outline", color: "#88AFC0", volume: 0.3, enabled: true },
  { id: "cafe", label: "Café", icon: "cafe-outline", color: "#C89568", volume: 0.16, enabled: false },
  { id: "fire", label: "Kamin", icon: "flame-outline", color: "#E7A15F", volume: 0.2, enabled: true },
  { id: "waves", label: "Wellen", icon: "water-outline", color: "#7A9DB5", volume: 0.12, enabled: false },
];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getWeekKey(date = new Date()) {
  const mondayOffset = (date.getDay() + 6) % 7;
  const monday = new Date(date);
  monday.setDate(date.getDate() - mondayOffset);
  const year = monday.getFullYear();
  const month = String(monday.getMonth() + 1).padStart(2, "0");
  const day = String(monday.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function RoomIllustration({ isDay, width }: { isDay: boolean; width: number }) {
  return (
    <View style={[styles.room, { width }, isDay ? styles.roomDay : styles.roomNight]}>
      <View style={[styles.roomGlow, isDay ? styles.roomGlowDay : styles.roomGlowNight]} />
      <View style={styles.windowFrame}>
        <View style={[styles.windowSky, isDay ? styles.skyDay : styles.skyNight]}>
          {isDay ? <View style={styles.sun} /> : <><View style={styles.moon} /><View style={[styles.star, { top: 18, left: 22 }]} /><View style={[styles.star, { top: 38, left: 82 }]} /><View style={[styles.star, { top: 14, right: 25 }]} /><View style={[styles.star, { top: 54, right: 62 }]} /></>}
          <View style={[styles.horizon, isDay ? styles.horizonDay : styles.horizonNight]} />
          <View style={[styles.hill, isDay ? styles.hillDay : styles.hillNight]} />
        </View>
        <View style={styles.windowDividerVertical} />
        <View style={styles.windowDividerHorizontal} />
      </View>
      <View style={styles.shelf}>
        <View style={styles.shelfBookOne} /><View style={styles.shelfBookTwo} /><View style={styles.shelfPlantPot} /><View style={styles.shelfPlantLeafOne} /><View style={styles.shelfPlantLeafTwo} />
      </View>
      <View style={styles.desk}>
        <View style={styles.deskTop} /><View style={styles.deskLegLeft} /><View style={styles.deskLegRight} />
        <View style={styles.deskLamp}><View style={styles.lampShade} /><View style={styles.lampStem} /><View style={styles.lampBase} /></View>
        <View style={styles.mug} /><View style={styles.notebook} />
      </View>
      <View style={styles.chaise}><View style={styles.chaiseBack} /><View style={styles.chaiseSeat} /><View style={styles.chaiseArm} /><View style={styles.chaiseLeg} /></View>
      <View style={styles.floor} />
      <View style={styles.roomCaptionRow}><View style={styles.roomCaptionDot} /><Text style={styles.roomCaption}>{isDay ? "Dein heller Fokusraum" : "Dein ruhiger Abendraum"}</Text></View>
    </View>
  );
}

function SectionLabel({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return <View style={styles.sectionHeader}><View><Text style={styles.eyebrow}>{eyebrow.toUpperCase()}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action}</View>;
}
function IconButton({ name, onPress, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; label: string }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.iconButton}><Ionicons name={name} size={19} color={COLORS.ink} /></TouchableOpacity>;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>("focus");
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [remaining, setRemaining] = useState(25 * 60);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(DEFAULT_TASKS);
  const [newTask, setNewTask] = useState("");
  const [activeTaskId, setActiveTaskId] = useState<string | null>("task-1");
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>("Konzept");
  const [weeklySessions, setWeeklySessions] = useState<FocusSession[]>([]);
  const [lofiVolume, setLofiVolume] = useState(0.22);
  const [lofiPlaying, setLofiPlaying] = useState(false);
  const [statsMode, setStatsMode] = useState<"days" | "categories">("days");
  const [statsDay, setStatsDay] = useState<number | null>(null);
  const [statsCategory, setStatsCategory] = useState<TaskCategory | "all">("all");
  const [sounds, setSounds] = useState<Sound[]>(DEFAULT_SOUNDS);
  const [trackWidths, setTrackWidths] = useState<Partial<Record<SoundId, number>>>({});
  const [audioPrimed, setAudioPrimed] = useState(false);
  const [weeklyCounts, setWeeklyCounts] = useState([0, 0, 0, 0, 0, 0, 0]);
  const [weekKey, setWeekKey] = useState(getWeekKey());
  const [isDay, setIsDay] = useState(() => { const hour = new Date().getHours(); return hour >= 7 && hour < 19; });
  const currentWeekSessions = weeklySessions.filter((session) => getWeekKey(new Date(session.completedAt)) === weekKey);
  const hasSessionRecords = weeklySessions.length > 0;
  const legacyTotalSessions = weeklyCounts.reduce((sum, value) => sum + value, 0);
  const totalSessions = hasSessionRecords ? currentWeekSessions.length : legacyTotalSessions;
  const dayCounts = hasSessionRecords ? WEEKDAYS.map((_, index) => currentWeekSessions.filter((session) => (new Date(session.completedAt).getDay() + 6) % 7 === index).length) : weeklyCounts;
  const categoryCounts = STAT_CATEGORIES.map((category) => currentWeekSessions.filter((session) => session.category === category).length);
  const filteredStatCount = statsMode === "days" ? (statsDay === null ? totalSessions : hasSessionRecords ? dayCounts[statsDay] : weeklyCounts[statsDay]) : (statsCategory === "all" ? currentWeekSessions.length : currentWeekSessions.filter((session) => session.category === statsCategory).length);
  const statLabels = statsMode === "days" ? WEEKDAYS : STAT_CATEGORIES;
  const rawStatValues = statsMode === "days" ? dayCounts : categoryCounts;
  const statValues = statsMode === "days" ? (statsDay === null ? rawStatValues : rawStatValues.map((value, index) => index === statsDay ? value : 0)) : (statsCategory === "all" ? rawStatValues : rawStatValues.map((value, index) => statLabels[index] === statsCategory ? value : 0));
  const statMax = Math.max(1, ...statValues);
  const selectedTask = tasks.find((task) => task.id === activeTaskId && !task.done);
  const activeSoundCount = sounds.filter((sound) => sound.enabled && sound.volume > 0).length;
  const timerDuration = (phase === "focus" ? focusMinutes : breakMinutes) * 60;

  const rainPlayer = useAudioPlayer(require("../../assets/audio/rain.wav"));
  const cafePlayer = useAudioPlayer(require("../../assets/audio/cafe.wav"));
  const firePlayer = useAudioPlayer(require("../../assets/audio/fire.wav"));
  const wavesPlayer = useAudioPlayer(require("../../assets/audio/waves.wav"));
  const lofiPlayer = useAudioPlayer(require("../../assets/audio/lofi.wav"));

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers", allowsRecording: false, shouldPlayInBackground: true }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const players = { rain: rainPlayer, cafe: cafePlayer, fire: firePlayer, waves: wavesPlayer };
    sounds.forEach((sound) => {
      const player = players[sound.id];
      player.loop = true;
      player.volume = sound.enabled ? sound.volume : 0;
      if (audioPrimed && sound.enabled && sound.volume > 0 && !player.playing) player.play();
      if ((!sound.enabled || sound.volume <= 0) && player.playing) player.pause();
    });
  }, [audioPrimed, cafePlayer, firePlayer, rainPlayer, sounds, wavesPlayer]);

  useEffect(() => {
    const player = { lofi: lofiPlayer }.lofi;
    player.loop = true;
    player.volume = lofiVolume;
    if (!lofiPlaying && player.playing) player.pause();
  }, [lofiPlaying, lofiPlayer, lofiVolume]);
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedState;
      const now = Date.now();
      const currentWeek = getWeekKey();
      const savedFocusMinutes = saved.focusMinutes ?? 25;
      const savedBreakMinutes = saved.breakMinutes ?? 5;
      let restoredPhase: Phase = saved.phase ?? "focus";
      let restoredEnd = saved.timerEndsAt ?? now + (saved.remaining ?? (restoredPhase === "focus" ? savedFocusMinutes : savedBreakMinutes) * 60) * 1000;
      let restoredIsRunning = Boolean(saved.isRunning && saved.timerEndsAt);
      let restoredRemaining = saved.remaining ?? (restoredPhase === "focus" ? savedFocusMinutes : savedBreakMinutes) * 60;
      const restoredTasks = (saved.tasks ?? DEFAULT_TASKS).map((task) => ({ ...task, category: task.category ?? "Persönlich" }));
      const legacyCounts = saved.weeklyCounts ?? [0, 0, 0, 0, 0, 0, 0];
      let restoredCounts = saved.weekKey === currentWeek ? legacyCounts : [0, 0, 0, 0, 0, 0, 0];
      let restoredSessions = saved.weeklySessions ?? [];
      if (!saved.weeklySessions?.length && legacyCounts.some((count) => count > 0)) {
        const monday = new Date(`${saved.weekKey ?? currentWeek}T12:00:00`);
        monday.setHours(12, 0, 0, 0);
        restoredSessions = legacyCounts.flatMap((count, dayIndex) => Array.from({ length: count }, (_, offset) => {
          const completedAt = new Date(monday);
          completedAt.setDate(monday.getDate() + dayIndex);
          completedAt.setMinutes(offset);
          return { id: `legacy-${completedAt.getTime()}`, completedAt: completedAt.getTime(), category: "Unbekannt" as TaskCategory, minutes: savedFocusMinutes };
        }));
      }
      const restoredCategory = restoredTasks.find((task) => task.id === saved.activeTaskId && !task.done)?.category ?? "Persönlich";

      if (restoredIsRunning) {
        while (now >= restoredEnd) {
          if (restoredPhase === "focus") {
            if (getWeekKey(new Date(restoredEnd)) === currentWeek) {
              const completionDay = (new Date(restoredEnd).getDay() + 6) % 7;
              restoredCounts = restoredCounts.map((count, index) => index === completionDay ? count + 1 : count);
            }
            restoredSessions = [...restoredSessions, { id: `session-${restoredEnd}`, completedAt: restoredEnd, category: restoredCategory, minutes: savedFocusMinutes }];
          }
          restoredPhase = restoredPhase === "focus" ? "break" : "focus";
          restoredEnd += (restoredPhase === "focus" ? savedFocusMinutes : savedBreakMinutes) * 60 * 1000;
        }
        restoredRemaining = Math.max(1, Math.ceil((restoredEnd - now) / 1000));
      } else {
        restoredIsRunning = false;
        restoredEnd = 0;
      }

      setFocusMinutes(savedFocusMinutes); setBreakMinutes(savedBreakMinutes);
      setPhase(restoredPhase); setRemaining(restoredRemaining); setIsRunning(restoredIsRunning); setTimerEndsAt(restoredIsRunning ? restoredEnd : null);
      setTasks(restoredTasks); setActiveTaskId(saved.activeTaskId ?? null); setSounds(saved.sounds?.length ? saved.sounds : DEFAULT_SOUNDS);
      setWeeklySessions(restoredSessions); setLofiVolume(saved.lofiVolume ?? 0.22);
      setWeekKey(currentWeek); setWeeklyCounts(restoredCounts);
    }).catch(() => undefined).finally(() => setHydrated(true));
  }, []);
  useEffect(() => { if (!hydrated) return; const payload: SavedState = { focusMinutes, breakMinutes, tasks, activeTaskId, phase, isRunning, remaining, timerEndsAt, sounds, weekKey, weeklyCounts, weeklySessions, lofiVolume }; AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => undefined); }, [activeTaskId, breakMinutes, focusMinutes, hydrated, isRunning, lofiVolume, phase, remaining, sounds, tasks, timerEndsAt, weekKey, weeklyCounts, weeklySessions]);
  useEffect(() => {
    if (!isRunning || !timerEndsAt) return;
    const tick = () => {
      const now = Date.now();
      if (now < timerEndsAt) {
        setRemaining(Math.ceil((timerEndsAt - now) / 1000));
        return;
      }
      const currentWeek = getWeekKey();
      let cursor = timerEndsAt;
      let nextPhase = phase;
      let nextCounts = weekKey === currentWeek ? weeklyCounts : [0, 0, 0, 0, 0, 0, 0];
      let nextSessions = weeklySessions;
      while (now >= cursor) {
        if (nextPhase === "focus") {
          if (getWeekKey(new Date(cursor)) === currentWeek) {
            const completionDay = (new Date(cursor).getDay() + 6) % 7;
            nextCounts = nextCounts.map((count, index) => index === completionDay ? count + 1 : count);
          }
          nextSessions = [...nextSessions, { id: `session-${cursor}`, completedAt: cursor, category: selectedTask?.category ?? "Persönlich", minutes: focusMinutes }];
        }
        nextPhase = nextPhase === "focus" ? "break" : "focus";
        cursor += (nextPhase === "focus" ? focusMinutes : breakMinutes) * 60 * 1000;
      }
      setWeekKey(currentWeek);
      setWeeklyCounts(nextCounts);
      setWeeklySessions(nextSessions);
      setPhase(nextPhase);
      setRemaining(Math.max(1, Math.ceil((cursor - now) / 1000)));
      setTimerEndsAt(cursor);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [breakMinutes, focusMinutes, isRunning, phase, selectedTask?.category, timerEndsAt, weekKey, weeklyCounts, weeklySessions]);
  useEffect(() => { const updateTime = () => { const hour = new Date().getHours(); setIsDay(hour >= 7 && hour < 19); }; const clock = setInterval(updateTime, 60_000); return () => clearInterval(clock); }, []);
  useEffect(() => { const refreshWeek = () => { const currentWeek = getWeekKey(); if (currentWeek !== weekKey) { setWeekKey(currentWeek); setWeeklyCounts([0, 0, 0, 0, 0, 0, 0]); } }; const weekClock = setInterval(refreshWeek, 60_000); return () => clearInterval(weekClock); }, [weekKey]);

  const changeDuration = (type: Phase, amount: number) => {
    if (type === "focus") { const next = Math.min(60, Math.max(5, focusMinutes + amount)); setFocusMinutes(next); if (!isRunning && phase === "focus") setRemaining(next * 60); }
    else { const next = Math.min(30, Math.max(1, breakMinutes + amount)); setBreakMinutes(next); if (!isRunning && phase === "break") setRemaining(next * 60); }
  };
  const toggleTimer = () => {
    if (isRunning) {
      const nextRemaining = timerEndsAt ? Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000)) : remaining;
      setRemaining(nextRemaining); setTimerEndsAt(null); setIsRunning(false);
    } else {
      setTimerEndsAt(Date.now() + Math.max(1, remaining) * 1000); setIsRunning(true);
    }
  };
  const resetTimer = () => { setIsRunning(false); setTimerEndsAt(null); setRemaining(timerDuration); };
  const addTask = () => { const title = newTask.trim(); if (!title) return; setTasks((current) => [{ id: `task-${Date.now()}`, title, category: newTaskCategory, done: false }, ...current]); setNewTask(""); };
  const toggleLofi = () => { if (lofiPlaying) lofiPlayer.pause(); else lofiPlayer.play(); setLofiPlaying((playing) => !playing); };
  const updateSound = (id: SoundId, update: Partial<Sound>) => { setAudioPrimed(true); setSounds((current) => current.map((sound) => sound.id === id ? { ...sound, ...update } : sound)); };
  const roomWidth = Math.max(320, Math.min(width - 32, 720));
  const panelWidth = Math.max(0, Math.min(width - 32, 720));

  return (
    <View style={[styles.screen, { paddingTop: Math.max(insets.top, 16) }]}>
      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 28) }]} showsVerticalScrollIndicator={false}>
        <View style={[styles.content, { width: panelWidth }]}>
          <View style={styles.topBar}>
            <View style={styles.brandLockup}><View style={styles.brandMark}><Ionicons name="leaf-outline" size={19} color={COLORS.ink} /></View><View><Text style={styles.brandName}>focus nest</Text><Text style={styles.brandKicker}>ein kleiner raum für dich</Text></View></View>
            <View style={styles.dayPill}><View style={[styles.statusDot, { backgroundColor: isDay ? COLORS.amber : COLORS.blue }]} /><Text style={styles.dayPillText}>{isDay ? "Tag" : "Nacht"}</Text></View>
          </View>
          <View style={styles.greetingBlock}><Text style={styles.greeting}>Schön, dass du da bist.</Text><Text style={styles.greetingSub}>{isDay ? "Dein Zimmer ist hell und bereit." : "Die Lampe brennt schon für dich."}</Text></View>
          <RoomIllustration isDay={isDay} width={roomWidth} />

          <View style={styles.timerCard}>
            <View style={styles.timerCardTop}><View><Text style={styles.timerEyebrow}>{phase === "focus" ? "Fokuszeit" : "Pausenzeit"}</Text><Text style={styles.timerTitle}>{phase === "focus" ? "Bleib bei einer Sache." : "Atme kurz durch."}</Text></View><TouchableOpacity onPress={() => setSettingsOpen((open) => !open)} style={styles.settingsButton} accessibilityRole="button" accessibilityLabel="Timer einstellen"><Ionicons name="options-outline" size={19} color={COLORS.ink} /></TouchableOpacity></View>
            <View style={styles.timerRow}><View style={styles.timerDial}><View style={styles.timerDialInner}><Text style={styles.timerValue}>{formatTime(remaining)}</Text><Text style={styles.timerMode}>{phase === "focus" ? "FOCUS" : "PAUSE"}</Text></View><View style={[styles.progressArc, { transform: [{ rotate: `${-45 + (1 - remaining / timerDuration) * 270}deg` }] }]} /></View><View style={styles.timerSideCopy}><Text style={styles.timerSideLabel}>AKTIVE AUFGABE</Text><Text style={styles.activeTaskTitle} numberOfLines={2}>{selectedTask?.title ?? "Freier Fokus"}</Text><View style={styles.sessionMeta}><Ionicons name="sparkles-outline" size={15} color={COLORS.amberDeep} /><Text style={styles.sessionMetaText}>{totalSessions} Sitzungen diese Woche</Text></View></View></View>
            <View style={styles.timerActions}><IconButton name="refresh-outline" onPress={resetTimer} label="Timer zurücksetzen" /><TouchableOpacity onPress={toggleTimer} style={styles.primaryButton} accessibilityRole="button" accessibilityLabel={isRunning ? "Timer pausieren" : "Timer starten"}><Ionicons name={isRunning ? "pause" : "play"} size={18} color={COLORS.ink} /><Text style={styles.primaryButtonText}>{isRunning ? "Pause" : "Start"}</Text></TouchableOpacity><IconButton name="chevron-forward-outline" onPress={() => { setIsRunning(false); setTimerEndsAt(null); setPhase((current) => current === "focus" ? "break" : "focus"); setRemaining((phase === "focus" ? breakMinutes : focusMinutes) * 60); }} label="Nächste Phase" /></View>
            {settingsOpen && <View style={styles.settingsPanel}><View style={styles.settingsPanelHeader}><Text style={styles.settingsPanelTitle}>Dein Rhythmus</Text><Text style={styles.settingsPanelHint}>Tippe zum Anpassen</Text></View><View style={styles.durationRow}><Text style={styles.durationLabel}>Fokus</Text><View style={styles.stepper}><TouchableOpacity onPress={() => changeDuration("focus", -5)} style={styles.stepButton} accessibilityLabel="Fokuszeit verkürzen"><Text style={styles.stepButtonText}>−</Text></TouchableOpacity><Text style={styles.durationValue}>{focusMinutes} min</Text><TouchableOpacity onPress={() => changeDuration("focus", 5)} style={styles.stepButton} accessibilityLabel="Fokuszeit verlängern"><Text style={styles.stepButtonText}>+</Text></TouchableOpacity></View></View><View style={styles.durationRow}><Text style={styles.durationLabel}>Pause</Text><View style={styles.stepper}><TouchableOpacity onPress={() => changeDuration("break", -1)} style={styles.stepButton} accessibilityLabel="Pausenzeit verkürzen"><Text style={styles.stepButtonText}>−</Text></TouchableOpacity><Text style={styles.durationValue}>{breakMinutes} min</Text><TouchableOpacity onPress={() => changeDuration("break", 1)} style={styles.stepButton} accessibilityLabel="Pausenzeit verlängern"><Text style={styles.stepButtonText}>+</Text></TouchableOpacity></View></View></View>}
          </View>

          <View style={styles.weekCard}><View style={styles.weekHeader}><View><Text style={styles.eyebrow}>DEINE WOCHE</Text><Text style={styles.weekTitle}>{totalSessions === 0 ? "Der erste Schritt zählt." : `${totalSessions} ruhige Schritte gesammelt.`}</Text></View><View style={styles.weekTotal}><Text style={styles.weekTotalNumber}>{totalSessions}</Text><Text style={styles.weekTotalLabel}>Fokus</Text></View></View><View style={styles.weekDots}>{WEEKDAYS.map((day, index) => { const count = dayCounts[index]; const isToday = index === (new Date().getDay() + 6) % 7; return <View key={day} style={styles.dayColumn}><View style={[styles.dayBar, isToday && styles.dayBarToday]}>{count > 0 && <Text style={[styles.dayCount, isToday && styles.dayCountToday]}>{count}</Text>}</View><Text style={[styles.dayLabel, isToday && styles.dayLabelToday]}>{day}</Text></View>; })}</View></View>
          <View style={styles.statsCard}><SectionLabel eyebrow="Statistik" title="Wohin fließt dein Fokus?" action={<Text style={styles.itemCount}>{filteredStatCount} Sitzungen</Text>} /><View style={styles.statsModeRow}><TouchableOpacity onPress={() => { setStatsMode("days"); setStatsCategory("all"); }} style={[styles.statsModeButton, statsMode === "days" && styles.statsModeButtonActive]}><Text style={[styles.statsModeText, statsMode === "days" && styles.statsModeTextActive]}>Wochentage</Text></TouchableOpacity><TouchableOpacity onPress={() => { setStatsMode("categories"); setStatsDay(null); }} style={[styles.statsModeButton, statsMode === "categories" && styles.statsModeButtonActive]}><Text style={[styles.statsModeText, statsMode === "categories" && styles.statsModeTextActive]}>Kategorien</Text></TouchableOpacity></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsFilterRow}>{statsMode === "days" ? ["Alle", ...WEEKDAYS].map((label, index) => <TouchableOpacity key={label} onPress={() => setStatsDay(index === 0 ? null : index - 1)} style={[styles.statsFilterChip, ((index === 0 && statsDay === null) || index - 1 === statsDay) && styles.statsFilterChipActive]}><Text style={[styles.statsFilterText, ((index === 0 && statsDay === null) || index - 1 === statsDay) && styles.statsFilterTextActive]}>{label}</Text></TouchableOpacity>) : ["Alle", ...STAT_CATEGORIES].map((label, index) => <TouchableOpacity key={label} onPress={() => setStatsCategory(index === 0 ? "all" : STAT_CATEGORIES[index - 1])} style={[styles.statsFilterChip, ((index === 0 && statsCategory === "all") || label === statsCategory) && styles.statsFilterChipActive]}><Text style={[styles.statsFilterText, ((index === 0 && statsCategory === "all") || label === statsCategory) && styles.statsFilterTextActive]}>{label}</Text></TouchableOpacity>)}</ScrollView><View style={styles.statsBars}>{statValues.map((value, index) => <View key={statLabels[index]} style={styles.statBarItem}><View style={styles.statBarTrack}><View style={[styles.statBarFill, { height: Math.max(8, (value / statMax) * 72) }]} /></View><Text style={styles.statBarValue}>{value}</Text><Text style={styles.statBarLabel}>{statLabels[index]}</Text></View>)}</View></View>
          <View style={styles.sectionBlock}><SectionLabel eyebrow="Dein Schreibtisch" title="Aktuelle Arbeiten" action={<Text style={styles.itemCount}>{tasks.filter((task) => !task.done).length} offen</Text>} /><View style={styles.taskCard}>{tasks.map((task, index) => <View key={task.id} style={[styles.taskRow, index < tasks.length - 1 && styles.taskRowBorder]}><TouchableOpacity onPress={() => setTasks((current) => current.map((item) => item.id === task.id ? { ...item, done: !item.done } : item))} style={[styles.checkCircle, task.done && styles.checkCircleDone]} accessibilityRole="checkbox" accessibilityState={{ checked: task.done }} accessibilityLabel={`${task.title} ${task.done ? "erledigt" : "offen"}`}>{task.done && <Ionicons name="checkmark" size={14} color={COLORS.white} />}</TouchableOpacity><TouchableOpacity onPress={() => { if (!task.done) setActiveTaskId(task.id); }} style={styles.taskTextWrap}><Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text><Text style={styles.taskCategoryLabel}>{task.category}</Text>{selectedTask?.id === task.id && !task.done && <Text style={styles.taskActiveLabel}>für Fokus ausgewählt</Text>}</TouchableOpacity><TouchableOpacity onPress={() => setTasks((current) => current.filter((item) => item.id !== task.id))} style={styles.taskDelete} accessibilityLabel={`${task.title} löschen`}><Ionicons name="close-outline" size={19} color={COLORS.inkSoft} /></TouchableOpacity></View>)}<View style={styles.addTaskRow}><Ionicons name="add-outline" size={21} color={COLORS.sageDeep} /><TextInput value={newTask} onChangeText={setNewTask} onSubmitEditing={addTask} returnKeyType="done" placeholder="Neue Aufgabe hinzufügen" placeholderTextColor="#A5AAA8" style={styles.taskInput} accessibilityLabel="Neue Aufgabe" /><TouchableOpacity onPress={addTask} style={styles.addTaskButton} accessibilityRole="button" accessibilityLabel="Neue Aufgabe speichern"><Ionicons name="arrow-up-outline" size={17} color={COLORS.white} /></TouchableOpacity></View></View></View>

          <View style={styles.categoryPicker}><Text style={styles.categoryPickerLabel}>Neue Arbeit als</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryChips}>{TASK_CATEGORIES.map((category) => <TouchableOpacity key={category} onPress={() => setNewTaskCategory(category)} style={[styles.categoryChip, newTaskCategory === category && styles.categoryChipActive]}><Text style={[styles.categoryChipText, newTaskCategory === category && styles.categoryChipTextActive]}>{category}</Text></TouchableOpacity>)}</ScrollView></View>
          <View style={styles.sectionBlock}><SectionLabel eyebrow="Soundtrack" title="Umgebungsgeräusche" action={<View style={styles.soundStatus}><View style={styles.soundStatusDot} /><Text style={styles.soundStatusText}>{activeSoundCount} aktiv</Text></View>} /><View style={styles.soundCard}><View style={styles.lofiRow}><View style={styles.lofiArt}><Ionicons name="musical-notes-outline" size={21} color={COLORS.amberDeep} /></View><View style={styles.lofiCopy}><Text style={styles.lofiTitle}>Lo-Fi Zimmer</Text><Text style={styles.lofiSubtitle}>{lofiPlaying ? "spielt gerade · lokaler Loop" : "bereit für ruhige Arbeit"}</Text></View><TouchableOpacity onPress={toggleLofi} style={styles.lofiButton} accessibilityRole="button" accessibilityLabel={lofiPlaying ? "Lo-Fi pausieren" : "Lo-Fi abspielen"}><Ionicons name={lofiPlaying ? "pause" : "play"} size={16} color={COLORS.ink} /></TouchableOpacity></View><View style={styles.lofiControls}><Text style={styles.lofiVolumeLabel}>Lautstärke {Math.round(lofiVolume * 100)}%</Text><View style={styles.volumeButtons}><TouchableOpacity onPress={() => setLofiVolume((volume) => Math.max(0, Number((volume - 0.05).toFixed(2))))} style={styles.volumeButton} accessibilityLabel="Lo-Fi leiser"><Text style={styles.volumeButtonText}>−</Text></TouchableOpacity><TouchableOpacity onPress={() => setLofiVolume((volume) => Math.min(1, Number((volume + 0.05).toFixed(2))))} style={styles.volumeButton} accessibilityLabel="Lo-Fi lauter"><Text style={styles.volumeButtonText}>+</Text></TouchableOpacity></View></View><View style={styles.lofiDivider} /><View style={styles.soundRows}>{sounds.map((sound, index) => <View key={sound.id} style={[styles.soundRow, index < sounds.length - 1 && styles.soundRowBorder]}><TouchableOpacity onPress={() => updateSound(sound.id, { enabled: !sound.enabled })} style={[styles.soundIcon, { backgroundColor: `${sound.color}24` }]} accessibilityRole="switch" accessibilityState={{ checked: sound.enabled }} accessibilityLabel={`${sound.label} ${sound.enabled ? "ausschalten" : "einschalten"}`}><Ionicons name={sound.icon} size={20} color={sound.color} /></TouchableOpacity><View style={styles.soundInfo}><View style={styles.soundNameRow}><Text style={styles.soundName}>{sound.label}</Text><Text style={styles.soundPercent}>{sound.enabled ? `${Math.round(sound.volume * 100)}%` : "aus"}</Text></View><Pressable style={styles.volumeTrack} onLayout={(event) => setTrackWidths((current) => ({ ...current, [sound.id]: event.nativeEvent.layout.width }))} onPress={(event) => { const trackWidth = trackWidths[sound.id] ?? 1; const nextVolume = Math.max(0, Math.min(1, event.nativeEvent.locationX / trackWidth)); updateSound(sound.id, { enabled: true, volume: Number(nextVolume.toFixed(2)) }); }} accessibilityRole="adjustable" accessibilityLabel={`${sound.label} Lautstärke`}><View style={[styles.volumeFill, { width: `${sound.enabled ? sound.volume * 100 : 0}%`, backgroundColor: sound.color }]} /><View style={[styles.volumeThumb, { left: `${Math.max(0, sound.enabled ? sound.volume * 100 : 0)}%`, backgroundColor: sound.color }]} /></Pressable></View><View style={styles.volumeButtons}><TouchableOpacity onPress={() => updateSound(sound.id, { volume: Math.max(0, Number((sound.volume - 0.05).toFixed(2))) })} style={styles.volumeButton} accessibilityLabel={`${sound.label} leiser`}><Text style={styles.volumeButtonText}>−</Text></TouchableOpacity><TouchableOpacity onPress={() => updateSound(sound.id, { volume: Math.min(1, Number((sound.volume + 0.05).toFixed(2))) })} style={styles.volumeButton} accessibilityLabel={`${sound.label} lauter`}><Text style={styles.volumeButtonText}>+</Text></TouchableOpacity></View></View>)}</View><View style={styles.soundFooter}><Ionicons name="headset-outline" size={16} color={COLORS.inkSoft} /><Text style={styles.soundFooterText}>Mische dir deinen ruhigen Hintergrund.</Text></View></View></View>
          <Text style={styles.footerNote}>kleine schritte. tiefe arbeit. dein tempo.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream }, scrollContent: { alignItems: "center", paddingHorizontal: 16 }, content: { maxWidth: 720 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }, brandLockup: { flexDirection: "row", alignItems: "center", gap: 10 }, brandMark: { width: 38, height: 38, borderRadius: 14, backgroundColor: COLORS.amber, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-6deg" }] }, brandName: { color: COLORS.ink, fontSize: 18, fontWeight: "800", letterSpacing: -0.6 }, brandKicker: { color: COLORS.inkSoft, fontSize: 10, letterSpacing: 0.8, marginTop: 1 }, dayPill: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.paper, borderWidth: 1, borderColor: COLORS.border }, statusDot: { width: 7, height: 7, borderRadius: 5 }, dayPillText: { color: COLORS.inkSoft, fontSize: 12, fontWeight: "700" }, greetingBlock: { marginBottom: 16 }, greeting: { color: COLORS.ink, fontSize: 27, fontWeight: "800", letterSpacing: -1 }, greetingSub: { color: COLORS.inkSoft, fontSize: 14, marginTop: 5 },
  room: { height: 246, borderRadius: 28, overflow: "hidden", position: "relative", marginBottom: 14 }, roomDay: { backgroundColor: "#D6E5E3" }, roomNight: { backgroundColor: COLORS.night }, roomGlow: { position: "absolute", width: 220, height: 220, borderRadius: 140, right: -32, top: -82 }, roomGlowDay: { backgroundColor: "#FFE7B1", opacity: 0.7 }, roomGlowNight: { backgroundColor: "#3B4D69", opacity: 0.42 }, windowFrame: { position: "absolute", top: 25, right: 34, width: 132, height: 116, borderRadius: 16, borderWidth: 7, borderColor: "#EBD9C3", overflow: "hidden" }, windowSky: { flex: 1, position: "relative", overflow: "hidden" }, skyDay: { backgroundColor: "#BFE1EC" }, skyNight: { backgroundColor: "#283852" }, sun: { position: "absolute", width: 25, height: 25, borderRadius: 16, backgroundColor: "#FFD38D", top: 17, left: 16 }, moon: { position: "absolute", width: 27, height: 27, borderRadius: 16, backgroundColor: "#F7E8BC", top: 16, right: 17 }, star: { position: "absolute", width: 3, height: 3, borderRadius: 4, backgroundColor: "#FFF4D6" }, horizon: { position: "absolute", bottom: 0, left: -10, right: -10, height: 34 }, horizonDay: { backgroundColor: "#9FC6B2" }, horizonNight: { backgroundColor: "#344D59" }, hill: { position: "absolute", bottom: 20, left: 30, width: 120, height: 30, borderRadius: 70, transform: [{ rotate: "-7deg" }] }, hillDay: { backgroundColor: "#8EB59F" }, hillNight: { backgroundColor: "#263F4E" }, windowDividerVertical: { position: "absolute", top: 0, bottom: 0, left: "50%", width: 2, backgroundColor: "#EBD9C3", opacity: 0.8 }, windowDividerHorizontal: { position: "absolute", left: 0, right: 0, top: "53%", height: 2, backgroundColor: "#EBD9C3", opacity: 0.8 }, shelf: { position: "absolute", left: 39, top: 56, width: 122, height: 7, borderRadius: 4, backgroundColor: "#B78059" }, shelfBookOne: { position: "absolute", bottom: 7, left: 13, width: 17, height: 28, backgroundColor: "#EBAE7C", transform: [{ rotate: "-4deg" }] }, shelfBookTwo: { position: "absolute", bottom: 7, left: 32, width: 14, height: 23, backgroundColor: "#8DA6A0", transform: [{ rotate: "5deg" }] }, shelfPlantPot: { position: "absolute", bottom: 7, right: 21, width: 19, height: 18, borderRadius: 4, backgroundColor: "#D89163" }, shelfPlantLeafOne: { position: "absolute", bottom: 23, right: 31, width: 14, height: 25, borderRadius: 15, backgroundColor: "#6D9378", transform: [{ rotate: "-22deg" }] }, shelfPlantLeafTwo: { position: "absolute", bottom: 24, right: 20, width: 12, height: 23, borderRadius: 15, backgroundColor: "#84A884", transform: [{ rotate: "26deg" }] },
  desk: { position: "absolute", left: 40, bottom: 35, width: 260, height: 94 }, deskTop: { position: "absolute", left: 0, right: 0, top: 29, height: 11, borderRadius: 6, backgroundColor: "#B87D55" }, deskLegLeft: { position: "absolute", left: 17, top: 40, width: 9, height: 54, backgroundColor: "#946544", transform: [{ rotate: "4deg" }] }, deskLegRight: { position: "absolute", right: 18, top: 40, width: 9, height: 54, backgroundColor: "#946544", transform: [{ rotate: "-4deg" }] }, deskLamp: { position: "absolute", left: 48, top: -3, width: 56, height: 74, alignItems: "center" }, lampShade: { width: 51, height: 29, borderRadius: 8, backgroundColor: COLORS.amber, transform: [{ rotate: "-4deg" }] }, lampStem: { width: 4, height: 29, backgroundColor: "#805B45" }, lampBase: { width: 28, height: 5, borderRadius: 4, backgroundColor: "#805B45" }, mug: { position: "absolute", left: 135, top: 14, width: 21, height: 17, borderRadius: 5, backgroundColor: "#F1D6B8" }, notebook: { position: "absolute", left: 172, top: 19, width: 41, height: 7, borderRadius: 3, backgroundColor: "#E9B4A6", transform: [{ rotate: "-5deg" }] }, chaise: { position: "absolute", right: 29, bottom: 34, width: 160, height: 102 }, chaiseBack: { position: "absolute", left: 18, top: 0, width: 131, height: 67, borderTopLeftRadius: 35, borderTopRightRadius: 35, backgroundColor: "#A6B8A2" }, chaiseSeat: { position: "absolute", left: 3, bottom: 6, width: 157, height: 42, borderRadius: 17, backgroundColor: "#8EA58D" }, chaiseArm: { position: "absolute", right: 0, top: 24, width: 29, height: 63, borderRadius: 13, backgroundColor: "#78917D" }, chaiseLeg: { position: "absolute", left: 21, bottom: 0, width: 7, height: 19, backgroundColor: "#6B5A4E" }, floor: { position: "absolute", bottom: 0, left: 0, right: 0, height: 36, backgroundColor: "#C99B73", opacity: 0.92 }, roomCaptionRow: { position: "absolute", left: 18, bottom: 15, flexDirection: "row", alignItems: "center", gap: 7 }, roomCaptionDot: { width: 6, height: 6, borderRadius: 4, backgroundColor: COLORS.amber }, roomCaption: { color: "#FFF5E6", fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  timerCard: { backgroundColor: COLORS.paper, borderRadius: 26, padding: 20, marginBottom: 14 }, timerCardTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }, timerEyebrow: { color: COLORS.amberDeep, fontSize: 11, fontWeight: "800", letterSpacing: 1.2 }, timerTitle: { color: COLORS.ink, fontSize: 19, fontWeight: "800", marginTop: 4, letterSpacing: -0.4 }, settingsButton: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#F4ECE1", alignItems: "center", justifyContent: "center" }, timerRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 16 }, timerDial: { width: 164, height: 164, borderRadius: 90, borderWidth: 7, borderColor: "#F3E8D8", alignItems: "center", justifyContent: "center", position: "relative" }, timerDialInner: { width: 135, height: 135, borderRadius: 70, backgroundColor: "#FFF9F0", alignItems: "center", justifyContent: "center" }, timerValue: { color: COLORS.ink, fontSize: 35, fontWeight: "800", letterSpacing: -1.6 }, timerMode: { color: COLORS.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 1.8, marginTop: 4 }, progressArc: { position: "absolute", top: -7, left: -7, width: 164, height: 164, borderRadius: 90, borderWidth: 7, borderColor: COLORS.amber, borderLeftColor: "transparent", borderBottomColor: "transparent" }, timerSideCopy: { flex: 1, paddingRight: 2 }, timerSideLabel: { color: COLORS.inkSoft, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 }, activeTaskTitle: { color: COLORS.ink, fontSize: 17, fontWeight: "700", lineHeight: 22, marginTop: 6 }, sessionMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 15 }, sessionMetaText: { color: COLORS.inkSoft, fontSize: 11, flexShrink: 1 }, timerActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 }, iconButton: { width: 43, height: 43, borderRadius: 15, backgroundColor: "#F4ECE1", alignItems: "center", justifyContent: "center" }, primaryButton: { minWidth: 132, height: 47, borderRadius: 16, backgroundColor: COLORS.amber, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, primaryButtonText: { color: COLORS.ink, fontSize: 15, fontWeight: "800" }, settingsPanel: { marginTop: 17, paddingTop: 16, borderTopWidth: 1, borderTopColor: COLORS.border }, settingsPanelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }, settingsPanelTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "800" }, settingsPanelHint: { color: COLORS.inkSoft, fontSize: 11 }, durationRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 }, durationLabel: { color: COLORS.inkSoft, fontSize: 13, fontWeight: "700" }, stepper: { flexDirection: "row", alignItems: "center", gap: 10 }, stepButton: { width: 29, height: 29, borderRadius: 10, backgroundColor: "#F3E8D8", alignItems: "center", justifyContent: "center" }, stepButtonText: { color: COLORS.ink, fontSize: 18, lineHeight: 20 }, durationValue: { color: COLORS.ink, width: 58, textAlign: "center", fontSize: 13, fontWeight: "800" },
  weekCard: { backgroundColor: COLORS.night, borderRadius: 26, padding: 20, marginBottom: 27 }, weekHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, weekTitle: { color: COLORS.cream, fontSize: 17, fontWeight: "800", marginTop: 5, maxWidth: 225 }, weekTotal: { alignItems: "flex-end" }, weekTotalNumber: { color: COLORS.amber, fontSize: 30, fontWeight: "800", lineHeight: 31 }, weekTotalLabel: { color: "#B6C0CF", fontSize: 10, letterSpacing: 0.8, marginTop: 2 }, weekDots: { flexDirection: "row", justifyContent: "space-between", marginTop: 22, paddingHorizontal: 2 }, dayColumn: { alignItems: "center", gap: 8, flex: 1 }, dayBar: { height: 32, width: 31, borderRadius: 11, backgroundColor: "#314057", alignItems: "center", justifyContent: "center" }, dayBarToday: { backgroundColor: COLORS.amber }, dayCount: { color: COLORS.cream, fontSize: 12, fontWeight: "800" }, dayCountToday: { color: COLORS.ink }, dayLabel: { color: "#8E9AAC", fontSize: 10, fontWeight: "700" }, dayLabelToday: { color: COLORS.amber },
  statsCard: { backgroundColor: COLORS.paper, borderRadius: 22, padding: 17, marginBottom: 27, borderWidth: 1, borderColor: COLORS.border }, statsModeRow: { flexDirection: "row", backgroundColor: "#F4ECE1", borderRadius: 12, padding: 3, marginBottom: 12 }, statsModeButton: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" }, statsModeButtonActive: { backgroundColor: COLORS.night }, statsModeText: { color: COLORS.inkSoft, fontSize: 11, fontWeight: "800" }, statsModeTextActive: { color: COLORS.cream }, statsFilterRow: { gap: 7, paddingBottom: 14 }, statsFilterChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: "#F4ECE1" }, statsFilterChipActive: { backgroundColor: COLORS.amber }, statsFilterText: { color: COLORS.inkSoft, fontSize: 10, fontWeight: "800" }, statsFilterTextActive: { color: COLORS.ink }, statsBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", minHeight: 104, paddingTop: 5 }, statBarItem: { alignItems: "center", flex: 1, gap: 3 }, statBarTrack: { height: 72, width: 18, borderRadius: 9, backgroundColor: "#F0EBE4", justifyContent: "flex-end", overflow: "hidden" }, statBarFill: { width: "100%", borderRadius: 9, backgroundColor: COLORS.sageDeep }, statBarValue: { color: COLORS.ink, fontSize: 10, fontWeight: "800" }, statBarLabel: { color: COLORS.inkSoft, fontSize: 9, fontWeight: "700" }, sectionBlock: { marginBottom: 27 }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 12 }, eyebrow: { color: COLORS.inkSoft, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, sectionTitle: { color: COLORS.ink, fontSize: 21, fontWeight: "800", letterSpacing: -0.6, marginTop: 3 }, itemCount: { color: COLORS.sageDeep, fontSize: 12, fontWeight: "800", marginBottom: 3 }, taskCard: { backgroundColor: COLORS.paper, borderRadius: 22, paddingHorizontal: 17, borderWidth: 1, borderColor: COLORS.border }, taskRow: { minHeight: 63, flexDirection: "row", alignItems: "center", gap: 12 }, taskRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1EBE2" }, checkCircle: { width: 23, height: 23, borderRadius: 13, borderWidth: 1.5, borderColor: "#C9D0C8", alignItems: "center", justifyContent: "center" }, checkCircleDone: { backgroundColor: COLORS.sageDeep, borderColor: COLORS.sageDeep }, taskTextWrap: { flex: 1, justifyContent: "center" }, taskTitle: { color: COLORS.ink, fontSize: 14, fontWeight: "700" }, taskTitleDone: { color: "#A5AAA8", textDecorationLine: "line-through" }, taskCategoryLabel: { color: COLORS.inkSoft, fontSize: 9, fontWeight: "700", marginTop: 3 }, taskActiveLabel: { color: COLORS.amberDeep, fontSize: 10, fontWeight: "700", marginTop: 3 }, taskDelete: { width: 28, height: 30, alignItems: "center", justifyContent: "center" }, addTaskRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10 }, taskInput: { flex: 1, color: COLORS.ink, fontSize: 13, paddingVertical: 12 }, addTaskButton: { width: 30, height: 30, borderRadius: 10, backgroundColor: COLORS.sageDeep, alignItems: "center", justifyContent: "center" }, addTaskPressable: { flex: 1, paddingVertical: 13 }, addTaskText: { color: COLORS.sageDeep, fontSize: 13, fontWeight: "800" }, categoryPicker: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -18, marginBottom: 27, paddingHorizontal: 2 }, categoryPickerLabel: { color: COLORS.inkSoft, fontSize: 10, fontWeight: "800" }, categoryChips: { gap: 6 }, categoryChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 13, backgroundColor: "#F4ECE1" }, categoryChipActive: { backgroundColor: COLORS.sageDeep }, categoryChipText: { color: COLORS.inkSoft, fontSize: 9, fontWeight: "800" }, categoryChipTextActive: { color: COLORS.white },
  soundRows: { }, lofiRow: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 14 }, lofiArt: { width: 41, height: 41, borderRadius: 14, backgroundColor: "#F8E5CB", alignItems: "center", justifyContent: "center" }, lofiCopy: { flex: 1 }, lofiTitle: { color: COLORS.ink, fontSize: 13, fontWeight: "800" }, lofiSubtitle: { color: COLORS.inkSoft, fontSize: 10, marginTop: 3 }, lofiButton: { width: 36, height: 36, borderRadius: 13, backgroundColor: COLORS.amber, alignItems: "center", justifyContent: "center" }, lofiControls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 13 }, lofiVolumeLabel: { color: COLORS.inkSoft, fontSize: 10, fontWeight: "700" }, lofiDivider: { height: 1, backgroundColor: "#F1EBE2" }, soundStatus: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 }, soundStatusDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: COLORS.sageDeep }, soundStatusText: { color: COLORS.sageDeep, fontSize: 12, fontWeight: "800" }, soundCard: { backgroundColor: COLORS.paper, borderRadius: 22, paddingHorizontal: 17, borderWidth: 1, borderColor: COLORS.border }, soundRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 11 }, soundRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1EBE2" }, soundIcon: { width: 41, height: 41, borderRadius: 14, alignItems: "center", justifyContent: "center" }, soundInfo: { flex: 1 }, soundNameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }, soundName: { color: COLORS.ink, fontSize: 13, fontWeight: "800" }, soundPercent: { color: COLORS.inkSoft, fontSize: 11, fontWeight: "700" }, volumeTrack: { height: 5, borderRadius: 5, backgroundColor: "#ECE7E0", position: "relative", overflow: "visible" }, volumeFill: { height: 5, borderRadius: 5 }, volumeThumb: { position: "absolute", top: -4, marginLeft: -5, width: 13, height: 13, borderRadius: 7, borderWidth: 2, borderColor: COLORS.paper }, volumeButtons: { flexDirection: "row", gap: 5 }, volumeButton: { width: 25, height: 25, borderRadius: 9, backgroundColor: "#F3EEE8", alignItems: "center", justifyContent: "center" }, volumeButtonText: { color: COLORS.inkSoft, fontSize: 16, lineHeight: 19 }, soundFooter: { minHeight: 49, flexDirection: "row", alignItems: "center", gap: 8 }, soundFooterText: { color: COLORS.inkSoft, fontSize: 11 }, footerNote: { textAlign: "center", color: "#9DA49E", fontSize: 10, letterSpacing: 1.2, marginBottom: 8 },
});
