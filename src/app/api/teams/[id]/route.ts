import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { uploadToS3, deleteFromS3, extractS3Key } from '../../../../lib/s3';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const teamId =
      typeof resolvedParams === 'object' && 'id' in resolvedParams
        ? resolvedParams.id
        : String(resolvedParams);

    const contentType = req.headers.get('content-type') || '';

    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const teamColor = formData.get('teamColor') as string | null;
    const teamName = formData.get('teamName') as string | null;

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(teamName ? { teamName } : {}),
        ...(teamColor ? { teamColor } : {}),
      },
    });

    for (let i = 0; i < 4; i++) {
      const playerName = formData.get(`playerName-${i}`) as string | null;
      const playerImageFile = formData.get(
        `playerImage-${i}`
      ) as File | null;

      const existingPlayer = team.players.find(
        (p) => p.position === i + 1
      );

      if (playerImageFile && playerImageFile.size > 0) {
        const buffer = Buffer.from(
          await playerImageFile.arrayBuffer()
        );
        const ext =
          playerImageFile.name.split('.').pop() || 'jpg';
        const key = `players/${team.slotNumber}-${i}-${Date.now()}.${ext}`;

        const playerImageUrl = await uploadToS3(
          buffer,
          key,
          playerImageFile.type
        );

        if (existingPlayer?.playerImage) {
          const oldKey = extractS3Key(existingPlayer.playerImage);
          if (oldKey) await deleteFromS3(oldKey);
        }

        if (existingPlayer) {
          await prisma.player.update({
            where: { id: existingPlayer.id },
            data: {
              playerName: playerName || existingPlayer.playerName,
              playerImage: playerImageUrl,
            },
          });
        } else {
          await prisma.player.create({
            data: {
              teamId,
              playerName: playerName || '',
              playerImage: playerImageUrl,
              position: i + 1,
            },
          });
        }
      }
      // NAME ONLY UPDATE
      else if (playerName && existingPlayer) {
        await prisma.player.update({
          where: { id: existingPlayer.id },
          data: { playerName },
        });
      }
      // CREATE PLAYER (NO IMAGE)
      else if (playerName && !existingPlayer) {
        await prisma.player.create({
          data: {
            teamId,
            playerName,
            playerImage: null,
            position: i + 1,
          },
        });
      }
    }

    // ---------- RETURN UPDATED TEAM ----------
    const finalTeam = await prisma.team.findUnique({
      where: { id: teamId },
      include: { players: true },
    });

    return NextResponse.json(finalTeam);
  } catch (err) {
    console.error('PATCH TEAM ERROR:', err);
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }
}
