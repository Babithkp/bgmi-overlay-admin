import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
    try {
        const tournaments = await prisma.tournament.findMany();
        return NextResponse.json(tournaments);
    } catch (err) {
        console.error("API /tournaments GET ERROR:", err);
        return NextResponse.json(
            {
                error: "Failed to fetch tournaments",
            },
            { status: 500 }
        );
    }
}

export async function POST(req: Request) {
    try {
        const name = await req.json();
        const tournament = await prisma.tournament.create({
            data: {
                tournamentName: name,
                status: "disabled",
            },
        });
        if (tournament) {
            const updatedTournaments = await prisma.tournament.findMany();
            return NextResponse.json(updatedTournaments);
        }
    } catch (err) {
        console.error("API /tournaments POST ERROR:", err);
        return NextResponse.json(
            {
                error: "Failed to create tournament",
                details: String(err),
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req: Request) {
    try {
        const id = await req.json();
        const tournament = await prisma.tournament.delete({
            where: {
                id: id,
            },
        });
        if (tournament) {
            const updatedTournaments = await prisma.tournament.findMany();
            return NextResponse.json(updatedTournaments);
        }
    } catch (err) {
        console.error("API /tournaments DELETE ERROR:", err);
        return NextResponse.json(
            {
                error: "Failed to delete tournament",
                details: String(err),
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req: Request) {
    try {
        const { id, status } = await req.json();
        await prisma.tournament.updateMany({
            data: {
                status: "inactive"
            }
        })
        await prisma.tournament.update({
            where: {
                id: id,
            },
            data: {
                status,
            },
        });
        return NextResponse.json({ success: true });
    } catch (err) {
        console.error("API /tournaments PATCH ERROR:", err);
        return NextResponse.json(
            {
                error: "Failed to update tournament",
                details: String(err),
            },
            { status: 500 }
        );
    }
}