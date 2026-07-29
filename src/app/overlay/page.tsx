"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";


type Player = {
  playerName: string;
  playerImage?: string;
};

type Team = {
  teamName: string;
  teamImage?: string;
  teamColor: string;
  players: Player[];
};

type MatchDebug = {
  playerName: string;
  teamName: string;
  teamImage: string;
  playerImage: string;
  color: string;
  score: number;
};

type OCRPlayer = {
  name?: string;
};

type OCRPayload = {
  parsed?: {
    players?: OCRPlayer[];
    team?: string;
  };
  raw_text?: string[];
  ui_position?: {
    TeamShortLogoTop: number;
    TeamShortLogoLeft: number;
    TeamShortLogoWidth: number;
    TeamShortLogoHeight: number;
    TeamLogoTop: number;
    TeamLogoLeft: number;
    TeamLogoSize: number;
    PlayerImgTop: number;
    PlayerImgLeft: number;
    PlayerImgSize: number;
  };
};

type PlayerCacheEntry = {
  player: Player;
  team: Team;
  key: string;
  anchors: string[];
};


function similarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();

  if (a === b) return 1.0;
  if (a.includes(b) || b.includes(a)) return 0.8;

  let matches = 0;
  for (const ch of a) {
    if (b.includes(ch)) matches++;
  }

  return matches / Math.max(a.length, b.length);
}


const defaultUI = {
  TeamShortLogoTop: 57,
  TeamShortLogoLeft: 10,
  TeamShortLogoWidth: 100,
  TeamShortLogoHeight: 32,
  TeamLogoTop: 866,
  TeamLogoLeft: 644,
  TeamLogoSize: 70,
  PlayerImgTop: 897,
  PlayerImgLeft: 1280,
  PlayerImgSize: 174,
};

export default function OverlayPage() {
  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [matchDebug, setMatchDebug] = useState<MatchDebug | null>(null);
  const [uiposion, setUiposition] = useState(defaultUI);
  const isClient = typeof window !== "undefined";

  useEffect(() => {
    if (!isClient) return;

    fetch("/api/teams")
      .then((res) => res.json())
      .then((data: Team[]) => {
        setDbTeams(Array.isArray(data) ? data : []);
      })
      .catch(() => console.error("Failed to load admin teams"));
  }, [isClient]);

  const missCountRef = useRef<number>(0);
  const lastStableMatchRef = useRef<MatchDebug | null>(null);
  const playerCacheRef = useRef<PlayerCacheEntry[]>([]);
  const MISS_THRESHOLD = 5;

// ===============================
// NORMALIZATION (UNCHANGED)
// ===============================
const normalizeOCR = (text: string): string =>
  text
    .toLowerCase()
    .replace(/@/g, "q")
    .replace(/d/g, "q")
    .replace(/0/g, "o")
    .replace(/[1il]/g, "l")
    .replace(/7/g, "l")
    .replace(/5/g, "s")
    .replace(/(.)\1{2,}/g, "$1")
    .replace(/[^a-z0-9]/g, "")
    .trim();

// ===============================
// BUILD PLAYER CACHE (ONCE)
// ===============================
useEffect(() => {
  if (dbTeams.length === 0) return;

  const cache: PlayerCacheEntry[] = [];

  for (const team of dbTeams) {
    if (!team.teamImage) continue;

    for (const player of team.players) {
      if (!player.playerImage) continue;

      const key = normalizeOCR(player.playerName);
      if (key.length < 4) continue;

      const anchors: string[] = [];
      for (let i = 0; i <= key.length - 4; i++) {
        anchors.push(key.slice(i, i + 4));
      }

      cache.push({
        player,
        team,
        key,
        anchors,
      });
    }
  }

  playerCacheRef.current = cache;
}, [dbTeams]);

// ===============================
// FAST FUZZY ANCHOR MATCH
// ===============================
function hasFastFuzzyAnchor(
  token: string,
  anchors: string[]
): boolean {
  for (let i = 0; i <= token.length - 4; i++) {
    const sub = token.slice(i, i + 4);

    for (const anchor of anchors) {
      let ok = true;

      for (let k = 0; k < 4; k++) {
        const a = sub[k];
        const b = anchor[k];

        if (a === b) continue;

        if (
          (a === "8" && b === "b") ||
          (a === "b" && b === "8") ||
          (a === "0" && b === "o") ||
          (a === "o" && b === "0") ||
          (a === "1" && b === "l") ||
          (a === "l" && b === "1")
        ) {
          continue;
        }

        ok = false;
        break;
      }

      if (ok) return true;
    }
  }
  return false;
}
// ===============================
// MAIN OCR STREAM EFFECT
// ===============================
useEffect(() => {
  if (!isClient) return;
  if (dbTeams.length === 0) return;

  const source = new EventSource("/api/ocr-stream");

  source.onmessage = (event: MessageEvent<string>) => {
    let payload: OCRPayload;
    try {
      payload = JSON.parse(event.data) as OCRPayload;
    } catch {
      return;
    }

    // UI position updates
    if (payload.ui_position) {
      setUiposition((prev) => ({
        ...prev,
        ...payload.ui_position!,
      }));
    }

    // OCR tokens
    const ocrTokens: string[] = [
      ...(payload.parsed?.players
        ?.map((p) => p.name)
        .filter((v): v is string => Boolean(v)) ?? []),
      ...(payload.raw_text ?? []),
    ];

    const cleanTokens = ocrTokens
      .map(normalizeOCR)
      .filter((t) => t.length >= 3 && t.length <= 25);

    let bestScore = 0;
    let bestTeam: Team | null = null;
    let bestPlayer: Player | null = null;

    for (const token of cleanTokens) {
      for (const entry of playerCacheRef.current) {
        if (!hasFastFuzzyAnchor(token, entry.anchors)) continue;

        const score = similarity(token, entry.key);
        if (score > bestScore) {
          bestScore = score;
          bestTeam = entry.team;
          bestPlayer = entry.player;
        }
      }
    }

    // MATCH FOUND
    if (bestTeam && bestPlayer && bestScore >= 0.75) {
      const match: MatchDebug = {
        playerName: bestPlayer.playerName,
        teamName: bestTeam.teamName,
        teamImage: bestTeam.teamImage!,
        playerImage: bestPlayer.playerImage!,
        color: bestTeam.teamColor,
        score: bestScore,
      };

      lastStableMatchRef.current = match;
      missCountRef.current = 0;
      setMatchDebug(match);
      return;
    }

    // TEMPORAL HOLD
    missCountRef.current++;

    if (
      lastStableMatchRef.current &&
      missCountRef.current < MISS_THRESHOLD
    ) {
      setMatchDebug(lastStableMatchRef.current);
      return;
    }

    // HARD RESET
    lastStableMatchRef.current = null;
    missCountRef.current = 0;
    setMatchDebug(null);
  };

  source.onerror = () => source.close();
  return () => source.close();
}, [dbTeams, isClient]);

  

  


  // if (!isClient) {
  //   return <div style={{ width: "1920px", height: "1080px" }} />;
  // }


  return (
    <div
    // className="bg-black"
    >
      {matchDebug && (
        <div className="relative ">
          <div
            style={{
              position: "absolute",
              top: `${uiposion.TeamShortLogoTop}px`,
              left: `${uiposion.TeamShortLogoLeft}px`,
              width: `${uiposion.TeamShortLogoWidth}px`,
              height: `${uiposion.TeamShortLogoHeight}px`,
            }}
            className=" bg-white  overflow-hidden"
          >
            <Image
              src={matchDebug.teamImage}
              alt="team logo"
              fill
              className="object-cover object-center -rotate-20 scale-[1.6]"
              unoptimized
            />
          </div>

          <div className="absolute flex overflow-hidden"
            style={{
              top: `${uiposion.TeamLogoTop}px`,
              left: `${uiposion.TeamLogoLeft}px`,
            }}
          >
            <div
              style={{
                width: `${uiposion.TeamLogoSize}px`,
                height: `${uiposion.TeamLogoSize}px`,
              }}
              className="bg-black/90"
            >

              <Image
                src={matchDebug.teamImage}
                height={150}
                width={62}
                alt="team logo"
                className="object-cover object-center size-full"
                unoptimized
              />
            </div>
            <div className={`   text-white top-0 left-17 w-80 h-10 pt-1`}
              style={{ background: matchDebug.color ?? "black", clipPath: "polygon(0 0, 85% 0, 100% 100%, 0% 100%)", }}
            >
              <p className="text-2xl font-bold w-full ml-3 font-overlay">
                {matchDebug.playerName}
              </p>
            </div>

          </div>
          <div
            style={{
              top: `${uiposion.PlayerImgTop}px`,
              left: `${uiposion.PlayerImgLeft}px`,
              width: `${uiposion.PlayerImgSize}px`,
              height: `${uiposion.PlayerImgSize}px`,
            }}
            className="absolute overflow-hidden 
             bg-black/70">
              
            <Image
              src={matchDebug.playerImage}
              alt="player"
              fill
              className="object-cover object-center"
              unoptimized
            />
          </div>
        </div>
      )}
    </div>
  );
}
