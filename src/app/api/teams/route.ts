import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { uploadToS3, deleteFromS3, extractS3Key } from "../../../lib/s3";

export const runtime = "nodejs";


export async function POST(req: Request) {
  try {
    const playerDefaults = [
      "https://storage.trikonatech.com/dashboard/players/player1.jpeg",
      "https://storage.trikonatech.com/dashboard/players/player2.jpeg",
      "https://storage.trikonatech.com/dashboard/players/player3.jpeg",
      "https://storage.trikonatech.com/dashboard/players/player4.jpeg",
      "https://storage.trikonatech.com/dashboard/players/player5.jpeg",
      "https://storage.trikonatech.com/dashboard/players/player6.jpeg",
    ]

    const formData = await req.formData();
    const tournamentId = formData.get("tournamentId") as string;
    const teamsJson = formData.get("teams") as string;

    if (!teamsJson) {
      return NextResponse.json(
        { error: "No teams data provided" },
        { status: 400 }
      );
    }

    const teamsData = JSON.parse(teamsJson);


    for (const teamData of teamsData) {
      const { slotNumber, teamName, players, teamColor } = teamData;

      const slot = Number(slotNumber);

      const existingTeam = await prisma.team.findUnique({
        where: { tournamentId, slotNumber: slot },
        include: { players: true },
      });

      let teamImageUrl = existingTeam?.teamImage ?? null;
      const teamImageFile = formData.get(
        `teamImage-${slot}`
      ) as File | null;

      if (teamImageFile && teamImageFile.size > 0) {
        const buffer = Buffer.from(
          await teamImageFile.arrayBuffer()
        );
        const ext =
          teamImageFile.name.split(".").pop() || "jpg";
        const key = `teams/${slot}-${Date.now()}.${ext}`;

        teamImageUrl = await uploadToS3(
          buffer,
          key,
          teamImageFile.type
        );

        if (existingTeam?.teamImage) {
          const oldKey = extractS3Key(existingTeam.teamImage);
          if (oldKey) await deleteFromS3(oldKey);
        }
      }

      const team = await prisma.team.upsert({
        where: { tournamentId, slotNumber: slot },
        update: {
          teamName,
          teamImage: teamImageUrl ?? undefined,
          teamColor
        },
        create: {
          slotNumber: slot,
          teamName,
          teamImage: teamImageUrl,
          teamColor,
          tournamentId
        },
      });

      if (existingTeam) {
        await prisma.player.deleteMany({
          where: { teamId: team.id },
        });
      }

      for (let i = 0; i < 4; i++) {
        const player = players[i] || { playerName: "" };
        let playerImageUrl: string | null = null;

        const playerImageFile = formData.get(
          `playerImage-${slot}-${i}`
        ) as File | null;

        if (playerImageFile && playerImageFile.size > 0) {
          const buffer = Buffer.from(
            await playerImageFile.arrayBuffer()
          );
          const ext =
            playerImageFile.name.split(".").pop() || "jpg";
          const key = `players/${slot}-${i}-${Date.now()}.${ext}`;

          playerImageUrl = await uploadToS3(
            buffer,
            key,
            playerImageFile.type
          );
        }
        if (playerImageFile === null) {
          playerImageUrl = playerDefaults[Math.floor(Math.random() * playerDefaults.length)];
        }

        await prisma.player.create({
          data: {
            teamId: team.id,
            playerName: player.playerName || "",
            playerImage: playerImageUrl,
            position: i + 1,
          },
        });
      }
    }

    const updatedTeams = await prisma.team.findMany({
      include: { players: true },
      orderBy: { slotNumber: "asc" },
    });

    return NextResponse.json({
      success: true,
      teams: updatedTeams,
    });
  } catch (err) {
    console.error("API /teams POST ERROR:", err);
    return NextResponse.json(
      {
        error: "Failed try again",
        details: String(err),
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const tournament = await prisma.tournament.findFirst({
      where: {
        status: "active"
      }
    })
    if (!tournament) {
      return NextResponse.json(
        { error: "No tournaments found" },
        { status: 404 }
      );
    }
    const teams = await prisma.team.findMany({
      where: {
        tournamentId: tournament.id
      },
      include: { players: true },
      orderBy: { slotNumber: "asc" },
    });
    console.log(teams);

    return NextResponse.json(teams);
  } catch (err) {
    console.error("API /teams GET ERROR:", err);
    return NextResponse.json(
      {
        error: "Failed to fetch teams",
        details: String(err),
      },
      { status: 500 }
    );
  }
}